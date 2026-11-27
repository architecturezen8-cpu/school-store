/**
 * Round 23 — colour dots and their names, green "in stock", seats per ticket
 * type, the hero slideshow in the admin, no navy left in the admin, and a
 * purchase that really takes stock off the shelf.
 *
 *   QA_MODULES=/tmp/qaenv/node_modules QA_LIBS=/tmp/al/lib node qa/round23.mjs
 *
 * Temporary QA script, not part of the app.
 */
import { mkdirSync } from "node:fs";
import { open, shot } from "./browser.mjs";

const BASE = process.env.BASE ?? "http://localhost:3000";
const OUT = process.env.OUT ?? "/tmp/round23";
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
    console.log(`✗ ${name} — ${String(error).slice(0, 500)}`);
  }
}

const flat = (t) => (t ?? "").replace(/\s+/g, " ").trim();

const { browser, page } = await open({ width: 1440, height: 1100 });
const pageErrors = [];
page.on("pageerror", (e) => pageErrors.push(String(e)));

const HOODIE = "crest-hoodie";

/* ---------- sign in ---------- */
await step("admin: sign in", async () => {
  await page.goto(BASE + "/admin", { waitUntil: "domcontentloaded" });
  await page.fill('input[type="password"]', PASSWORD);
  await page.locator('form:has(input[type="password"]) button[type="submit"]').click();
  await page.locator("nav#admin-sidebar").waitFor({ timeout: 20000 });
  await page.waitForTimeout(800);
  return "ok";
});

/* ---------- the database catches up ---------- */
await step("admin: the schema bar repairs the database", async () => {
  await page.goto(BASE + "/admin/hero", { waitUntil: "domcontentloaded" });
  const bar = page.getByRole("button", { name: /Update the database/i });
  if (!(await bar.count())) return "already up to date";
  await bar.first().click();
  await page.waitForTimeout(3000);
  await page.goto(BASE + "/admin/hero", { waitUntil: "domcontentloaded" });
  if (await page.getByRole("button", { name: /Update the database/i }).count()) {
    throw new Error("the repair button is still there after pressing it");
  }
  return "schema applied";
});

/* ---------- 4. the hero slideshow ---------- */
await step("hero: the admin shows what the home page is showing", async () => {
  await page.goto(BASE + "/admin/hero", { waitUntil: "domcontentloaded" });
  await page.getByRole("heading", { name: /Hero slideshow/i }).waitFor({ timeout: 20000 });
  const editable = await page.locator('article:has(input[id^="caption-"])').count();
  const previews = await page.locator("figure img").count();
  if (!editable && !previews) throw new Error("no slides and no built-in previews");
  return editable ? `${editable} editable slides` : `${previews} built-in previews`;
});

await step("hero: copy the built-in three into the database", async () => {
  const button = page.getByRole("button", { name: /Start from the current three/i });
  if (!(await button.count())) return "already stored";
  await button.click();
  await page.waitForTimeout(3000);
  await page.goto(BASE + "/admin/hero", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1500);
  if (await page.getByRole("button", { name: /Start from the current three/i }).count()) {
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForTimeout(1500);
  }
  if (await page.getByRole("button", { name: /Start from the current three/i }).count()) {
    throw new Error("the copy button is still there — nothing was written");
  }
  const count = await page.locator('article:has(input[id^="caption-"])').count();
  if (count < 3) throw new Error(`only ${count} slides after the copy`);
  return `${count} rows`;
});

await step("hero: a caption saves and reads back", async () => {
  const card = page.locator('article:has(input[id^="caption-"])').first();
  const input = card.locator('input[id^="caption-"]');
  const original = await input.inputValue();

  const attempt = async (value) => {
    await input.fill(value);
    await card.locator('button:has-text("Save")').first().click();
    // wait for the toast, not for the clock
    const toast = page.getByText(/Caption saved|Caption not saved/i).first();
    await toast.waitFor({ timeout: 20000 }).catch(() => {});
    const words = flat(await page.locator("body").innerText());
    if (/caption not saved/i.test(words)) throw new Error(words.slice(-200));
    await page.waitForTimeout(1500);
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForTimeout(1500);
    return page.locator('article input[id^="caption-"]').first().inputValue();
  };

  let next = (original + " · QA").slice(0, 120);
  let after = await attempt(next);
  if (after !== next) {
    next = (next + "2").slice(0, 120);
    after = await attempt(next);
    if (after !== next) throw new Error(`the caption read back as "${after}"`);
  }
  // put it back the way it was
  const restoreCard = page.locator('article:has(input[id^="caption-"])').first();
  await restoreCard.locator('input[id^="caption-"]').fill(original);
  await restoreCard.locator('button:has-text("Save")').first().click();
  await page.waitForTimeout(3500);
  return "saved, reloaded, still there";
});

