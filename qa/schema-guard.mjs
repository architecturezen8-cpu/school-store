/**
 * The database being one migration behind the app.
 *
 * This is the failure the office actually hit: a Supabase project that had the
 * products and the categories from earlier rounds but not this round's
 * `shop_filters` table. Three things went wrong at once, and only the first was
 * visible:
 *
 *   1. `/admin/shop/products/new` died into the error boundary — "SOMETHING
 *      BROKE" — because `listFilters` threw;
 *   2. every later query in that process short-circuited, because the missing
 *      table had been latched as "the database is down";
 *   3. nothing on screen said which table was missing or what to do about it.
 *
 * The suite builds that exact database — a real Postgres-speaking server with
 * `shop_filters` dropped — runs the app against it, and checks that the page
 * opens, that the bar names the table, and that the button repairs it and the
 * writes then go through.
 *
 * Temporary QA script, not part of the app.
 *   QA_MODULES=/tmp/qaenv/node_modules QA_LIBS=/tmp/al/lib node qa/schema-guard.mjs
 */
import { spawn } from "node:child_process";
import { existsSync, readFileSync, rmSync } from "node:fs";
import net from "node:net";
import { createRequire } from "node:module";
import { open } from "./browser.mjs";

const QA_MODULES = process.env.QA_MODULES ?? "/tmp/qaenv/node_modules";
const require_ = createRequire(QA_MODULES + "/");
const { PGlite } = await import(
  require_.resolve("@electric-sql/pglite").replace(/dist\/index\.js$/, "dist/index.js")
);
const { PGLiteSocketServer } = await import(
  require_.resolve("@electric-sql/pglite-socket").replace(/dist\/index\.js$/, "dist/index.js")
);

const DB_DIR = "/tmp/schema-guard-db";
const PORT = Number(process.env.PG_PORT ?? 5439);
const APP_PORT = Number(process.env.APP_PORT ?? 3100);
const BASE = `http://localhost:${APP_PORT}`;
const PASSWORD = process.env.ADMIN_PASSWORD ?? "thomian2026";

const steps = [];
const step = async (name, fn) => {
  try {
    const note = await fn();
    steps.push(true);
    console.log(`✓ ${name}${note ? ` — ${note}` : ""}`);
  } catch (error) {
    steps.push(false);
    console.log(`✗ ${name} — ${String(error).slice(0, 300)}`);
  }
};
const flat = (t) => (t ?? "").replace(/\s+/g, " ").trim();

async function free(port) {
  return new Promise((resolve) => {
    const s = net.createServer();
    s.once("error", () => resolve(false));
    s.once("listening", () => s.close(() => resolve(true)));
    s.listen(port, "127.0.0.1");
  });
}

/* ---------- the stale database ---------- */
rmSync(DB_DIR, { recursive: true, force: true });
const db = await PGlite.create(DB_DIR);
await db.exec(readFileSync("db/schema.sql", "utf8"));
await db.exec("drop table shop_filters");
console.log("· database with every table from the earlier rounds, minus shop_filters");

const server = new PGLiteSocketServer({ db, port: PORT, host: "127.0.0.1", maxConnections: 8 });
await server.start();

/* ---------- the app, on that database ---------- */

const app = spawn(
  "npx",
  ["next", "dev", "-p", String(APP_PORT), "-H", "127.0.0.1"],
  {
    env: {
      ...process.env,
      DATABASE_URL: `postgres://postgres:postgres@127.0.0.1:${PORT}/postgres`,
      ADMIN_PASSWORD: PASSWORD,
    },
    stdio: ["ignore", "pipe", "pipe"],
    detached: true,
  }
);
const appLog = [];
app.stdout.on("data", (b) => appLog.push(String(b)));
app.stderr.on("data", (b) => appLog.push(String(b)));

async function waitForApp() {
  for (let i = 0; i < 90; i++) {
    await new Promise((r) => setTimeout(r, 1000));
    if (appLog.join("").includes("Another next dev server is already running")) {
      throw new Error(
        "another dev server is already running in this directory — stop `npm run dev` and re-run this suite"
      );
    }
    try {
      const res = await fetch(BASE + "/admin", { redirect: "manual" });
      if (res.status < 500) return true;
    } catch {
      /* not listening yet */
    }
  }
  return false;
}

