/**
 * End-to-end flows in a real browser: add to bag → checkout → track order,
 * search overlay, and ticket booking.
 *
 * Usage: node qa/e2e.mjs
 */
import { open } from "./browser.mjs";

const BASE = process.env.BASE ?? "http://localhost:3000";
const { browser, page, errors } = await open({ width: 1440, height: 950 });
const step = (n, msg) => console.log(`\n[${n}] ${msg}`);

/* ---------- 1. product page → add to bag ---------- */
step(1, "product page");
await page.goto(BASE + "/product/crest-hoodie", { waitUntil: "networkidle" });
console.log("h1:", await page.locator("h1").first().innerText());
const sizeButtons = await page.locator("button", { hasText: /^(S|M|L|XL)$/ }).count();
console.log("size buttons:", sizeButtons);
await page.getByRole("button", { name: /^(M)$/ }).first().click();
await page.getByRole("button", { name: /add to bag/i }).first().click();
await page.waitForTimeout(900);
await page.screenshot({ path: "/tmp/qa/e2e-1-added.png" });
const bagBadge = await page.locator('button[aria-label="Open shopping bag"]').innerText().catch(() => "");
console.log("bag badge text:", JSON.stringify(bagBadge));

/* ---------- 2. open the bag ---------- */
step(2, "bag drawer");
await page.locator('button[aria-label="Open shopping bag"]').click();
await page.waitForTimeout(800);
await page.screenshot({ path: "/tmp/qa/e2e-2-bag.png" });
const bagText = await page.locator("body").innerText();
console.log("bag shows hoodie:", /Crest Hoodie/.test(bagText), "| subtotal:", /4,500/.test(bagText));

/* ---------- 3. checkout ---------- */
step(3, "checkout");
await page.getByRole("button", { name: /checkout|proceed/i }).first().click();
await page.waitForTimeout(1200);
await page.screenshot({ path: "/tmp/qa/e2e-3-checkout.png" });
const fields = await page.evaluate(() =>
  [...document.querySelectorAll("input, select, textarea")].map(
    (el) => `${el.tagName.toLowerCase()}[name=${el.getAttribute("name")}] type=${el.getAttribute("type")}`
  )
);
console.log("fields:", fields.slice(0, 14));

await page.getByPlaceholder(/full name/i).fill("Nimal Perera");
await page.getByPlaceholder(/email/i).fill("nimal@example.com");
await page.getByPlaceholder(/phone/i).fill("0771234567");
await page.getByPlaceholder(/address/i).fill("12 Temple Road, Matale");
await page.waitForTimeout(300);
await page.screenshot({ path: "/tmp/qa/e2e-3b-filled.png" });

const placeOrder = page.getByRole("button", { name: /place order|pay|complete|confirm/i }).first();
await placeOrder.click();
await page.waitForTimeout(3000);
await page.screenshot({ path: "/tmp/qa/e2e-4-placed.png" });
const placedText = await page.locator("body").innerText();
const ref = placedText.match(/STC-\d{5}/)?.[0];
console.log("order reference:", ref ?? "NOT FOUND");

/* ---------- 4. track that order ---------- */
step(4, "track order");
if (ref) {
  await page.goto(BASE + "/", { waitUntil: "networkidle" });
  await page.getByRole("button", { name: /track my order/i }).first().click();
  await page.waitForTimeout(600);
  await page.locator('input[placeholder*="STC"]').first().fill(ref);
  await page.locator('input[type="email"]').last().fill("nimal@example.com");
  await page.getByRole("button", { name: /track/i }).last().click();
  await page.waitForTimeout(2500);
  await page.screenshot({ path: "/tmp/qa/e2e-5-tracked.png" });
  const tracked = await page.locator("body").innerText();
  console.log("tracked ok:", tracked.includes(ref), "| has timeline:", /placed|confirmed|processing/i.test(tracked));
}

/* ---------- 5. search ---------- */
step(5, "search");
await page.goto(BASE + "/shop", { waitUntil: "networkidle" });
await page.locator('button[aria-label="Search the store"]:visible').click();
await page.waitForTimeout(600);
await page.keyboard.type("hoodie");
await page.waitForTimeout(1200);
await page.screenshot({ path: "/tmp/qa/e2e-6-search.png" });
const searchText = await page.locator("body").innerText();
console.log("search found hoodie:", /Crest Hoodie/i.test(searchText));

/* ---------- 6. ticket booking ---------- */
step(6, "ticket booking");
await page.goto(BASE + "/tickets", { waitUntil: "networkidle" });
await page.getByRole("button", { name: /book|select|choose/i }).first().click();
await page.waitForTimeout(1500);
await page.screenshot({ path: "/tmp/qa/e2e-7-booking.png" });
const bookingText = await page.locator("body").innerText();
console.log("booking dialog:", /book|ticket|seat|quantity/i.test(bookingText));

console.log("\nERRORS:", errors.length ? errors.slice(0, 4) : "none");
await browser.close();