await step("hero: the home page still draws a hero", async () => {
  await page.goto(BASE + "/", { waitUntil: "networkidle" });
  await page.waitForTimeout(1200);
  const text = flat(await page.locator("body").innerText());
  if (!/st\.?\s?thomas/i.test(text)) throw new Error("the hero did not render");
  const slides = await page.locator("img").count();
  await shot(page, "hero-home");
  return `${slides} images on the page`;
});

/* ---------- stock on the shelf, so "in stock" has something to say ---------- */
const hoodieShelf = async () => {
  await page.goto(BASE + "/admin/stock", { waitUntil: "domcontentloaded" });
  const details = page.locator("details").filter({ hasText: "Crest Hoodie" }).first();
  await details.waitFor({ timeout: 20000 });
  // Opened directly rather than by clicking: the summary is one row among many
  // and a synthetic click sometimes lands while the list is still settling.
  await details.evaluate((el) => {
    el.open = true;
  });
  const cell = details.locator('input[type="number"]').first();
  await cell.waitFor({ timeout: 15000 });
  return { details, cell, count: Number((await cell.inputValue()) || 0) };
};

/** Put a number on the hoodie's first shelf and make sure it stuck. */
const setHoodieQty = async (value) => {
  const shelf = await hoodieShelf();
  const from = shelf.count;
  await shelf.cell.scrollIntoViewIfNeeded();
  await shelf.cell.fill(String(value));
  const save = shelf.details.locator('button:has-text("Save")').first();
  await save.scrollIntoViewIfNeeded();
  await save.click({ force: true });
  await page.waitForTimeout(2500);
  let check = await hoodieShelf();
  if (check.count !== value) {
    // one retry: the first press can land while the row is still settling
    await check.cell.scrollIntoViewIfNeeded();
    await check.cell.fill(String(value));
    const again = check.details.locator('button:has-text("Save")').first();
    await again.scrollIntoViewIfNeeded();
    await again.click({ force: true });
    await page.waitForTimeout(3000);
    check = await hoodieShelf();
  }
  if (check.count !== value) throw new Error(`the shelf reads ${check.count}, not ${value}`);
  // Saving is a server action, and its redirect can land a beat later — long
  // enough to interrupt the next page.goto in the step after this one ("navigation
  // is interrupted by another navigation"). Wait for the page to go quiet.
  await page.waitForLoadState("networkidle").catch(() => {});
  await page.waitForTimeout(500);
  return { from, to: value };
};

await step("admin stocks: give the hoodie a count", async () => {
  const result = await setHoodieQty(12);
  return `${result.from} → ${result.to}`;
});

/* ---------- 2. in stock is green ---------- */
await step("shop: the in-stock line is green", async () => {
  await page.goto(BASE + "/shop", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2500);
  const lines = page.locator("span", { hasText: /^IN STOCK$/i });
  await lines.first().waitFor({ timeout: 20000 });
  const total = await lines.count();
  const colours = [];
  for (let i = 0; i < total; i++) {
    colours.push(await lines.nth(i).evaluate((el) => getComputedStyle(el).color));
  }
  const wrong = colours.filter((c) => !/rgb\(95, 220, 154\)/.test(c));
  if (wrong.length) throw new Error(`${wrong.length} of ${total} "In stock" lines are ${wrong[0]}`);
  await shot(page, "shop-in-stock");
  return `${total} green line(s): ${colours[0]}`;
});

/* ---------- 1. the colour dot and its name ---------- */
await step("product page: every colour is a dot with its name under it", async () => {
  await page.goto(`${BASE}/product/${HOODIE}`, { waitUntil: "domcontentloaded" });
  const chips = page
    .locator('button[aria-pressed]')
    .filter({ has: page.locator("span[aria-hidden]") });
  await chips.first().waitFor({ timeout: 20000 });
  const count = await chips.count();
  if (count < 2) throw new Error(`only ${count} colour buttons on the page`);
  const rows = [];
  for (let i = 0; i < count; i++) {
    const chip = chips.nth(i);
    const label = flat(await chip.innerText());
    const fill = await chip
      .locator("span[aria-hidden]")
      .first()
      .evaluate((el) => getComputedStyle(el).backgroundColor);
    if (!label) throw new Error(`chip ${i} prints no colour name`);
    if (!fill || fill === "rgba(0, 0, 0, 0)") throw new Error(`chip ${i} (${label}) has no dot`);
    if (fill === "rgb(139, 144, 153)") throw new Error(`chip ${i} (${label}) fell back to grey`);
    rows.push(`${label} ${fill}`);
  }
  await shot(page, "product-colours", false);
  return rows.join(", ");
});

