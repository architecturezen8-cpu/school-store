import { Pool, type PoolClient } from "pg";

/**
 * One pooled connection per server process.
 *
 * `DATABASE_URL` is optional on purpose: the store must still render (from
 * data/seed.ts) on a machine with no database, so every query in lib/store.ts
 * is wrapped in a fallback. Anything that *writes* (orders, bookings) requires
 * a database and reports that honestly instead of pretending to succeed.
 *
 * Vercel's Postgres integrations hand out a connection string that needs TLS;
 * a local/self-hosted server usually does not, so TLS is enabled automatically
 * for non-localhost hosts.
 */
const url = process.env.DATABASE_URL ?? "";

declare global {
  // eslint-disable-next-line no-var
  var __pgPool: Pool | undefined;
}

function createPool() {
  const isLocal =
    /(^|@)(localhost|127\.0\.0\.1|::1)[:/]/.test(url) || url.includes("host=/");

  return new Pool({
    connectionString: url,
    max: 5,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 8_000,
    ssl: url && !isLocal ? { rejectUnauthorized: false } : undefined,
  });
}

/** null when the app runs without a database. */
export const pool: Pool | null = url ? (global.__pgPool ??= createPool()) : null;

export const hasDatabase = () => pool !== null;

export async function query<T extends object>(
  sql: string,
  params: unknown[] = []
): Promise<T[]> {
  if (!pool) throw new Error("DATABASE_URL is not configured");
  const res = await pool.query<T>(sql, params);
  return res.rows;
}

/** Runs `fn` inside a transaction and rolls back on any throw. */
export async function transaction<T>(fn: (c: PoolClient) => Promise<T>): Promise<T> {
  if (!pool) throw new Error("DATABASE_URL is not configured");
  const client = await pool.connect();
  try {
    await client.query("begin");
    const out = await fn(client);
    await client.query("commit");
    return out;
  } catch (err) {
    await client.query("rollback").catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}
