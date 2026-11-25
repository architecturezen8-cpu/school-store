import { readFile } from "node:fs/promises";
import path from "node:path";
import type { Pool, PoolClient } from "pg";
import { errorMessage } from "./errors";

/**
 * One database connection per server process.
 *
 * Two backends, one API:
 *
 *   DATABASE_URL=postgres://…   → a real Postgres server (Vercel, Neon, local…)
 *   (no DATABASE_URL)           → PGlite: a full Postgres compiled to WASM that
 *                                 stores its data in `.pglite/`. This is what lets
 *                                 the store run with a *working* database in a
 *                                 browser IDE (StackBlitz/CodeSandbox) where no
 *                                 Postgres server can be started. Same SQL,
 *                                 same schema, same transactions.
 *
 * `STORE_BACKEND=pg` forces the server backend, `STORE_BACKEND=pglite` forces
 * the embedded one. With neither set and no DATABASE_URL, the seed catalogue is
 * served read-only — that is the fallback for a machine with nothing at all.
 */

const rawUrl = (process.env.DATABASE_URL ?? "").trim();
const forced = process.env.STORE_BACKEND ?? "";

/**
 * A DATABASE_URL that parses but names no host (`postgres://`) is worse than no
 * URL at all: the `pg` pool accepts it, then every query rejects with a bare
 * `AggregateError` after a 26-second retry storm. Catch it here, once, and say
 * what is wrong — the rest of the app keeps running on the seed catalogue.
 */
function isUsableUrl(value: string): boolean {
  if (!value) return false;
  try {
    const parsed = new URL(value);
    if (!/^postgres(ql)?:$/.test(parsed.protocol)) return false;
    return Boolean(parsed.hostname);
  } catch {
    return false;
  }
}

export const urlInvalid =
  Boolean(rawUrl) && !isUsableUrl(rawUrl)
    ? "DATABASE_URL is set but is not a usable Postgres URL (it needs a host, e.g. postgres://user:pass@host:5432/db)."
    : "";

if (urlInvalid) console.error("[db]", urlInvalid);

const url = isUsableUrl(rawUrl) ? rawUrl : "";

export type Backend = "pg" | "pglite" | "none";

export const backend: Backend = url
  ? "pg"
  : forced === "pg"
    ? "pg"
    : forced === "none"
      ? "none"
      : "pglite";

declare global {
  var __pgPool: Promise<Pool> | undefined;
  var __pglite: Promise<PGliteLike> | undefined;
  var __pgliteReady: boolean | undefined;
  /**
   * The last reason a `pg` query failed, so the admin can be told the *real*
   * problem. Without it a connection failure is only a line in the server log,
   * and the page on screen quietly shows numbers from somewhere else.
   */
  var __dbFailure: { message: string; at: number } | undefined;
}

/**
 * True when the configured database has already failed and has not answered
 * since. Read-only screens use it to stop re-attempting a connection that is
 * known to be down, so a dead pool costs one timeout per process rather than one
 * per query, per page, per visit.
 */
export const databaseDown = () =>
  backend === "pg" && Boolean(url) && Boolean(global.__dbFailure);

/** Cleared on a successful query, so a recovered database stops warning. */
function noteFailure(err: unknown) {
  global.__dbFailure = { message: errorMessage(err), at: Date.now() };
}

/**
 * Why the configured database is not answering, or `""` when it is fine or
 * nothing is configured at all. Re-checked by the admin on every render, so it
 * clears itself the moment a query succeeds again.
 */
export function databaseFailure(): string {
  if (backend !== "pg" || !url) return "";
  if (!global.__dbFailure) return "";
  return global.__dbFailure.message;
}

/** The small slice of the PGlite API this module needs. */
export type PGliteLike = {
  query<T = Record<string, unknown>>(
    sql: string,
    params?: unknown[]
  ): Promise<{ rows: T[] }>;
  exec(sql: string): Promise<unknown>;
  transaction<T>(fn: (tx: PGliteLike) => Promise<T>): Promise<T>;
  waitReady: Promise<void>;
};

