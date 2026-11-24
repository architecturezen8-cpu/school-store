/**
 * Uploads a real design through the admin form and then buys a ticket to prove
 * the uploaded artwork is what the customer receives.
 */
import fs from "node:fs";
import { createHmac } from "node:crypto";
import sharp from "sharp";
import { open } from "./browser.mjs";

const BASE = "http://localhost:3000";
const OUT = "/tmp/qa-upload";
fs.mkdirSync(OUT, { recursive: true });

// A 1600x900 design (16:9, not a square) with one plain white square for the QR.
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="900">
  <rect width="1600" height="900" fill="#0b1b33"/>
  <rect x="0" y="0" width="1600" height="8" fill="#d4af37"/>
  <text x="90" y="180" font-family="serif" font-size="86" fill="#d4af37">THE BIG MATCH</text>
  <text x="90" y="250" font-family="sans-serif" font-size="34" fill="#c9d4e6">St. Thomas' College Matale</text>
  <text x="90" y="700" font-family="sans-serif" font-size="26" fill="#8fa3c0">Saturday, 9 January 2027</text>
  <text x="90" y="750" font-family="sans-serif" font-size="26" fill="#8fa3c0">College Grounds, Matale</text>
  <rect x="1120" y="330" width="380" height="380" fill="#ffffff"/>
</svg>`;

const design = `${OUT}/design.png`;
await sharp(Buffer.from(svg)).png().toFile(design);
console.log("design:", (await sharp(design).metadata()).width + "×" + (await sharp(design).metadata()).height);

const { browser, page, errors } = await open({ width: 1440, height: 1200 });

// sign in
await page.goto(`${BASE}/admin`, { waitUntil: "domcontentloaded" });
await page.fill('input[type="password"]', "thomian2026");
await page.click('button[type="submit"]');
await page.waitForTimeout(2500);
console.log("signed in:", page.url());

// upload
await page.goto(`${BASE}/admin/templates`, { waitUntil: "networkidle" });
await page.fill('input[name="name"]', "QA Big Match Design");
await page.fill('input[name="slug"]', "qa-big-match");
await page.selectOption('select[name="event"]', "the-big-match").catch(() => {});
const fileInput = page.locator('input[type="file"]');
await fileInput.setInputFiles(design);
await page.locator('form button[type="submit"]').first().click();
await page.waitForTimeout(4000);
const text = (await page.locator("body").innerText()).replace(/\s+/g, " ");
console.log("after upload:", page.url());
console.log("  →", text.slice(text.indexOf("Ticket designs"), text.indexOf("Ticket designs") + 600));
await page.screenshot({ path: `${OUT}/templates.png`, fullPage: true });

// buy a ticket and look at what the customer gets
const res = await page.request.post(`${BASE}/api/bookings`, {
  data: {
    event: "the-big-match",
    name: "Design Check",
    email: "design@example.com",
    tiers: [{ id: "pavilion", qty: 1 }],
  },
});
const body = await res.json();
const token = body.booking.token;
const sig = createHmac("sha256", "local-review-secret-please-change")
  .update(`ticket:${token}`)
  .digest("base64url")
  .slice(0, 22);

const img = await page.request.get(`${BASE}/api/tickets/${token}/image?s=${sig}`);
const buf = await img.body();
fs.writeFileSync(`${OUT}/ticket.png`, buf);
const meta = await sharp(buf).metadata();
console.log("ticket image:", meta.format, meta.width + "×" + meta.height, buf.length + " bytes");
await page.goto(`${BASE}/t/${token}?s=${sig}`, { waitUntil: "networkidle" });
await page.screenshot({ path: `${OUT}/ticket-page.png`, fullPage: true });

console.log("errors:", errors.length ? errors : "none");
await browser.close();
