/**
 * Applies db/schema.sql. Idempotent — safe to run on every deploy.
 *   npm run db:migrate        (reads DATABASE_URL from .env.local)
 */
import { readFile } from "node:fs/promises";
import path from "node:path";
import pg from "pg";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is not set. Add it to .env.local (see .env.example).");
  process.exit(1);
}

const sql = await readFile(path.join(process.cwd(), "db", "schema.sql"), "utf8");
const isLocal = /(^|@)(localhost|127\.0\.0\.1)[:/]/.test(url) || url.includes("host=/");

const client = new pg.Client({
  connectionString: url,
  ssl: isLocal ? undefined : { rejectUnauthorized: false },
});

await client.connect();
try {
  await client.query(sql);
  console.log("✓ schema applied");
} finally {
  await client.end();
}