/**
 * Created lazily (and asynchronously) so the PGlite path never even loads `pg`
 * — it pulls in net/tls, which do not exist inside a WebContainer.
 */
async function createPool(): Promise<Pool> {
  const { Pool: PgPool } = await import("pg");
  const isLocal =
    /(^|@)(localhost|127\.0\.0\.1|::1)[:/]/.test(url) || url.includes("host=/");

  return new PgPool({
    connectionString: url,
    max: 5,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 8_000,
    ssl: url && !isLocal ? { rejectUnauthorized: false } : undefined,
  });
}

/** Postgres backend (null when not in use). */
export const pool: Promise<Pool> | null =
  backend === "pg" ? (global.__pgPool ??= createPool()) : null;

/** Absolute so every worker process resolves the same directory. */
const PGLITE_DIR = path.join(process.cwd(), ".pglite");

async function pglite(): Promise<PGliteLike> {
  if (!global.__pglite) {
    global.__pglite = (async () => {
      const { PGlite } = await import("@electric-sql/pglite");
      const db = new PGlite(PGLITE_DIR) as unknown as PGliteLike;
      await db.waitReady;

      // Initialise once per process: schema + seed, both idempotent.
      if (!global.__pgliteReady) {
        const schema = await readFile(
          path.join(process.cwd(), "db", "schema.sql"),
          "utf8"
        );
        await db.exec(schema);
        await seedIfEmpty(db);
        global.__pgliteReady = true;
      }
      return db;
    })().catch((err) => {
      // A failed start must not be cached. The rejected promise used to sit in
      // `global.__pglite` for the life of the process, so one bad start — a
      // deleted `.pglite/`, a half-written file — turned every later request
      // into "PGlite failed to initialize properly" until the server was
      // restarted by hand. Clearing it lets the next request try again.
      global.__pglite = undefined;
      global.__pgliteReady = false;
      throw err;
    });
  }
  return global.__pglite;
}

/**
 * First run only: copy data/seed.ts into the fresh database. Imported lazily so
 * the seed module stays out of the server bundle until it is actually needed.
 */
async function seedIfEmpty(db: PGliteLike) {
  const { rows } = await db.query<{ n: number }>("select count(*)::int as n from products");
  if (Number(rows[0]?.n ?? 0) > 0) return;

  const seed = await import("@/data/seed");
  await db.transaction(async (tx) => {
    const q = <T = Record<string, unknown>>(sql: string, p: unknown[] = []) =>
      tx.query<T>(sql, p);

    for (const [i, c] of seed.categories.entries()) {
      await q(
        `insert into categories (slug, title, description, image, blurb, position)
         values ($1,$2,$3,$4,$5,$6) on conflict (slug) do nothing`,
        [c.slug, c.title, c.desc, c.image, c.count, i]
      );
    }

    for (const p of seed.products) {
      await q(
        `insert into products
           (slug, name, price, image, tag, category, rating, reviews, description,
            details, options, gallery, colours, is_featured, is_new)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
         on conflict (slug) do nothing`,
        [
          p.slug,
          p.name,
          p.price,
          p.image,
          p.tag ?? null,
          p.category,
          p.rating,
          p.reviews,
          p.description,
          JSON.stringify(p.details ?? []),
          p.options ? JSON.stringify(p.options) : null,
          JSON.stringify(p.gallery ?? []),
          JSON.stringify(p.colours ?? []),
          Boolean(p.isFeatured),
          Boolean(p.isNew),
        ]
      );
    }

    for (const [i, r] of seed.reviews.entries()) {
      await q("insert into reviews (name, role, body, rating, position) values ($1,$2,$3,$4,$5)", [
        r.name,
        r.role,
        r.text,
        r.rating,
        i,
      ]);
    }

    for (const e of seed.events) {
      await q(
        `insert into events (slug, title, subtitle, description, venue, city, starts_at, doors, image, tag, featured)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) on conflict (slug) do nothing`,
        [
          e.slug,
          e.title,
          e.subtitle,
          e.description,
          e.venue,
          e.city,
          e.date.toISOString(),
          e.doors,
          e.image,
          e.tag ?? null,
          Boolean(e.featured),
        ]
      );
      for (const [i, t] of e.tiers.entries()) {
        await q(
          `insert into ticket_tiers (id, event, name, price, perks, note, position)
           values ($1,$2,$3,$4,$5,$6,$7) on conflict (id) do nothing`,
          [t.id, e.slug, t.name, t.price, JSON.stringify(t.perks), t.note ?? null, i]
        );
      }
    }
  });
}

