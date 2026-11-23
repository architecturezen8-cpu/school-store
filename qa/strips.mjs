/**
 * Viewport screenshots at several scroll offsets — full-page shots stitch
 * fixed/sticky elements and hide real layout bugs.
 *
 * Usage: node qa/strips.mjs <path> <width> [name]
 */
import { open } from "./browser.mjs";

const BASE = process.env.BASE ?? "http://localhost:3000";
const path = process.argv[2] ?? "/shop";
const width = Number(process.argv[3] ?? 1440);
const name =
  process.argv[4] ??
  (path.replace(/\W+/g, "-").replace(/^-|-$/g, "") || "home");

const { browser, page, errors } = await open({ width, height: 900 });
await page.goto(BASE + path, { waitUntil: "networkidle" });
await page.waitForTimeout(600);

const height = await page.evaluate(() => document.body.scrollHeight);
const step = 820;
let i = 0;
for (let y = 0; y < height && i < 8; y += step, i++) {
  await page.evaluate((yy) => window.scrollTo(0, yy), y);
  await page.waitForTimeout(450);
  const file = `/tmp/qa/strip-${name}-${i}.png`;
  await page.screenshot({ path: file });
  console.log(file, "y=" + y);
}
console.log("errors:", errors.length ? errors.slice(0, 3) : "none");
await browser.close();
