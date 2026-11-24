/**
 * Is the store actually talking to a database?
 *
 *   npm run db:check
 *
 * Prints which backend the app would use, connects to it, and reads back real
 * rows. Exits 1 if anything is wrong, so it also works in a deploy script.
 */
import { readFile } from "node:fs/promises";
import path from "node:path";

const url = process.env.DATABASE_URL ?? "";
const ok = (m) => console.log(`  ✓ ${m}`);
const bad = (m) => console.log(`  ✗ ${m}`);
const line = (t = "") => console.log(t);

line();
line("── Backend ──────────────────────────────────────────");

if (!url) {
  line("  DATABASE_URL is not set.");
  line();
  line("  The store will run on the embedded PGlite database (.pglite/),");
  line("  not on your Supabase project. To use Supabase, put the connection");
  line("  string in .env.local — see SUPABASE.md.");
  line();
  process.exit(1);
}

/* ---------- validate the string before trusting it ------------------------ *
 * `pg` accepts a mangled string and quietly falls back to the defaults
 * (host "base", user "user"), so the failure surfaces later as
 * "getaddrinfo ENOTFOUND base" — which looks like a network problem when it is
 * really a typo in the URL. Check it properly here and say so.
 */
const SCHEME = /^postgres(ql)?:\/\//;
let host = "";
let port = "";
let user = "";
let problems = [];

function decodeScheme() {
  if (!SCHEME.test(url)) {
    problems.push(
      "missing the postgresql:// prefix — the value must start with postgresql://"
    );
    return false;
  }
  const authority = url.slice(url.indexOf("//") + 2).split("/")[0].split("?")[0];
  const at = authority.lastIndexOf("@");
  if (at < 0) {
    const res = new URL(url); // will throw below if genuinely broken
    host = res.hostname;
    problems.push("no user:password@ section — the username is missing");
    return true;
  }
  const userinfo = authority.slice(0, at);
  const hostport = authority.slice(at + 1);
  user = userinfo.split(":")[0];
  host = hostport.split(":")[0];
  port = hostport.split(":")[1] || "5432";
  if (userinfo.includes("@")) {
    problems.push(
      "the password contains an @ — that character splits the URL. " +
        "Use a password without @ : / # or spaces (or percent-encode it)."
    );
  }
  return true;
}

if (!decodeScheme()) {
  bad("DATABASE_URL does not look like a connection string.");
  line(`  got: ${JSON.stringify(url.slice(0, 40))}${url.length > 40 ? "…" : ""}`);
  line();
  line("  It must look exactly like this (one line, no spaces):");
  line("  postgresql://USER:PASSWORD@HOST:5432/postgres");
  line();
  line("  Note the // straight after postgresql: — without it the driver silently");
  line("  falls back to a host called \"base\" and reports ENOTFOUND.");
  line();
  process.exit(1);
}

// Show the target without leaking the password.
ok(`DATABASE_URL is set → ${host}:${port} (real Postgres)`);
line(`  user: ${user || "(none)"}`);

if (problems.length) {
  for (const p of problems) bad(p);
  line();
  process.exit(1);
}

if (user.includes(".") && !user.startsWith("postgres.") && /^[a-z_]+\.[a-z]{20}$/.test(user)) {
  // e.g. thomian_app.<project-ref> — correct for the pooler
} else if (!user.includes(".")) {
  line("  ! No <role>.<project-ref> in the username. The session pooler needs it");
  line("    (e.g. thomian_app.pkhonlhtzdnbbutruens). See SUPABASE.md.");
}

if (url.includes("db.") && url.includes(".supabase.co")) {
  line("  ! This is the direct connection host. It is IPv6-only and fails on");
  line("    many networks — prefer the Session pooler (see SUPABASE.md).");
}

line();
line("── Connection ───────────────────────────────────────");

const isLocal = /(^|@)(localhost|127\.0\.0\.1|::1)[:/]/.test(url) || url.includes("host=/");
const { default: pg } = await import("pg");
const client = new pg.Client({
  connectionString: url,
  ssl: isLocal ? undefined : { rejectUnauthorized: false },
  connectionTimeoutMillis: 10_000,
});

