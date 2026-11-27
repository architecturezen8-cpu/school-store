/**
 * Round 22 — stock control, custom colours and sizes, the sliding quick view,
 * the tab icon, and the admin's last navy surfaces.
 *
 *   · a product can carry a size and a colour the filters have never heard of
 *   · stock is set when the product is edited, and on its own Stocks screen
 *   · stock is counted per colour × size, and the shop refuses to oversell it
 *   · "Only N left" / "Sold out" reaches the card, the quick view and the page
 *   · ticket tiers get the same treatment: a seat cap and "N left"
 *   · the tab icon is uploaded in the admin and lands in <link rel="icon">
 *   · the admin has no storefront navy left in it
 *
 * Temporary QA script, not part of the app.
 *   QA_MODULES=/tmp/qaenv/node_modules QA_LIBS=/tmp/al/lib node qa/stock.mjs
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { open, shot } from "./browser.mjs";

const BASE = process.env.BASE ?? "http://localhost:3000";
const OUT = process.env.OUT ?? "/tmp/stock22";
const PASSWORD = process.env.ADMIN_PASSWORD ?? "thomian2026";
mkdirSync(OUT, { recursive: true });
mkdirSync(".arena", { recursive: true });

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
const body = async (page) => flat(await page.locator("body").innerText()).toLowerCase();

const { browser, page } = await open({ width: 1440, height: 1100 });
const pageErrors = [];
page.on("pageerror", (e) => pageErrors.push(String(e)));

const SLUG = "crest-hoodie";

/* ---------- sign in ---------- */
await step("admin: sign in", async () => {
  await page.goto(BASE + "/admin", { waitUntil: "domcontentloaded" });
  await page.fill('input[type="password"]', PASSWORD);
  await page.locator('form:has(input[type="password"]) button[type="submit"]').click();
  await page.locator("nav#admin-sidebar").waitFor({ timeout: 20000 });
  // The sign-in redirect and the next navigation race otherwise, and the page
  // that lands is the overview while the URL says /admin/stock.
  await page.waitForTimeout(800);
  return "ok";
});

/* ---------- 2. quick view slides ---------- */
await step("quick view: the photographs slide, they do not swap", async () => {
  await page.goto(BASE + "/shop", { waitUntil: "networkidle" });
  await page.locator('button[aria-label="Quick view Crest Hoodie"]').click();
  const dialog = page.locator('[role="dialog"]');
  await dialog.waitFor({ timeout: 15000 });

  const track = dialog.locator("[data-quickview-track]");
  const count = Number(await track.getAttribute("data-quickview-track"));
  if (!(count > 1)) throw new Error(`only ${count} images in the gallery`);

  const before = await track.evaluate((el) => getComputedStyle(el).transform);
  const transition = await track.evaluate((el) => {
    const s = getComputedStyle(el);
    return { property: s.transitionProperty, duration: s.transitionDuration };
  });
  if (!transition.property.includes("transform")) {
    throw new Error("the track has no transform transition: " + transition.property);
  }
  if (!/0\.5s|500ms/.test(transition.duration)) {
    throw new Error("unexpected transition duration: " + transition.duration);
  }

  await dialog.locator('button[aria-label="Next image"]').click();
  await page.waitForTimeout(700);
  const after = await track.evaluate((el) => getComputedStyle(el).transform);
  if (before === after) throw new Error(`transform did not move (${before})`);
  const index = await dialog.evaluate((el) => {
    const dots = [...el.querySelectorAll("span")].filter((s) => s.className.includes("h-1.5"));
    return dots.length;
  });
  await shot(page, "quickview-slide");
  return `${count} images, ${transition.duration}, ${before} → ${after}, ${index} dots`;
});

