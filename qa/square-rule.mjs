/**
 * The white-square rule, end to end through the admin form.
 *
 *  1. Upload the design that produced the "83px" complaint → refused, with a
 *     message that says what to make the square.
 *  2. Upload a design that follows that advice → accepted.
 *  3. Buy a ticket → the artwork decodes, the QR stays inside the square, both
 *     ticket links work, and the QR close-up the email embeds decodes at the
 *     size the mail shows it.
 *
 *   QA_MODULES=/tmp/qaenv/node_modules QA_LIBS=/tmp/al/lib node qa/square-rule.mjs
 */
import fs from "node:fs";
import sharp from "sharp";
import jsQR from "jsqr";
import { open } from "./browser.mjs";

const BASE = process.env.BASE ?? "http://localhost:3000";
const OUT = "/tmp/qa-square";
fs.mkdirSync(OUT, { recursive: true });

/** 1440×900 artwork with a square of `sq` px in the same place each time. */
async function design(sq, name) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1440" height="900">
    <rect width="1440" height="900" fill="#0b1b33"/>
    <rect x="0" y="0" width="1440" height="8" fill="#d4af37"/>
    <text x="80" y="180" font-family="serif" font-size="86" fill="#d4af37">THE BIG MATCH</text>
    <text x="80" y="250" font-family="sans-serif" font-size="34" fill="#c9d4e6">St. Thomas' College Matale</text>
    <text x="80" y="700" font-family="sans-serif" font-size="26" fill="#8fa3c0">Saturday, 9 January 2027</text>
    <rect x="${1330 - sq}" y="${Math.round(450 - sq / 2)}" width="${sq}" height="${sq}" fill="#ffffff"/>
  </svg>`;
  const file = `${OUT}/${name}.png`;
  await sharp(Buffer.from(svg)).png().toFile(file);
  return file;
}

const SMALL = 83;
const GOOD = 320;
const small = await design(SMALL, "square-83");
const good = await design(GOOD, "square-320");

const { browser, page, errors } = await open({ width: 1440, height: 1200 });
const results = [];
const check = (label, ok, detail = "") => {
  results.push(ok);
  console.log(`${ok ? "✓" : "✗"} ${label}${detail ? " — " + detail : ""}`);
};

await page.goto(`${BASE}/admin`, { waitUntil: "domcontentloaded" });
await page.fill('input[type="password"]', "thomian2026");
await page.locator('form:has(input[type="password"]) button[type="submit"]').click();
await page.waitForTimeout(2500);

async function upload(file, name, slug) {
  await page.goto(`${BASE}/admin/templates`, { waitUntil: "networkidle" });
  await page.fill('input[name="name"]', name);
  await page.fill('input[name="slug"]', slug);
  await page.selectOption('select[name="event"]', "the-big-match").catch(() => {});
  await page.locator('input[type="file"]').setInputFiles(file);
  // Scoped to the upload form: the sidebar has its own submit button (sign out),
  // and `form button` would find that one first.
  await page.locator('form:has(input[name="design"]) button[type="submit"]').click();
  await page.waitForTimeout(3500);
  return page.url().replace(BASE, "");
}

// ---- 1. a square that is too small is refused, and the advice is usable
const stamp = Date.now() % 1000000;
const tooSmall = await upload(small, "QA 83px square", `qa-small-${stamp}`);
const message = decodeURIComponent(
  (tooSmall.split("error=")[1] ?? "").replace(/\+/g, " ")
);
check("83px square is refused", tooSmall.includes("error="), message);
check(
  "the refusal names a size to use",
  /at least\s+\d+px/i.test(message),
  message.match(/at least\s+\d+px/i)?.[0] ?? "no size in the message"
);

// ---- 2. a design that follows the advice is accepted
const accepted = await upload(good, "QA 320px square", `qa-good-${stamp}`);
check("320px square is accepted", accepted.includes("ok="), accepted);

// ---- 3. the ticket this design produces
const res = await page.request.post(`${BASE}/api/bookings`, {
  data: {
    event: "the-big-match",
    name: "Square Check",
    email: "square@example.com",
    tiers: [{ id: "pavilion", qty: 1 }],
  },
});
const body = await res.json();
const { token, signature } = body.booking;
check("booking returns a signature", Boolean(token && signature), `/t/${token}/${signature}`);

const img = await page.request.get(`${BASE}/api/tickets/${token}/image?s=${signature}`);
const png = await img.body();
fs.writeFileSync(`${OUT}/ticket.png`, png);

const decode = async (buf, width) => {
  let out = buf;
  if (width) out = await sharp(buf).resize({ width }).png().toBuffer();
  const raw = await sharp(out).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return jsQR(new Uint8ClampedArray(raw.data), raw.info.width, raw.info.height)?.data ?? null;
};

const full = await decode(png);
check("artwork QR decodes at full size", Boolean(full), full ?? "");
check(
  "artwork QR carries the new short link",
  Boolean(full?.includes("/t/") && !full?.includes("?s=")),
  full ?? ""
);

// the mail shows the artwork at 552px
const at552 = await decode(png, 552);
check("artwork QR decodes at the 552px the email uses", Boolean(at552));

// ---- 4. the close-up the email embeds inline, at 220px
const meta = await sharp(png).metadata();
const squareLeft = 1330 - GOOD;
const squareTop = Math.round(450 - GOOD / 2);
const closeUp = await sharp(png)
  .extract({ left: squareLeft, top: squareTop, width: GOOD, height: GOOD })
  .png()
  .toBuffer();
fs.writeFileSync(`${OUT}/qr-close-up.png`, closeUp);
const at220 = await decode(closeUp, 220);
check("QR close-up decodes at the 220px the email shows", Boolean(at220), at220 ?? "");

// ---- 5. the QR must not have spilled onto the artwork
const { data, info } = await sharp(png).removeAlpha().raw().toBuffer({ resolveWithObject: true });
let spilled = 0;
for (let y = squareTop; y < squareTop + GOOD; y++) {
  for (let x = 0; x < squareLeft - 4; x++) {
    const i = (y * info.width + x) * 3;
    if (data[i] < 40 && data[i + 1] < 40 && data[i + 2] < 40) spilled++;
  }
}
check("QR stays inside the white square", spilled === 0, `${spilled} px outside`);
check("artwork keeps the design's size", meta.width === 1440 && meta.height === 900, `${meta.width}×${meta.height}`);

// ---- 6. both link shapes open the ticket
await page.goto(`${BASE}/t/${token}/${signature}`, { waitUntil: "networkidle" });
const shortLink = (await page.locator("h1").first().innerText()).replace(/\s+/g, " ");
check("short link opens the ticket", !/not valid/i.test(shortLink), shortLink.slice(0, 50));

await page.goto(`${BASE}/t/${token}?s=${signature}`, { waitUntil: "networkidle" });
const oldLink = (await page.locator("h1").first().innerText()).replace(/\s+/g, " ");
check("older ?s= links still open it", !/not valid/i.test(oldLink), oldLink.slice(0, 50));

await page.goto(`${BASE}/t/${token}/wrongsignature`, { waitUntil: "networkidle" });
const bad = (await page.locator("h1").first().innerText()).replace(/\s+/g, " ");
check("a wrong signature is still refused", /not valid/i.test(bad));

await page.screenshot({ path: `${OUT}/templates.png`, fullPage: true, caret: "initial" });
console.log(`\n${results.filter(Boolean).length}/${results.length} checks passed`);
console.log("browser errors:", errors.length ? errors : "none");
await browser.close();
process.exit(results.every(Boolean) ? 0 : 1);
