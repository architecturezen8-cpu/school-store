/**
 * Round 21 review — the shop's own admin, the catalogue's corrections, and the
 * visual pass.
 *
 *   · products, categories and filters are editable from the admin, and the
 *     storefront follows within a reload
 *   · the catalogue's own mistakes are gone: no badge sells a colour, the mug is
 *     not clothing, paper is not "Navy", a pen's ink is an option called Ink
 *   · the shop offers colour and size chips, and they actually narrow the shelf
 *   · the sidebar is grouped, and one section is active at a time
 *
 * Temporary QA script, not part of the app.
 *   QA_MODULES=/tmp/qaenv/node_modules QA_LIBS=/tmp/al/lib node qa/shop-admin.mjs
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { open } from "./browser.mjs";

const BASE = process.env.BASE ?? "http://localhost:3000";
const OUT = process.env.OUT ?? "/tmp/shop21";
const PASSWORD = process.env.ADMIN_PASSWORD ?? "thomian2026";
mkdirSync(OUT, { recursive: true });

const steps = [];
async function step(name, fn) {
  const started = Date.now();
  try {
    const note = await fn();
    steps.push({ name, ok: true, note });
    console.log(`✓ ${name}${note ? ` — ${note}` : ""} (${Date.now() - started}ms)`);
  } catch (error) {
    steps.push({ name, ok: false, note: String(error).slice(0, 300) });
    console.log(`✗ ${name} — ${String(error).slice(0, 400)}`);
  }
}
const flat = (t) => (t ?? "").replace(/\s+/g, " ").trim();

const { browser, page } = await open({ width: 1440, height: 1000 });
const pageErrors = [];
page.on("pageerror", (e) => pageErrors.push(String(e)));

/* ---------- sign in ---------- */
await step("admin: sign in", async () => {
  await page.goto(BASE + "/admin", { waitUntil: "domcontentloaded" });
  await page.fill('input[type="password"]', PASSWORD);
  await page.locator('form:has(input[type="password"]) button[type="submit"]').click();
  await page.waitForURL(/\/admin(\?|$)/, { timeout: 20000 }).catch(() => {});
  await page.locator("nav#admin-sidebar").waitFor({ timeout: 20000 });
  if (!/products/i.test(flat(await page.locator("body").innerText()))) throw new Error("not in");
  return "ok";
});

/* ---------- the sidebar ---------- */
await step("the sidebar is grouped, with one section active", async () => {
  await page.goto(BASE + "/admin/shop", { waitUntil: "networkidle" });
  const nav = await page.locator("nav#admin-sidebar").innerText();
  const groups = ["overview", "the shop", "tickets", "messages", "settings"];
  const missing = groups.filter((g) => !nav.toLowerCase().includes(g));
  if (missing.length) throw new Error("missing groups: " + missing.join(", "));
  const active = page.locator("nav#admin-sidebar a[aria-current='page']");
  if ((await active.count()) !== 1) throw new Error(`${await active.count()} active links`);
  const label = flat(await active.first().innerText());
  if (!/products/i.test(label)) throw new Error(`active is ${label}`);
  return `${groups.length} groups · ${label}`;
});

/* ---------- the shelf ---------- */
await step("the products page is a shelf of pictures", async () => {
  const cards = page.locator("li[data-product]");
  const n = await cards.count();
  if (n < 15) throw new Error(`${n} product cards`);
  const first = cards.first();
  if (!(await first.locator("img").count())) throw new Error("no picture on the first card");
  return `${n} cards`;
});

await step("every collection is offered, including the new one", async () => {
  const text = flat(await page.locator("body").innerText());
  for (const title of ["Badges", "Uniforms", "Event Clothings", "Gifts & Souvenirs", "Exam Writing Papers", "Batch Shirts"]) {
    if (!text.includes(title)) throw new Error("no " + title);
  }
  return "six collections";
});

/* ---------- the corrections ---------- */
await step("a badge offers no colour, and none is for sale in 'Gold'", async () => {
  await page.goto(BASE + "/product/prefect-badge", { waitUntil: "networkidle" });
  const text = flat(await page.locator("body").innerText());
  if (/colours?/i.test(text) && /gold\s+silver/i.test(text)) throw new Error("still two colours");
  if (/\bSilver\b/.test(text)) throw new Error("silver still offered");
  return "one finish";
});

await step("the mug is in Gifts & Souvenirs, not in clothing", async () => {
  await page.goto(BASE + "/admin/shop?category=souvenirs", { waitUntil: "networkidle" });
  const text = flat(await page.locator("body").innerText());
  if (!text.includes("Heritage Crest Mug")) throw new Error("mug not in souvenirs");
  return "moved";
});

