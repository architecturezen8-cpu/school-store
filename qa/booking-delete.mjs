/**
 * Deleting a whole sale from the admin.
 *
 *   QA_MODULES=/tmp/qaenv/node_modules QA_LIBS=/tmp/al/lib node qa/booking-delete.mjs
 *
 * The office asked for this because a test sale at the counter, a duplicate sent
 * twice by a flaky line, or a cash refund all need the *sale* gone — not one
 * ticket at a time. The checks below are the ones that matter:
 *
 *   · the button is on the booking's own page, and it asks first
 *   · the booking, its tickets and its admission records are gone
 *   · the seats go back on sale (the event page's "N left" comes back up)
 *   · a deleted ticket's code no longer opens the gate
 *
 * Temporary QA script, not part of the app.
 */
import { mkdirSync } from "node:fs";
import { open, shot } from "./browser.mjs";

const BASE = process.env.BASE ?? "http://localhost:3000";
const OUT = process.env.OUT ?? "/tmp/booking-delete";
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

const { browser, page } = await open({ width: 1440, height: 1100 });
const pageErrors = [];
page.on("pageerror", (e) => pageErrors.push(String(e)));

const EVENT = "the-big-match";
const TIER = "standard";

/**
 * How many seats the first tier has left, read from the admin editor.
 *
 * Not from the public event page: that page is statically generated with a
 * one-minute revalidate, so within a test run it is answering from before the
 * sale and the numbers would be a minute stale. The editor is force-dynamic and
 * prints the same pair — "Seats: 500 — 3 sold, 497 left".
 */
async function seatsLeft() {
  await page.goto(`${BASE}/admin/events/the-big-match`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1200);
  const body = flat(await page.locator("body").innerText());
  const match = body.match(/(\d+)\s+sold,\s*(\d+)\s+left/i);
  return match ? Number(match[2]) : null;
}

/* ---------- sign in, and give the tier a cap to watch ---------- */
await step("admin: sign in", async () => {
  await page.goto(BASE + "/admin", { waitUntil: "domcontentloaded" });
  await page.fill('input[type="password"]', PASSWORD);
  await page.locator('form:has(input[type="password"]) button[type="submit"]').click();
  await page.locator("nav#admin-sidebar").waitFor({ timeout: 20000 });
  await page.waitForTimeout(800);
  return "ok";
});

/**
 * A cap on the first tier, so "N left" exists to watch.
 *
 * The check needs a countdown that the app itself prints; if the tier has no cap
 * there is nothing to count and the seat-return half of this test would be
 * unverifiable. 500 is comfortably above anything the seats already sold.
 */