await step("product page: choosing a colour keeps the name on screen", async () => {
  const chips = page
    .locator("button[aria-pressed][aria-label]")
    .filter({ has: page.locator("span[aria-hidden]") });
  const second = chips.nth(1);
  const name = flat(await second.innerText());
  await second.click();
  await page.waitForTimeout(400);
  if ((await second.getAttribute("aria-pressed")) !== "true") throw new Error("it did not become the chosen colour");
  if (flat(await second.innerText()) !== name) throw new Error("the name disappeared when it was chosen");
  return name;
});

await step("admin editor: a custom colour takes its dot from the picker", async () => {
  await page.goto(`${BASE}/admin/shop/products/${HOODIE}`, { waitUntil: "domcontentloaded" });
  await page.locator('input[aria-label="New colour"]').waitFor({ timeout: 20000 });
  // Let the editor finish loading its stock grid; typing into a form that is
  // still mounting is how a colour gets pressed into a state nobody keeps.
  await page.waitForTimeout(2000);

  /*
    A colour left behind by an earlier run is repaired, not trusted.

    This used to skip the whole picker whenever "House tie green" already
    existed — so a stale row from a session where the save did not take kept its
    navy fallback forever, and every later run failed on a colour it had just
    decided not to set.
  */
  const alreadyThere = page.locator('input[aria-label="Colour value for House tie green"]');
  if (await alreadyThere.count()) {
    const current = (await alreadyThere.first().inputValue()).toLowerCase();
    if (current !== "#2f7d4f") {
      await alreadyThere.first().evaluate((el) => {
        const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set;
        set.call(el, "#2f7d4f");
        el.dispatchEvent(new Event("input", { bubbles: true }));
        el.dispatchEvent(new Event("change", { bubbles: true }));
      });
    }
  } else {
    await page.fill('input[aria-label="New colour"]', "House tie green");
    // Setting a React-controlled input by hand needs the *native* setter;
    // assigning `el.value` updates React's tracker and the change is swallowed.
    await page.locator('input[aria-label="New colour value"]').evaluate((el) => {
      const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set;
      set.call(el, "#2f7d4f");
      el.dispatchEvent(new Event("input", { bubbles: true }));
      el.dispatchEvent(new Event("change", { bubbles: true }));
    });
    const picked = await page.locator('input[aria-label="New colour value"]').inputValue();
    if (picked !== "#2f7d4f") throw new Error(`the picker holds ${picked}`);
    await page.locator('button[aria-label="Add colour"]').click();
    await alreadyThere.first().waitFor({ timeout: 10000 });
  }

  await page.getByRole("button", { name: /^Save$|Add to the shop/i }).first().click();
  await page.waitForTimeout(5000);

  let found = 0;
  for (let attempt = 0; attempt < 5 && !found; attempt++) {
    await page.goto(`${BASE}/product/${HOODIE}`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(1500);
    found = await page.locator('button[aria-label^="House tie green"]').count();
    if (!found) await page.waitForTimeout(2000);
  }
  if (!found) throw new Error("the shop does not offer the new colour");

  const chip = page.locator('button[aria-label^="House tie green"]').first();
  const fill = await chip
    .locator("span[aria-hidden]")
    .first()
    .evaluate((el) => getComputedStyle(el).backgroundColor);
  if (fill !== "rgb(47, 125, 79)") throw new Error(`the dot is ${fill}, not the picked #2f7d4f`);
  if (!flat(await chip.innerText()).includes("House tie green")) throw new Error("the name is missing");
  return "#2f7d4f kept through the save";
});

/* ---------- 6. a purchase really takes one off the shelf ---------- */
await step("a purchase takes one off the shelf", async () => {
  const start = await hoodieShelf();
  const before = start.count;
  if (before < 2) throw new Error(`the shelf only holds ${before}`);

  // buy one through the shop, the way a customer would
  await page.goto(`${BASE}/product/${HOODIE}`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2000);
  const add = page.getByRole("button", { name: /add to bag/i }).first();
  await add.click();
  await page.waitForTimeout(600);
  await page.locator('button[aria-label="Open shopping bag"]').first().click();
  await page.waitForTimeout(600);
  await page.getByRole("button", { name: /checkout/i }).first().click();
  await page.waitForTimeout(800);
  await page.fill('input[aria-label="Full name"]', "QA Buyer");
  await page.fill('input[aria-label="Email"]', "qa@example.com");
  await page.getByRole("button", { name: /place order/i }).first().click();
  await page.waitForTimeout(6000);

  const end = await hoodieShelf();
  const now = end.count;
  if (now !== before - 1) throw new Error(`the shelf went ${before} → ${now}, expected ${before - 1}`);
  return `${before} → ${now}`;
});

/* ---------- 6b. a burst of buyers cannot oversell ---------- */
await step("a burst of ten buyers takes exactly the stock that exists", async () => {
  // Three shirts on the shelf, ten people pressing Place order at once.
  await setHoodieQty(3);

  const body = {
    name: "Burst Buyer",
    email: "burst@example.com",
    phone: "",
    note: "",
    // The first shelf cell of the hoodie is Navy / S — the one setHoodieQty drives.
    items: [{ slug: HOODIE, qty: 1, colour: "Navy", size: "S", variant: "Navy / S" }],
  };

  const results = await Promise.all(
    Array.from({ length: 10 }, () =>
      page.request.post(`${BASE}/api/orders`, { data: body, failOnStatusCode: false })
    )
  );
  const codes = results.map((r) => r.status()).sort((a, b) => a - b);
  const created = codes.filter((c) => c === 201).length;
  const refused = codes.filter((c) => c === 409).length;
  const other = codes.filter((c) => c !== 201 && c !== 409);

  if (other.length) throw new Error(`unexpected statuses ${other.join(",")}`);
  if (created !== 3) throw new Error(`${created} of 10 orders were accepted, expected 3`);
  if (refused !== 7) throw new Error(`${refused} were refused, expected 7`);

  const after = await hoodieShelf();
  if (after.count !== 0) throw new Error(`the shelf holds ${after.count}, not 0`);
  return "10 at once → 3 sold, 7 refused, shelf empty";
});

/* ---------- 3. seats per ticket type ---------- */
await step("event editor: a seats box beside each ticket type", async () => {
  await page.goto(BASE + "/admin/events/the-big-match", { waitUntil: "domcontentloaded" });
  const seats = page.locator('input[aria-label$="seats"]');
  if (!(await seats.count())) throw new Error("no seats box on the ticket types");
  await shot(page, "event-seats");
  return `${await seats.count()} ticket type(s) with a seats box`;
});

await step("event editor: a cap saves and comes back", async () => {
  const read = async () => {
    await page.goto(BASE + "/admin/events/the-big-match", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(1200);
    return page.locator('input[aria-label$="seats"]').first().inputValue();
  };

  const original = await read();
  let saved = "";
  for (let attempt = 0; attempt < 3 && saved !== "123"; attempt++) {
    await page.locator('input[aria-label$="seats"]').first().fill("123");
    await page.getByRole("button", { name: /Save changes/i }).first().click();
    await page.waitForTimeout(4500);
    saved = await read();
  }
  if (saved !== "123") throw new Error(`the cap read back as "${saved}"`);

  // put the shelf back the way it was
  await page.locator('input[aria-label$="seats"]').first().fill(original);
  await page.getByRole("button", { name: /Save changes/i }).first().click();
  await page.waitForTimeout(4000);
  return "123 saved and read back";
});

/* ---------- 5. no navy in the admin ---------- */
await step("admin: no navy surface left anywhere", async () => {
  const pages = [
    "/admin",
    "/admin/shop",
    "/admin/stock",
    "/admin/events",
    "/admin/bookings",
    "/admin/mail",
    "/admin/settings",
    "/admin/hero",
    "/admin/shop/filters",
    "/admin/shop/categories",
  ];

  const NAVY = [
    "rgb(4, 6, 13)", // ink and the storefront navies
    "rgb(6, 10, 22)",
    "rgb(10, 18, 36)",
    "rgb(15, 26, 51)",
    "rgb(22, 36, 74)",
    "rgb(30, 48, 96)",
  ];
  const offenders = [];
  for (const path of pages) {
    await page.goto(BASE + path, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(600);
    const found = await page.evaluate((navy) => {
      const hits = [];
      for (const el of document.querySelectorAll("#admin-root *")) {
        const s = getComputedStyle(el);
        const paint = s.backgroundColor + " " + s.backgroundImage;
        for (const n of navy) {
          if (paint.includes(n)) {
            hits.push(`${el.tagName}.${String(el.className).slice(0, 50)} ${paint.slice(0, 80)}`);
            break;
          }
        }
      }
      return hits.slice(0, 4);
    }, NAVY);
    if (found.length) offenders.push(`${path}: ${found.join(" | ")}`);
  }
  if (offenders.length) throw new Error(offenders.join(" ;; "));
  return `${pages.length} pages clean`;
});

await shot(page, "admin-last", false);

const passed = steps.filter((s) => s.ok).length;
console.log(`\n${passed}/${steps.length} steps passed`);
if (pageErrors.length) console.log("page errors:", pageErrors.slice(0, 5));

await browser.close();
process.exitCode = passed === steps.length ? 0 : 1;