/* ---------- 2b. the quick view fills the bag with a variant ---------- */
await step("quick view: the bag gets the colour and the size, not just the product", async () => {
  /*
    Any combination that can actually be bought.

    This used to take Sky / L from a product nobody counted, which worked until
    someone set a shelf on it — then the pair was sold out and "Add to bag" was
    disabled. The test is about the variant reaching the bag, not about which
    variant, so it walks the chips until the pair is in stock and asserts that
    exact pair. That also makes it a check of the sold-out rules in passing.
  */
  await page.goto(BASE + "/shop", { waitUntil: "networkidle" });
  await page.locator('button[aria-label="Quick view Regulation White Shirt"]').click();
  const dialog = page.locator('[role="dialog"]');
  await dialog.waitFor({ timeout: 15000 });

  let picked = null;
  for (const colour of ["Sky", "White", "Navy"]) {
    const chip = dialog.locator(`button[aria-label^="${colour}"]`).first();
    if ((await chip.count()) === 0) continue;
    await chip.click();
    for (const size of ["L", "M", "XL", "S", "XXL"]) {
      const chipSize = dialog.locator(`button[aria-label^="${size}"]`).first();
      if ((await chipSize.count()) === 0) continue;
      await chipSize.click();
      await page.waitForTimeout(120);
      const shelf = (await dialog.innerText()).toLowerCase();
      if (!shelf.includes("sold out in this colour and size")) {
        picked = { colour, size };
        break;
      }
    }
    if (picked) break;
  }
  if (!picked) throw new Error("no colour and size on the white shirt is in stock");

  await dialog.getByRole("button", { name: /add to bag/i }).click();
  await page.waitForTimeout(400);
  await page.locator('button[aria-label="Close quick view"]').click();
  await page.locator('button[aria-label="Open shopping bag"]').first().click();
  await page.waitForTimeout(700);
  const bag = await body(page);
  const want = `${picked.colour} / ${picked.size}`.toLowerCase();
  if (!bag.includes(want)) throw new Error(`the bag does not name ${want}: ` + bag.slice(-300));
  await page.locator('button[aria-label="Close bag"]').click();
  return `${picked.colour} / ${picked.size}`;
});

/* ---------- 1 + 4a. editor: custom colour, custom size, stock ---------- */
await step("editor: a custom colour, a custom size and a stock count in one save", async () => {
  await page.goto(`${BASE}/admin/shop/products/${SLUG}`, { waitUntil: "networkidle" });

  await page.fill('input[aria-label="New colour"]', "House tie green");
  await page.locator('button[aria-label="Add colour"]').click();
  await page.fill('input[aria-label="New size"]', "3XL");
  await page.locator('button[aria-label="Add size"]').click();

  // The new chips are on the form, and they are chips like any other.
  const chip = page.getByRole("button", { name: "House tie green", exact: true });
  if ((await chip.count()) === 0) throw new Error("the custom colour is not a chip");

  // 5 in total across two cells. Every other box is emptied first: blank reads
  // as zero once the product is counted at all, and a shelf this file, or a
  // demo, left behind would otherwise add to the total.
  const boxes = page.locator('input[aria-label^="Stock for"]');
  for (let i = 0; i < (await boxes.count()); i++) await boxes.nth(i).fill("");
  await page.fill('input[aria-label="Stock for Navy M"]', "2");
  await page.fill('input[aria-label="Stock for Navy L"]', "3");

  await page.getByRole("button", { name: /^Save$/ }).click();
  await page.waitForTimeout(2500);
  const after = await body(page);
  if (/could not be saved|not saved/.test(after)) throw new Error("save failed: " + after.slice(-200));
  return "saved";
});

/* ---------- 4b. the shop reads it ---------- */
await step("shop: the card says how few are left, the page says it per size", async () => {
  await page.goto(BASE + "/shop", { waitUntil: "networkidle" });
  const card = page.locator("div").filter({ has: page.locator('a[aria-label="View Crest Hoodie"]') }).last();
  const cardText = flat(await card.innerText()).toLowerCase();
  if (!/only 5 left/.test(cardText)) throw new Error(`the card says: ${cardText.slice(0, 200)}`);
  await shot(page, "shop-stock");

  await page.goto(`${BASE}/product/${SLUG}`, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "M", exact: true }).click();
  await page.waitForTimeout(250);
  let text = await body(page);
  if (!/only 2 left/.test(text)) throw new Error("the medium does not say two: " + text.slice(0, 400));

  // 3XL was never filled in, so it is zero — and it cannot be added.
  await page.getByRole("button", { name: /^3XL/ }).click();
  await page.waitForTimeout(250);
  text = await body(page);
  const add = page.getByRole("button", { name: /^(Add to bag|Sold out)$/ }).first();
  const disabled = await add.isDisabled();
  if (!/sold out in this colour and size/.test(text)) throw new Error("3XL is not sold out");
  if (!disabled) throw new Error("the button still adds a sold-out size");
  await shot(page, "product-stock");
  return "5 left · M: 2 · 3XL: sold out";
});

