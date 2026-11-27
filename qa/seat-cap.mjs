/**
 * Round 24 — the stepper obeys the stock, and the mail stops holding the door.
 *
 *   · a ticket tier with three seats left cannot be asked for eight: the modal
 *     stops at three, says "Only 3 left", and disables "+"
 *   · the booking API refuses more than is left, with a 409 and a sentence a
 *     buyer can act on
 *   · the public seats endpoint agrees with the admin's own cap
 *   · the bag cannot hold more of a colour/size than the shelf does
 *   · a booking answers at once and never claims the email was *sent*: the send
 *     happens after the response, and the bookings list + mail log say what
 *     became of it
 *   · no scrollbar on the site is navy any more
 *
 * Temporary QA script, not part of the app.
 *   QA_MODULES=/tmp/qaenv/node_modules QA_LIBS=/tmp/al/lib node qa/seat-cap.mjs
 */
import { mkdirSync } from "node:fs";
import { open, shot } from "./browser.mjs";

const BASE = process.env.BASE ?? "http://localhost:3000";
const OUT = process.env.OUT ?? "/tmp/seatcap24";
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
const body = async (page) => flat(await page.locator("body").innerText()).toLowerCase();

const EVENT = "the-big-match";
const TIER = "grandstand";
const TIER_NAME = "Grandstand Seat";
const HOODIE = "Crest Hoodie";
const LEFT = 3;

/** What the shop is told is left, straight from the API the modal uses. */
async function seats() {
  const res = await fetch(`${BASE}/api/events/${EVENT}/seats`);
  if (!res.ok) throw new Error(`seats endpoint said ${res.status}`);
  return res.json();
}
const tierNow = async () => (await seats()).tiers.find((t) => t.id === TIER);

const { browser, page } = await open({ width: 1440, height: 1100 });
const pageErrors = [];
page.on("pageerror", (e) => pageErrors.push(String(e)));

/* ---------- sign in ---------- */
await step("admin: sign in", async () => {
  await page.goto(BASE + "/admin", { waitUntil: "domcontentloaded" });
  await page.fill('input[type="password"]', PASSWORD);
  await page.locator('form:has(input[type="password"]) button[type="submit"]').click();
  await page.locator("nav#admin-sidebar").waitFor({ timeout: 20000 });
  await page.waitForTimeout(800);
  return "ok";
});

/* ---------- 1. cap a tier just above what is sold ---------- */
await step(`tickets: cap ${TIER_NAME} at sold + ${LEFT}`, async () => {
  const before = await tierNow();
  if (!before) throw new Error(`no ${TIER} tier on ${EVENT}`);
  await page.goto(BASE + "/admin/stock", { waitUntil: "networkidle" });
  const input = page
    .locator(`input[aria-label="Seats for The Big Match — ${TIER_NAME}"]`)
    .first();
  if ((await input.count()) === 0) throw new Error("no seat-cap box for the tier");
  await input.fill(String(before.sold + LEFT));
  await page.getByRole("button", { name: /save seat caps/i }).click();
  await page.waitForTimeout(2500);

  const after = await tierNow();
  if (after.left !== LEFT) {
    throw new Error(`cap did not take: capacity ${after.capacity}, sold ${after.sold}, left ${after.left}`);
  }
  await shot(page, "seat-cap-admin");
  return `sold ${after.sold}, ${after.left} left`;
});