await step("paper has no colour, and a pen's blue is called Ink", async () => {
  await page.goto(BASE + "/product/exam-pen-pack", { waitUntil: "networkidle" });
  const pen = flat(await page.locator("body").innerText());
  if (!/\bInk\b/i.test(pen)) throw new Error("pen pack has no Ink option");
  await page.goto(BASE + "/product/geometry-set", { waitUntil: "networkidle" });
  const geo = flat(await page.locator("body").innerText());
  if (/\bColour\b/i.test(geo)) throw new Error("geometry set still has a colour");
  return "Ink yes, colour no";
});

/* ---------- the storefront filters ---------- */
await step("the shop offers colour and size chips", async () => {
  await page.goto(BASE + "/shop", { waitUntil: "networkidle" });
  const text = flat(await page.locator("body").innerText());
  if (!/Colour/i.test(text)) throw new Error("no colour row");
  if (!/Size/i.test(text)) throw new Error("no size row");
  if (!/Navy/.test(text) || !/XXL/.test(text)) throw new Error("chips missing");
  return "colour + size";
});

await step("a colour chip narrows the shelf", async () => {
  await page.goto(BASE + "/shop", { waitUntil: "networkidle" });
  const count = async () => {
    const t = flat(await page.locator("body").innerText());
    return Number(t.match(/Showing (\d+) of (\d+)/)?.[1] ?? -1);
  };
  const before = await count();
  await page.getByRole("button", { name: /Navy/i }).first().click();
  await page.waitForTimeout(400);
  const after = await count();
  if (!(after > 0 && after < before)) throw new Error(`Navy went ${before} → ${after}`);
  await page.getByRole("button", { name: /Clear filters/i }).click();
  await page.waitForTimeout(300);
  if ((await count()) !== before) throw new Error("clear did not restore");
  return `${before} → ${after} → ${before}`;
});

/* ---------- write: a product ---------- */
const NAME = `Review Tee ${Date.now().toString(36).toUpperCase()}`;
let slug = "";
const shot = "/tmp/qa-shirt.jpg";
writeFileSync(shot, Buffer.from(""));
await step("add a product from the editor", async () => {
  await page.goto(BASE + "/admin/shop/products/new", { waitUntil: "networkidle" });
  await page.locator('input[placeholder="Crest Hoodie"]').fill(NAME);
  await page.locator('select').first().selectOption("event-clothings");
  await page.locator('input[type="number"]').first().fill("1990");
  await page.locator("textarea").first().fill("A tee added by the review suite.");
  // size chips
  await page.getByRole("button", { name: "M", exact: true }).first().click();
  await page.getByRole("button", { name: "L", exact: true }).first().click();
  // colour chips
  await page.getByRole("button", { name: "Navy", exact: true }).first().click();
  await page.getByRole("button", { name: /Add to the shop/i }).click();
  // `/admin/shop/products/new` also matches the route pattern, so wait for a
  // different address rather than for "a product page".
  await page.waitForURL(
    (url) => url.pathname.startsWith("/admin/shop/products/") && !url.pathname.endsWith("/new"),
    { timeout: 25000 }
  );
  slug = new URL(page.url()).pathname.split("/").pop();
  if (!slug) throw new Error("no slug in " + page.url());
  return slug;
});

await step("it is on the storefront, with its chips", async () => {
  await page.goto(`${BASE}/product/${slug}`, { waitUntil: "networkidle" });
  const text = flat(await page.locator("body").innerText());
  if (!text.includes(NAME)) throw new Error("name missing");
  if (!/LKR 1,990/.test(text)) throw new Error("price missing");
  if (!/Size/i.test(text) || !/Navy/i.test(text)) throw new Error("options missing");
  return "listed";
});

await step("editing the price shows within a reload", async () => {
  await page.goto(`${BASE}/admin/shop/products/${slug}`, { waitUntil: "networkidle" });
  await page.locator('input[type="number"]').first().fill("2490");
  await page.getByRole("button", { name: /^Save$/ }).click();
  await page.waitForTimeout(1800);
  await page.goto(`${BASE}/product/${slug}`, { waitUntil: "networkidle" });
  const text = flat(await page.locator("body").innerText());
  if (!/LKR 2,490/.test(text)) throw new Error("price not updated");
  return "LKR 2,490";
});

await step("hiding it takes it out of the shop", async () => {
  await page.goto(`${BASE}/admin/shop?category=event-clothings`, { waitUntil: "networkidle" });
  const card = page.locator(`li[data-product="${slug}"]`);
  await card.locator('button:has-text("Hide")').click();
  await page.waitForLoadState("networkidle").catch(() => {});
  await page.waitForTimeout(1200);
  await page.goto(`${BASE}/shop`, { waitUntil: "networkidle" });
  if (flat(await page.locator("body").innerText()).includes(NAME)) throw new Error("still listed");
  return "hidden";
});