/* ---------- 4c. the till refuses to oversell ---------- */
await step("checkout: the last two mediums sell once, the third attempt is refused", async () => {
  const place = (qty) =>
    page.request.post(BASE + "/api/orders", {
      data: {
        name: "QA Parent",
        email: "qa@example.com",
        items: [{ slug: SLUG, qty, variant: "Navy / M", colour: "Navy", size: "M" }],
      },
    });

  const tooMany = await place(3);
  if (tooMany.status() !== 409) {
    throw new Error(`3 mediums returned ${tooMany.status()}: ${(await tooMany.text()).slice(0, 200)}`);
  }
  const ok = await place(2);
  if (ok.status() !== 201) throw new Error(`2 mediums returned ${ok.status()}`);

  const again = await place(1);
  if (again.status() !== 409) throw new Error(`the shelf was not decremented: ${again.status()}`);

  await page.goto(`${BASE}/product/${SLUG}`, { waitUntil: "networkidle" });
  // The chip itself now says so: a size that sold out is "M — sold out".
  const m = page.getByRole("button", { name: /^M( — sold out)?$/ });
  if ((await m.getAttribute("aria-label")) !== "M — sold out") {
    throw new Error(`the medium chip is still “${await m.getAttribute("aria-label")}”`);
  }
  await m.click();
  await page.waitForTimeout(250);
  const text = await body(page);
  if (!/sold out in this colour and size/.test(text)) throw new Error("the medium is still on sale");
  return "409 · 201 · 409";
});

/* ---------- 4d. the Stocks screen ---------- */
await step("stocks: a shelf is edited on its own screen, and the shop follows", async () => {
  await page.goto(BASE + "/admin/stock", { waitUntil: "networkidle" });
  const nav = await page.locator("nav#admin-sidebar").innerText();
  if (!/stocks/i.test(nav)) throw new Error("no Stocks link in the sidebar");

  const row = page.locator("details").filter({ hasText: "Crest Hoodie" }).first();
  await row.locator("summary").click();
  await page.fill('input[aria-label="Stock for Crest Hoodie Navy / M"]', "9");
  await row.getByRole("button", { name: /save this shelf/i }).click();
  await page.waitForTimeout(2500);
  await page.goto(BASE + "/admin/stock", { waitUntil: "networkidle" });
  const text = await body(page);
  if (!/crest hoodie/.test(text)) throw new Error("the product is not listed");
  await shot(page, "stocks");

  await page.goto(`${BASE}/product/${SLUG}`, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "M", exact: true }).click();
  await page.waitForTimeout(250);
  const product = await body(page);
  if (!/in stock/.test(product)) throw new Error("the shop did not pick the new number up: " + product.slice(0, 300));
  return "9 mediums";
});

/* ---------- 4e. running low, at the top ---------- */
await step("stocks: a low cell is listed at the top and on the overview", async () => {
  await page.goto(BASE + "/admin/stock", { waitUntil: "networkidle" });
  const row = page.locator("details").filter({ hasText: "Crest Hoodie" }).first();
  await row.locator("summary").click();
  await page.fill('input[aria-label="Stock for Crest Hoodie Navy / L"]', "2");
  await row.getByRole("button", { name: /save this shelf/i }).click();
  await page.waitForTimeout(2500);

  await page.goto(BASE + "/admin/stock", { waitUntil: "networkidle" });
  const top = await body(page);
  if (!/running low|sold out/.test(top)) throw new Error("no warning at the top");
  if (!/crest hoodie/.test(top.slice(0, 1200))) throw new Error("the low product is not in the banner");
  await shot(page, "stocks-low");

  await page.goto(BASE + "/admin", { waitUntil: "networkidle" });
  const overview = await body(page);
  if (!/running low|sold out/.test(overview)) throw new Error("the overview says nothing");
  await shot(page, "admin-overview-low");
  return "listed";
});

/* ---------- 4f. tickets: a seat cap and "N left" ---------- */
await step("tickets: a tier is capped, the event page counts down", async () => {
  /*
    The cap is written *relative to what is already sold*.

    A flat 12 used to be fine, until the suites between them had bought more
    than twelve grandstand seats — then 12 was below `sold`, the shop correctly
    read the tier as sold out, and this test failed for the right reason. Twelve
    seats still on sale is the thing being checked, so the cap is sold + 12.
  */
  const seats = await (await fetch(`${BASE}/api/events/the-big-match/seats`)).json();
  const tier = seats.tiers.find((t) => t.id === "grandstand");
  if (!tier) throw new Error("no grandstand tier on The Big Match");
  const capTo = tier.sold + 12;

  await page.goto(BASE + "/admin/stock", { waitUntil: "networkidle" });
  const cap = page.locator('input[aria-label="Seats for The Big Match — Grandstand Seat"]').first();
  if ((await cap.count()) === 0) throw new Error("no Grandstand Seat row for The Big Match");
  await cap.fill(String(capTo));
  await page.getByRole("button", { name: /save seat caps/i }).click();
  await page.waitForTimeout(2500);

  await page.goto(BASE + "/events/the-big-match", { waitUntil: "networkidle" });
  const text = await body(page);
  if (!/12 left/.test(text)) throw new Error("the event page does not count the seats: " + text.slice(0, 300));
  await shot(page, "event-tickets-left");
  return `cap ${capTo} · 12 left`;
});