/* ---------- 2. the modal stops at what is left ---------- */
await step("booking modal: the stepper stops at the seats left, and says so", async () => {
  await page.goto(BASE + `/events/${EVENT}`, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: /book tickets/i }).first().click();
  const dialog = page.locator('[role="dialog"]');
  await dialog.waitFor({ timeout: 15000 });
  // The live count is fetched when the modal opens; wait for the tier to learn it.
  await dialog.locator(`[data-tier="${TIER}"]`).waitFor({ timeout: 15000 });
  await page
    .waitForFunction(
      (id) => {
        const el = document.querySelector(`[data-tier="${id}"]`);
        return el && el.getAttribute("data-left") === "3";
      },
      TIER,
      { timeout: 15000 }
    );

  const row = dialog.locator(`[data-tier="${TIER}"]`);
  await row.locator("button").first().click();
  const plus = row.locator('button[aria-label="Add one"]');
  for (let i = 0; i < 8; i++) {
    if (await plus.isDisabled()) break;
    await plus.click();
    await page.waitForTimeout(60);
  }

  const qty = Number(await row.locator(`[data-qty="${TIER}"]`).innerText());
  if (qty !== LEFT) throw new Error(`the stepper reached ${qty}, expected ${LEFT}`);
  if (!(await plus.isDisabled())) throw new Error('"+" is still enabled at the cap');
  const text = flat(await row.innerText());
  if (!new RegExp(`only ${LEFT} left`, "i").test(text)) {
    throw new Error("the row does not say how few are left: " + text.slice(0, 200));
  }
  await shot(page, "seat-cap-modal");
  return `${qty} of ${LEFT}, "+" disabled`;
});

/* ---------- 3. the API refuses more than is left ---------- */
await step("api: four seats when three are left is refused, in words", async () => {
  const res = await fetch(`${BASE}/api/bookings`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      event: EVENT,
      name: "Seat Cap QA",
      email: `seatcap+${Date.now().toString(36)}@example.com`,
      tiers: [{ id: TIER, qty: 4 }],
    }),
  });
  const json = await res.json();
  if (res.status !== 409) throw new Error(`expected 409, got ${res.status}: ${JSON.stringify(json)}`);
  if (!new RegExp(`only ${LEFT}`, "i").test(json.error ?? "")) {
    throw new Error("the refusal does not say how many are left: " + json.error);
  }
  return `409 — ${json.error}`;
});

/* ---------- 4. booking answers at once, email goes after ---------- */
await step("booking: answers without waiting for the mail, and never says \"sent\"", async () => {
  const started = Date.now();
  const res = await fetch(`${BASE}/api/bookings`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      event: EVENT,
      name: "Seat Cap QA",
      email: `seatcap+${Date.now().toString(36)}@example.com`,
      tiers: [{ id: TIER, qty: 1 }],
    }),
  });
  const json = await res.json();
  const took = Date.now() - started;
  if (!res.ok) throw new Error(`${res.status}: ${JSON.stringify(json)}`);
  if (json.email?.sent !== false) {
    throw new Error(`the response claims a delivery it cannot know about: ${JSON.stringify(json.email)}`);
  }
  if (json.email?.queued !== true) {
    throw new Error("the email is not queued: " + JSON.stringify(json.email));
  }
  if (json.email?.tickets !== 1) throw new Error("wrong ticket count in email: " + JSON.stringify(json.email));
  // Reserving is a database write, not a mail send. SMTP here is a trap on
  // localhost; if the send were still on the request path this would be seconds.
  if (took > 4000) throw new Error(`the booking took ${took}ms — the mail is on the request path`);
  return `${took}ms, queued for ${json.email.tickets} ticket`;
});

/* ---------- 5. the bookings list says what became of the email ---------- */
await step("admin: the bookings list carries the email's fate", async () => {
  await page.goto(BASE + "/admin/bookings", { waitUntil: "networkidle" });
  const head = await body(page);
  if (!/reference .*customer .*seats .*paid .*gate .*email/.test(head)) {
    throw new Error("no Email column on the bookings list");
  }
  // The send happens *after* the booking response, so the first paint of this
  // list can be a second early; reload until the log catches up.
  let cells = 0;
  for (let i = 0; i < 8 && cells === 0; i++) {
    cells = await page.locator("[data-mail-status]").count();
    if (!cells) {
      await page.waitForTimeout(2500);
      await page.goto(BASE + "/admin/bookings", { waitUntil: "networkidle" });
    }
  }
  if (cells === 0) throw new Error("no row carries a mail status");
  const failed = await page.locator('[data-mail-status="failed"]').count();
  await shot(page, "bookings-email-column");
  return `${cells} rows with a status${failed ? `, ${failed} not sent` : ""}`;
});

