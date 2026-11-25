/**
 * One presentable ticket design for the docs screenshots.
 *
 * `qa/square-rule.mjs` uploads fixture designs called "QA …"; those belong in a
 * test database, not in `docs/screens/admin-templates.png`. This uploads a single
 * design that looks like the school's own artwork, through the same admin action
 * the real upload uses (so the white square is genuinely detected, not faked),
 * and writes it to the local PGlite database.
 *
 *   QA_MODULES=… QA_LIBS=… node qa/template-demo.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { open } from "./browser.mjs";

const BASE = process.env.BASE ?? "http://localhost:3000";
const PASSWORD = process.env.ADMIN_PASSWORD ?? "thomian2026";
const OUT = "/tmp/qa-demo";
fs.mkdirSync(OUT, { recursive: true });

// The artwork: a wide, print-looking card with one solid white square where the
// QR goes. 1440×900, square at 320px — the sizes TICKETS.md calls comfortable.
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1440" height="900" viewBox="0 0 1440 900">
  <rect width="1440" height="900" fill="#0d1220"/>
  <rect x="0" y="0" width="1440" height="8" fill="#ffd444"/>
  <g font-family="Georgia, 'Times New Roman', serif" fill="#ffffff">
    <text x="96" y="150" font-size="26" letter-spacing="14" fill="#ffd444">EST. 1873</text>
    <text x="96" y="248" font-size="86" letter-spacing="4">ST. THOMAS' COLLEGE</text>
    <text x="96" y="306" font-size="28" letter-spacing="12" fill="#9aa6bd">MATALE · SRI LANKA</text>
    <rect x="96" y="360" width="120" height="3" fill="#ffd444"/>
    <text x="96" y="452" font-size="34" letter-spacing="8" fill="#9aa6bd">ADMISSION TICKET</text>
    <text x="96" y="580" font-size="96">The Big Match</text>
    <text x="96" y="646" font-size="30" fill="#c8d0e0">Sunday, 10 January 2027 · College Grounds, Matale</text>
    <text x="96" y="740" font-size="26" letter-spacing="10" fill="#9aa6bd">ANIMO ET FIDE</text>
    <text x="96" y="820" font-size="24" fill="#6f7b93">One entry per ticket · scanned once at the gate</text>
  </g>
  <rect x="1000" y="290" width="320" height="320" fill="#ffffff"/>
</svg>`;

// The uploader accepts PNG/JPEG/WebP only (an email attachment has to be a
// bitmap), so the SVG is rasterised with the same sharp the uploader uses.
const { createRequire } = await import("node:module");
const requireHere = createRequire(import.meta.url);
const sharp = requireHere("sharp");
const file = path.join(OUT, "big-match-demo.png");
await sharp(Buffer.from(svg)).png().toFile(file);

const { browser, page } = await open({ width: 1440, height: 1000 });
await page.goto(BASE + "/admin", { waitUntil: "domcontentloaded" });
await page.fill('input[name="password"]', PASSWORD);
await page.locator('form:has(input[type="password"]) button[type="submit"]').click();
await page.waitForURL(/\/admin$/, { timeout: 20000 });
await page.waitForTimeout(1000);          // let the session cookie settle

await page.goto(BASE + "/admin/templates", { waitUntil: "load" });
await page.waitForSelector('input[name="name"]', { timeout: 20000 });
await page.fill('input[name="name"]', "The Big Match 2027");
await page.fill('input[name="slug"]', "big-match-2027");
await page.setInputFiles('input[name="design"]', file);
await page.click('button:has-text("Upload and detect the square")');
await page.waitForTimeout(2500);
console.log("after upload →", page.url().replace(BASE, ""));
console.log("designs on file:", await page.locator("text=Uploaded designs").count());
await browser.close();