/**
 * True when queries can be attempted. A `pg` backend with an unusable URL is
 * reported as *not* configured, so callers take their seed/empty branch instead
 * of throwing a connection error per query.
 */
export const hasDatabase = () => backend !== "none" && !(backend === "pg" && !url);

/**
 * Which store this process is actually reading, for the admin to see.
 *
 * This exists because the fallbacks are invisible otherwise: a `pg` backend
 * whose URL is unusable drops to the embedded database and serves *its* rows, so
 * the admin sees real-looking bookings that are not in Supabase at all. Saying
 * "embedded copy" out loud is the difference between a mystery and a fix.
 */
export const backendLabel =
  backend === "pg" && url
    ? "Supabase Postgres"
    : backend === "none"
      ? "seed catalogue (read-only)"
      : "embedded Postgres (.pglite)";

export async function query<T extends object>(
  sql: string,
  params: unknown[] = []
): Promise<T[]> {
  if (backend === "pg") {
    if (!pool) throw new Error("DATABASE_URL is not configured");
    // Already known to be down: fail immediately rather than wait out another
    // connection timeout on every query of every page render.
    if (global.__dbFailure) {
      throw new Error(global.__dbFailure.message);
    }
    try {
      const res = await (await pool).query<T>(sql, params);
      // A good query clears any older warning: the outage is over.
      global.__dbFailure = undefined;
      return res.rows;
    } catch (err) {
      noteFailure(err);
      // Re-thrown with the underlying reason attached: pool-level failures are
      // AggregateErrors with an empty message, which are unreadable in a log and
      // were crashing the very handler meant to report them.
      throw new Error(errorMessage(err), { cause: err });
    }
  }
  if (backend === "pglite") {
    const db = await pglite();
    const res = await db.query<T>(sql, params);
    return res.rows;
  }
  throw new Error("No database is configured");
}

/** Runs `fn` inside a transaction and rolls back on any throw. */
export async function transaction<T>(
  fn: (c: {
    query<R extends object>(sql: string, params?: unknown[]): Promise<{ rows: R[] }>;
  }) => Promise<T>
): Promise<T> {
  if (backend === "pg") {
    if (!pool) throw new Error("DATABASE_URL is not configured");
    const client = await (await pool).connect().catch((err) => {
      noteFailure(err);
      throw new Error(errorMessage(err), { cause: err });
    });
    try {
      await client.query("begin");
      const out = await fn(client as unknown as Parameters<typeof fn>[0]);
      await client.query("commit");
      return out;
    } catch (err) {
      await client.query("rollback").catch(() => {});
      throw err;
    } finally {
      client.release();
    }
  }
  if (backend === "pglite") {
    const db = await pglite();
    // PGlite's transaction callback commits on resolve and rolls back on throw.
    return db.transaction((tx) =>
      fn({
        query: async <R extends object>(sql: string, params: unknown[] = []) =>
          tx.query<R>(sql, params),
      })
    ) as Promise<T>;
  }
  throw new Error("No database is configured");
}

export type { PoolClient };