let browser;
let fatal = "";
try {
  if (!(await waitForApp())) throw new Error("the app never started");
  console.log("· app running against it");

  const opened = await open({ width: 1440, height: 1000 });
  browser = opened.browser;
  const page = opened.page;

  await step("sign in", async () => {
    await page.goto(BASE + "/admin", { waitUntil: "domcontentloaded" });
    await page.fill('input[type="password"]', PASSWORD);
    await page.locator('form:has(input[type="password"]) button[type="submit"]').click();
    await page.locator("nav#admin-sidebar").waitFor({ timeout: 30000 });
    return "ok";
  });

  await step("the new-product screen opens instead of breaking", async () => {
    await page.goto(BASE + "/admin/shop/products/new", { waitUntil: "networkidle" });
    await page.waitForTimeout(800);
    const body = flat(await page.locator("body").innerText());
    if (/SOMETHING BROKE/i.test(body)) throw new Error("still the error boundary");
    if (!/Add to the shop/i.test(body)) throw new Error("the editor did not render");
    return "rendered";
  });

  await step("the editor still offers the built-in colour and size chips", async () => {
    if ((await page.getByRole("button", { name: "Navy", exact: true }).count()) === 0) {
      throw new Error("no Navy chip");
    }
    return "Navy";
  });

  await step("the bar names the missing table", async () => {
    const body = flat(await page.locator("body").innerText());
    if (!/shop_filters/i.test(body)) throw new Error("the bar does not name the table");
    if (!/Update the database/i.test(body)) throw new Error("no repair button");
    return "shop_filters, with a button";
  });

  await step("the shop itself still sells from the built-in catalogue", async () => {
    await page.goto(BASE + "/shop", { waitUntil: "networkidle" });
    const body = flat(await page.locator("body").innerText());
    if (!/17 of 17|Showing/.test(body)) throw new Error("the shop is empty");
    return "catalogue on screen";
  });

  // The table this round added. A Supabase project that has everything from the
  // earlier rounds and not `product_stock` is the case the office will actually
  // hit, so the screen that depends on it is checked while it is missing.
  await step("the Stocks screen opens, with nothing counted yet", async () => {
    await page.goto(BASE + "/admin/stock", { waitUntil: "networkidle" });
    await page.waitForTimeout(800);
    const body = flat(await page.locator("body").innerText());
    if (/SOMETHING BROKE/i.test(body)) throw new Error("the error boundary");
    if (!/not counted/i.test(body)) throw new Error("no 'not counted' state: " + body.slice(0, 200));
    return "opens, everything not counted";
  });

  await step("press the button: the database is brought up to date", async () => {
    await page.goto(BASE + "/admin/shop", { waitUntil: "networkidle" });
    await page.getByRole("button", { name: /Update the database/i }).click();
    // The action applies the schema and, on an empty catalogue, seeds it — so
    // wait for the redirect rather than for a stopwatch.
    await page.waitForURL(/ok=/, { timeout: 60000 });
    await page.waitForTimeout(1500);
    const body = flat(await page.locator("body").innerText());
    if (/Update the database/i.test(body)) throw new Error("the bar is still there");
    return "repaired";
  });

  await step("the filters page is real now, and writes go through", async () => {
    await page.goto(BASE + "/admin/shop/filters", { waitUntil: "networkidle" });
    await page.locator('input[name="label"]').first().fill("GuardCheck");
    await page.getByRole("button", { name: /^Add$/ }).click();
    const row = page.locator('li[data-filter="GuardCheck"]');
    await row.first().waitFor({ timeout: 25000 });

    page.once("dialog", (d) => d.accept().catch(() => {}));
    await row.locator('button[aria-label="Delete GuardCheck"]').click();
    await page.waitForTimeout(2500);
    if ((await page.locator('li[data-filter="GuardCheck"]').count()) !== 0) {
      throw new Error("the filter would not delete");
    }
    return "added and deleted";
  });

  await step("the stock boxes exist and hold a number once the table is there", async () => {
    await page.goto(BASE + "/admin/shop/products/crest-hoodie", { waitUntil: "networkidle" });
    const box = page.locator('input[aria-label="Stock for Navy M"]');
    await box.waitFor({ timeout: 25000 });
    await box.fill("4");
    await page.getByRole("button", { name: /^Save$/ }).click();
    await page.waitForTimeout(3500);

    await page.goto(BASE + "/admin/stock", { waitUntil: "networkidle" });
    const body = flat(await page.locator("body").innerText());
    if (!/4\s*left/i.test(body)) throw new Error("the number did not stick: " + body.slice(0, 300));
    return "4 left";
  });

  await step("the built-in catalogue is no longer what the admin shows", async () => {
    await page.goto(BASE + "/admin/shop", { waitUntil: "networkidle" });
    const body = flat(await page.locator("body").innerText());
    if (!/IN THE SHOP/.test(body)) throw new Error("the shelf did not render");
    if (/older than this version/i.test(body)) throw new Error("the warning outlived the repair");
    return "clean";
  });
} catch (error) {
  fatal = String(error);
  console.log(`✗ could not test — ${fatal}`);
} finally {
  await browser?.close().catch(() => {});
  // `npx` spawns the dev server as a child; killing the wrapper alone leaves
  // the server holding its port, which then blocks the next run.
  app.kill("SIGTERM");
  try {
    process.kill(-app.pid, "SIGTERM");
  } catch {
    /* not a process group */
  }
  await server.stop().catch(() => {});
  await db.close().catch(() => {});
}

const failed = steps.filter((ok) => !ok).length + (fatal ? 1 : 0);
console.log(`\n${steps.length - (failed - (fatal ? 1 : 0))}/${steps.length} passed${failed ? " — see above" : ""}`);
if (failed) {
  console.log("\napp log tail:\n" + appLog.join("").split("\n").slice(-25).join("\n"));
}
process.exit(failed ? 1 : 0);