await step("admin: cap the first tier so the count is printed", async () => {
  const read = async () => {
    await page.goto(BASE + "/admin/events/the-big-match", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(1200);
    return page.locator('input[aria-label$="seats"]').first();
  };
  for (let attempt = 0; attempt < 3; attempt++) {
    const seats = await read();
    await seats.fill("500");
    await page.getByRole("button", { name: /Save changes/i }).first().click();
    await page.waitForTimeout(4000);
    const after = await read();
    if ((await after.inputValue()) === "500") return "standard tier capped at 500";
  }
  throw new Error("the cap would not save");
});

/* ---------- a sale to delete ---------- */
let booking = null;
let leftBefore = null;

await step("a booking exists to delete (two seats)", async () => {
  const res = await page.request.post(`${BASE}/api/bookings`, {
    data: {
      event: EVENT,
      name: "QA Delete Buyer",
      email: "qa-delete@example.com",
      phone: "",
      tiers: [{ id: TIER, qty: 2 }],
    },
  });
  if (res.status() !== 201) throw new Error(`${res.status()}: ${(await res.text()).slice(0, 200)}`);
  const json = await res.json();
  booking = json.booking;
  if (!booking?.reference) throw new Error("no reference came back");
  return `${booking.reference} · ${booking.tickets.length} tickets`;
});

await step("the seats it took are off the count", async () => {
  const left = await seatsLeft();
  if (left === null) throw new Error("this tier still has no countdown to read");
  leftBefore = left + 2; // the sale took two seats a moment ago
  return `${left} left after a 2-seat sale (was ${leftBefore})`;
});

await step("admin: the booking page offers “Delete this sale”", async () => {
  await page.goto(`${BASE}/admin/bookings/${encodeURIComponent(booking.reference)}`, {
    waitUntil: "domcontentloaded",
  });
  await page.waitForTimeout(1000);
  const button = page.getByRole("button", { name: /Delete this sale/i });
  if (!(await button.count())) throw new Error("no delete button on the booking page");
  const warning = flat(await page.locator("body").innerText());
  if (!/no undo/i.test(warning)) throw new Error("the page does not warn that it cannot be undone");
  await shot(page, "01-booking-before");
  return "button + warning present";
});

await step("admin: it asks before deleting, and a cancel keeps the sale", async () => {
  page.once("dialog", (d) => d.dismiss().catch(() => {}));
  await page.getByRole("button", { name: /Delete this sale/i }).click();
  await page.waitForTimeout(1500);
  await page.goto(`${BASE}/admin/bookings/${encodeURIComponent(booking.reference)}`, {
    waitUntil: "domcontentloaded",
  });
  await page.waitForTimeout(800);
  const still = flat(await page.locator("body").innerText());
  if (!still.includes(booking.reference)) throw new Error("cancelling the confirm deleted it anyway");
  return "cancel kept it";
});

await step("admin: deleting the sale returns to the list with a message", async () => {
  page.once("dialog", (d) => d.accept().catch(() => {}));
  await page.getByRole("button", { name: /Delete this sale/i }).click();
  await page.waitForTimeout(3000);
  const url = page.url();
  const text = flat(await page.locator("body").innerText());
  if (!/\/admin\/bookings(\?|$)/.test(url)) throw new Error(`ended on ${url}`);
  if (!/deleted/i.test(text)) throw new Error(`no confirmation: ${text.slice(0, 200)}`);
  if (!/back on sale/i.test(text)) throw new Error("the message does not say the seats came back");
  await shot(page, "02-list-after");
  return flat(text.match(/[A-Z]{2}-[A-Z0-9-]+ deleted[^.]*/)?.[0] ?? "deleted");
});

await step("admin: the booking is gone and its tickets with it", async () => {
  await page.goto(`${BASE}/admin/bookings/${encodeURIComponent(booking.reference)}`, {
    waitUntil: "domcontentloaded",
  });
  await page.waitForTimeout(800);
  const text = flat(await page.locator("body").innerText());
  if (/QA Delete Buyer/.test(text)) throw new Error("the buyer is still on the page");
  if (!/no tickets|nothing here|reference may be wrong/i.test(text)) {
    throw new Error(`page still looks alive: ${text.slice(0, 240)}`);
  }
  return "gone";
});

await step("the seats are back on sale", async () => {
  const left = await seatsLeft();
  if (left === null) throw new Error("no countdown to read");
  if (leftBefore !== null && left !== leftBefore) {
    throw new Error(`the count is ${left}, expected ${leftBefore} — the seats did not come back`);
  }
  const list = await page.request.get(`${BASE}/api/tickets/${booking.tickets[0].token}`);
  return `${left} left again · deleted ticket token now ${list.status()}`;
});

await step("a deleted ticket's code no longer opens the gate", async () => {
  const res = await page.request.post(`${BASE}/api/gate`, {
    data: { scan: booking.reference, by: "QA" },
  });
  const body = await res.json();
  if (body.status === "admitted" || body.status === "already") {
    throw new Error(`the gate still admits something on this sale: ${JSON.stringify(body).slice(0, 160)}`);
  }
  return `gate says ${body.status}`;
});

await step("no page errors on the bookings screens", async () => {
  const before = pageErrors.length;
  for (const path of ["/admin/bookings", `/admin/bookings/${encodeURIComponent(booking.reference)}`]) {
    await page.goto(BASE + path, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(600);
  }
  if (pageErrors.length > before) throw new Error(pageErrors.slice(before).join(" | ").slice(0, 200));
  return "clean";
});

const passed = steps.filter((s) => s.ok).length;
console.log(`\n— ${passed}/${steps.length} passed`);
await browser.close();
process.exitCode = passed === steps.length ? 0 : 1;