/* ---------- 6. the bag cannot hold more than the shelf ---------- */
await step("shop: the bag's \"+\" stops at the stock", async () => {
  // Two on the shelf for this exact colour and size.
  await page.goto(BASE + "/admin/stock", { waitUntil: "networkidle" });
  const shelf = page.locator("details").filter({ hasText: HOODIE }).first();
  await shelf.locator("summary").click();
  await page.fill(`input[aria-label="Stock for ${HOODIE} Navy / L"]`, "2");
  await shelf.getByRole("button", { name: /save this shelf/i }).click();
  await page.waitForTimeout(2500);

  await page.goto(BASE + "/shop", { waitUntil: "networkidle" });
  await page.locator(`button[aria-label="Quick view ${HOODIE}"]`).click();
  const dialog = page.locator('[role="dialog"]');
  await dialog.waitFor({ timeout: 15000 });
  await dialog.locator('button[aria-label^="Navy"]').first().click();
  await dialog.locator('button[aria-label^="L"]').first().click();
  await page.waitForTimeout(200);
  await dialog.getByRole("button", { name: /add to bag/i }).click();
  await page.waitForTimeout(500);
  await page.locator('button[aria-label="Close quick view"]').click();

  await page.locator('button[aria-label="Open shopping bag"]').first().click();
  await page.waitForTimeout(700);
  const plus = page.locator('button[aria-label="Increase quantity"]').first();
  for (let i = 0; i < 6; i++) {
    if (await plus.isDisabled()) break;
    await plus.click();
    await page.waitForTimeout(80);
  }
  if (!(await plus.isDisabled())) throw new Error('the bag\'s "+" is still enabled past the stock');
  const bag = await body(page);
  if (!/all 2 in your bag/.test(bag)) {
    throw new Error("the bag does not say it holds every one on the shelf: " + bag.slice(-300));
  }
  await shot(page, "bag-cap");
  await page.locator('button[aria-label="Close bag"]').click();
  return "capped at 2";
});

/* ---------- 7. no navy scrollbars ---------- */
await step("scrollbars: neutral grey, not navy", async () => {
  const bad = [];
  for (const path of ["/admin", "/admin/stock", "/", "/shop"]) {
    await page.goto(BASE + path, { waitUntil: "networkidle" });
    const scroll = await page.evaluate(() => {
      const s = getComputedStyle(document.documentElement);
      return { color: s.scrollbarColor, width: s.scrollbarWidth };
    });
    const grey = /58, ?63, ?69|#3a3f45/i.test(scroll.color);
    const navy = /22, ?36, ?74|6, ?10, ?22|#16244a|#060a16/i.test(scroll.color);
    if (!grey || navy) bad.push(`${path}: ${scroll.color}`);
  }
  if (bad.length) throw new Error("scrollbar colour: " + bad.join(" · "));
  await shot(page, "scrollbar-admin");
  return "grey on every screen";
});

/* ---------- put the shop back ---------- */
await step("clean up: the seat cap goes back to no cap", async () => {
  await page.goto(BASE + "/admin/stock", { waitUntil: "networkidle" });
  const input = page
    .locator(`input[aria-label="Seats for The Big Match — ${TIER_NAME}"]`)
    .first();
  await input.fill("");
  await page.getByRole("button", { name: /save seat caps/i }).click();
  await page.waitForTimeout(2500);
  const after = await tierNow();
  if (after.capacity !== null) throw new Error(`the cap is still ${after.capacity}`);
  return "no cap";
});

await browser.close();
const failed = steps.filter((s) => !s.ok);
console.log(`\n${steps.length - failed.length}/${steps.length} passed`);
if (pageErrors.length) console.log("page errors:", pageErrors.slice(0, 5));
process.exit(failed.length ? 1 : 0);