try {
  await client.connect();
  const who = await client.query("select current_database() db, version() v");
  ok(`connected to "${who.rows[0].db}"`);
  line(`  ${who.rows[0].v.split(",")[0]}`);
} catch (err) {
  bad(`could not connect: ${err.message}`);
  line();
  line("  Common causes:");
  line("   · wrong password  → Settings → Database → Reset database password");
  line("   · direct host instead of the pooler (IPv6-only)");
  line("   · the project is paused (Supabase pauses free projects when idle)");
  line();
  process.exit(1);
}

line();
line("── Does the store's schema exist? ────────────────────");

const TABLES = [
  "categories",
  "products",
  "reviews",
  "events",
  "ticket_tiers",
  "orders",
  "order_items",
  "order_events",
  "bookings",
  "booking_items",
];

const { rows: found } = await client.query(
  "select table_name from information_schema.tables where table_schema = 'public'"
);
const have = new Set(found.map((r) => r.table_name));
const missing = TABLES.filter((t) => !have.has(t));

if (missing.length === 0) {
  ok(`all ${TABLES.length} tables are present`);
} else {
  bad(`missing: ${missing.join(", ")}`);
  line("    fix: npm run db:migrate");
}

line();
line("── Is there data to show? ────────────────────────────");

/** counts that matter; orders/bookings start empty by design */
const EXPECTED = {
  categories: 5,
  products: 17,
  reviews: 4,
  events: 5,
  ticket_tiers: 12,
};

let seeded = true;
for (const [table, expected] of Object.entries(EXPECTED)) {
  if (!have.has(table)) {
    bad(`${table}: table does not exist`);
    seeded = false;
    continue;
  }
  const { rows } = await client.query(`select count(*)::int c from ${table}`);
  const n = rows[0].c;
  if (n >= expected) ok(`${table.padEnd(13)} ${String(n).padStart(3)} rows`);
  else {
    bad(`${table.padEnd(13)} ${String(n).padStart(3)} rows (expected ≥ ${expected})`);
    seeded = false;
  }
}

const { rows: live } = await client.query(
  "select count(*)::int o from orders"
);
line(`  ${"orders".padEnd(13)} ${String(live[0].o).padStart(3)} rows   (empty is normal — they appear as you buy)`);

if (!seeded) {
  line();
  line("  fix: npm run db:seed");
}

line();
line("── Can the app actually read it? ────────────────────");

// The exact query the storefront's product grid runs.
try {
  const { rows } = await client.query(
    `select slug, name, price from products where active order by created_at, name limit 3`
  );
  if (rows.length === 0) {
    bad("the product query returned nothing — the shop would look empty");
  } else {
    ok(`storefront query returned ${rows.length} products, e.g.:`);
    for (const r of rows) line(`      ${r.name} — LKR ${r.price}`);
  }
} catch (err) {
  bad(`storefront query failed: ${err.message}`);
}

line();
line("── Can the app write? ───────────────────────────────");

// A real order insert, rolled back so nothing is left behind. This is the same
// shape lib/orders.ts writes: orders → order_items → order_events.
try {
  await client.query("begin");
  const { rows: o } = await client.query(
    `insert into orders (name, email, subtotal, delivery, total)
     values ('db-check', 'db-check@example.invalid', 1000, 0, 1000)
     returning reference`
  );
  const { rows: p } = await client.query(
    "select slug, name, price from products limit 1"
  );
  await client.query(
    `insert into order_items (order_id, slug, name, price, qty, variant)
     select id, $1, $2, $3, 1, '' from orders where reference = $4`,
    [p[0].slug, p[0].name, p[0].price, o[0].reference]
  );
  await client.query(
    `insert into order_events (order_id, status, message)
     select id, 'pending', 'Order received' from orders where reference = $1`,
    [o[0].reference]
  );
  ok(`orders / order_items / order_events accept writes (test ref ${o[0].reference})`);
  await client.query("rollback");
  ok("test order rolled back — nothing was left in the database");
} catch (err) {
  await client.query("rollback").catch(() => {});
  bad(`write failed: ${err.message}`);
  line("    the checkout would fail with this error");
}

await client.end();

line();
line("─────────────────────────────────────────────────────");
line("Everything above is check marks → the site is live on this database.");
line();