/* ---------- 5. the tab icon ---------- */
await step("settings: the tab icon uploads and lands in <head>", async () => {
  await page.goto(BASE + "/admin/settings", { waitUntil: "networkidle" });
  const before = await page.locator('link[rel="icon"]').first().getAttribute("href");

  // A 96 px square, drawn here so the test needs no fixture on disk.
  const png = await page.evaluate(() => {
    const c = document.createElement("canvas");
    c.width = 96;
    c.height = 96;
    const g = c.getContext("2d");
    g.fillStyle = "#c9a227";
    g.fillRect(0, 0, 96, 96);
    g.fillStyle = "#04060d";
    g.beginPath();
    g.arc(48, 48, 26, 0, Math.PI * 2);
    g.fill();
    return c.toDataURL("image/png").split(",")[1];
  });
  writeFileSync(`${OUT}/icon.png`, Buffer.from(png, "base64"));

  // Scoped to the tab-icon card: the logo above it has a file input too.
  await page.setInputFiles('#icon input[type="file"]', `${OUT}/icon.png`);
  await page.waitForTimeout(3500);
  const text = await body(page);
  if (!/tab icon saved/.test(text)) throw new Error("no confirmation: " + text.slice(-300));

  await page.goto(BASE + "/", { waitUntil: "networkidle" });
  const icon = await page.locator('link[rel="icon"]').first().getAttribute("href");
  if (!icon || !/uploads\/brand\/icon-/.test(icon)) {
    throw new Error(`the tab still points at ${icon} (was ${before})`);
  }
  await page.goto(BASE + "/admin/settings", { waitUntil: "networkidle" });
  await shot(page, "tab-icon");
  return icon;
});

/* ---------- 3. no storefront navy in the admin ---------- */
await step("admin: no navy-black scrims or white text left over", async () => {
  const findings = {};
  for (const path of ["/admin", "/admin/shop", "/admin/shop/categories", "/admin/stock", "/admin/settings"]) {
    await page.goto(BASE + path, { waitUntil: "networkidle" });
    const found = await page.evaluate(() => {
      // The storefront's root <body> is `bg-ink text-white` and is covered by
      // the shell; what matters is everything the admin itself draws.
      const root = document.querySelector(".min-h-screen.bg-page") ?? document.body;
      const all = [...root.querySelectorAll("[class]")].filter(
        (el) => el.tagName !== "BODY" && el.tagName !== "HTML"
      );
      const inkNow = all.filter((el) =>
        [...el.classList].some(
          (c) => c === "bg-ink" || c.startsWith("bg-ink/") || c.startsWith("from-ink/") || c.startsWith("via-ink/")
        )
      );
      return {
        ink: inkNow.length,
        white: all.filter((el) => [...el.classList].some((c) => c === "text-white")).length,
      };
    });
    if (found.ink || found.white) findings[path] = found;
  }
  if (Object.keys(findings).length) throw new Error(JSON.stringify(findings));
  await shot(page, "admin-no-navy");
  return "clean";
});

/* ---------- put the brand back ---------- */
await step("clean up: the test icon is removed from the brand", async () => {
  await page.goto(BASE + "/admin/settings", { waitUntil: "networkidle" });
  // A previous version of this file uploaded through the *first* file input on
  // the page (the logo's), so both are reset here, not just the tab icon.
  for (const label of ["Use the built-in crest", "Use the built-in mark"]) {
    const button = page.getByRole("button", { name: label });
    if (await button.count()) {
      await button.click();
      await page.waitForTimeout(1200);
    }
  }
  // Seat caps go back to "no cap": other suites buy grandstand seats, and a cap
  // left behind by this file reads to them as a sold-out show.
  await page.goto(BASE + "/admin/stock", { waitUntil: "networkidle" });
  for (const input of await page.locator('input[name^="cap:"]').all()) {
    if ((await input.inputValue()) !== "") await input.fill("");
  }
  await page.getByRole("button", { name: /save seat caps/i }).click();
  await page.waitForTimeout(2500);

  await page.goto(BASE + "/", { waitUntil: "networkidle" });
  const icon = await page.locator('link[rel="icon"]').first().getAttribute("href");
  if (/uploads\/brand\/icon-/.test(icon ?? "")) throw new Error("the test icon is still the tab icon");
  await page.goto(BASE + "/admin/settings", { waitUntil: "networkidle" });
  const text = await body(page);
  if (/logo saved/.test(text)) return "cleared";
  return `cleared · tab → ${icon}`;
});

/* ---------- summary ---------- */
await browser.close();
const failed = steps.filter((s) => !s.ok);
console.log(`\n${steps.length - failed.length}/${steps.length} passed`);
if (pageErrors.length) console.log("page errors:", pageErrors.slice(0, 5));
process.exit(failed.length ? 1 : 0);