/* ---------- write: a category ---------- */
const CAT = `Review Collection ${Date.now().toString(36).toUpperCase()}`;
let catSlug = "";
await step("create a category", async () => {
  await page.goto(BASE + "/admin/shop/categories/new", { waitUntil: "networkidle" });
  await page.locator('input[name="title"]').fill(CAT);
  await page.locator('input[name="blurb"]').fill("Made by the review suite");
  await page.locator('input[name="imageUrl"]').fill("/images/product-mug.jpg");
  await page.getByRole("button", { name: /Create category/i }).click();
  await page.waitForURL(
    (url) =>
      url.pathname.startsWith("/admin/shop/categories/") && !url.pathname.endsWith("/new"),
    { timeout: 25000 }
  );
  catSlug = new URL(page.url()).pathname.split("/").pop();
  return catSlug;
});

await step("a category that still holds a product refuses to go", async () => {
  // Put the review product into the review category, then try to delete it.
  await page.goto(`${BASE}/admin/shop/products/${slug}`, { waitUntil: "networkidle" });
  await page.locator("select").first().selectOption(catSlug);
  await page.getByRole("button", { name: /^Save$/ }).click();
  await page.waitForTimeout(1800);

  page.once("dialog", (d) => d.accept().catch(() => {}));
  await page.goto(`${BASE}/admin/shop/categories/${catSlug}`, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: /Remove category/i }).click();
  await page.waitForTimeout(1500);
  const text = flat(await page.locator("body").innerText());
  if (!/still holds 1 product/i.test(text)) throw new Error("no refusal: " + text.slice(0, 200));
  return "refused, with the count";
});

/* ---------- write: a filter ---------- */
await step("add a colour filter and see it offered", async () => {
  await page.goto(BASE + "/admin/shop/filters", { waitUntil: "networkidle" });
  await page.locator('input[name="label"]').first().fill("Teal");
  await page.getByRole("button", { name: /^Add$/ }).click();
  // Wait for the row rather than a fixed pause: the redirect and the re-render
  // can take a second under load, and a flaky wait reads as a broken filter.
  const row = page.locator('li[data-filter="Teal"]');
  await row.first().waitFor({ timeout: 20000 });
  // Nothing is teal, so the shop must not offer the chip.
  await page.goto(BASE + "/shop", { waitUntil: "networkidle" });
  const text = flat(await page.locator("body").innerText());
  if (/\bTeal\b/.test(text)) throw new Error("Teal offered with no product behind it");
  return "stored, not advertised";
});

await step("delete the filter again", async () => {
  page.once("dialog", (d) => d.accept().catch(() => {}));
  await page.goto(BASE + "/admin/shop/filters", { waitUntil: "networkidle" });
  const row = page.locator('li[data-filter="Teal"]');
  await row.locator('button[aria-label="Delete Teal"]').click();
  await page.waitForTimeout(1500);
  if ((await page.locator('li[data-filter="Teal"]').count()) !== 0) throw new Error("still there");
  return "gone";
});

/* ---------- tidy up ---------- */
await step("move the product out and remove both", async () => {
  await page.goto(`${BASE}/admin/shop/products/${slug}`, { waitUntil: "networkidle" });
  await page.locator("select").first().selectOption("event-clothings");
  await page.getByRole("button", { name: /^Save$/ }).click();
  await page.waitForTimeout(1600);

  page.once("dialog", (d) => d.accept().catch(() => {}));
  await page.getByRole("button", { name: /^Remove$/ }).click();
  await page.waitForTimeout(1800);

  page.once("dialog", (d) => d.accept().catch(() => {}));
  await page.goto(`${BASE}/admin/shop/categories/${catSlug}`, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: /Remove category/i }).click();
  await page.waitForURL(/\/admin\/shop\/categories(\?|$)/, { timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(800);
  const text = flat(await page.locator("body").innerText());
  if (text.includes(CAT)) throw new Error("category still listed");
  return "cleaned up";
});

/* ---------- console ---------- */
await step("no page errors on the new screens", async () => {
  for (const path of ["/admin", "/admin/shop", "/admin/shop/categories", "/admin/shop/filters"]) {
    await page.goto(BASE + path, { waitUntil: "networkidle" });
  }
  if (pageErrors.length) throw new Error(pageErrors.join(" | ").slice(0, 220));
  return "clean";
});

await page.goto(BASE + "/admin/shop", { waitUntil: "networkidle" });
await page.screenshot({ path: `${OUT}/qa-shop.png`, fullPage: false });
await browser.close();

const failed = steps.filter((s) => !s.ok);
console.log(
  `\n${steps.length - failed.length}/${steps.length} passed${failed.length ? ` — ${failed.length} failed` : ""}`
);
process.exit(failed.length ? 1 : 0);
