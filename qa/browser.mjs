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

  // The product photography is served from Pexels. When the machine running the
  // QA cannot reach it (filtered network), every image request hangs until the
  // browser gives up, which stalls layout for tens of seconds and makes the
  // interaction checks flaky. QA_STUB_IMAGES=1 swaps them for a 1×1 pixel so the
  // run measures the app rather than the network.
  if (process.env.QA_STUB_IMAGES === "1") {
    const pixel = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg==",
      "base64"
    );
    await page.route(/^https:\/\/(images\.pexels\.com|fonts\.googleapis\.com|fonts\.gstatic\.com)\//, (route) =>
      route.fulfill({ status: 200, contentType: "image/png", body: pixel })
    );
  }

  return { browser, page, errors };
}

export async function shot(page, name, full = true) {
  await page.waitForTimeout(400);
  try {
    await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: full });
  } catch {
    // This Chromium build's compositor can wedge after a long session, making
    // Playwright's surface capture hang. Grab the frame over CDP instead so a
    // screenshot never aborts the run.
    const cdp = await page.context().newCDPSession(page);
    const { data } = await cdp.send("Page.captureScreenshot", {
      format: "png",
      fromSurface: false,
    });
    fs.writeFileSync(`${OUT}/${name}.png`, Buffer.from(data, "base64"));
  }
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

