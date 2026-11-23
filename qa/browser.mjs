/**
 * Browser harness for the manual QA pass.
 *
 * Playwright's own browser download is not reachable from this sandbox, so the
 * Chromium binary is taken from @sparticuz/chromium (an npm package) and the
 * libraries it needs are unpacked from its Lambda layer tarball.
 *
 *   mkdir -p /tmp/qaenv && cd /tmp/qaenv
 *   npm i playwright-core @sparticuz/chromium axe-core
 *   QA_MODULES=/tmp/qaenv/node_modules node qa/crawl.mjs
 *
 * Not part of the app's dependencies and not needed to run or build the store.
 */
import fs from "node:fs";
import { createRequire } from "node:module";

const MODULES = process.env.QA_MODULES ?? "/tmp/qaenv/node_modules";
const require_ = createRequire(MODULES + "/");
const { chromium: pw } = require_("playwright-core");
const chromiumMod = require_("@sparticuz/chromium");
const chromium = chromiumMod.default ?? chromiumMod;

const BASE = process.env.BASE ?? "http://localhost:3000";
const OUT = process.env.OUT ?? "/tmp/qa";
fs.mkdirSync(OUT, { recursive: true });

export async function open({ width = 1440, height = 1000 } = {}) {
  const exe = await chromium.executablePath();
  const browser = await pw.launch({
    executablePath: exe,
    args: [...chromium.args, "--no-sandbox", "--disable-dev-shm-usage"],
    // NSS/NSPR etc. unpacked from @sparticuz/chromium's Lambda layer.
    env: { ...process.env, LD_LIBRARY_PATH: process.env.QA_LIBS ?? "/tmp/al/lib" },
  });
  const page = await browser.newPage({ viewport: { width, height } });
  const errors = [];
  page.on("console", (m) => {
    if (m.type() === "error") errors.push("console: " + m.text().slice(0, 300));
  });
  page.on("pageerror", (e) => errors.push("pageerror: " + e.message.slice(0, 300)));
  return { browser, page, errors };
}

export async function shot(page, name, full = true) {
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: full });
  return `${OUT}/${name}.png`;
}

if (process.argv[2] === "smoke") {
  const { browser, page, errors } = await open();
  await page.goto(BASE + "/", { waitUntil: "networkidle" });
  console.log("title:", await page.title());
  await shot(page, "smoke-home");
  console.log("errors:", errors.length ? errors : "none");
  await browser.close();
}

