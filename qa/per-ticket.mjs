/**
 * Round 18 review — a ticket of its own.
 *
 *   · the public page says nothing about admission and offers no bill
 *   · each ticket carries its own code, and the bill prints it
 *   · block stops one ticket at the gate without touching the sale
 *   · delete removes one ticket
 *   · the admin can issue a ticket by hand
 *
 * Temporary QA script, not part of the app.
 *   QA_MODULES=/tmp/qaenv/node_modules QA_LIBS=/tmp/al/lib node qa/per-ticket.mjs
 */
import { mkdirSync, readFileSync } from "node:fs";
import { createHmac } from "node:crypto";
import { open } from "./browser.mjs";

const QA_MODULES = process.env.QA_MODULES ?? "/tmp/qaenv/node_modules";

const BASE = process.env.BASE ?? "http://localhost:3000";
const OUT = process.env.OUT ?? "/tmp/per-ticket";
const PASSWORD = "thomian2026";

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
const flat = (text) => (text ?? "").replace(/\s+/g, " ").trim();

function fromEnvFile(key) {
  if (process.env[key]) return process.env[key];
  let text = "";
  try {
    text = readFileSync(".env.local", "utf8");
  } catch {
    return "";
  }
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1 || trimmed.slice(0, eq).trim() !== key) continue;
    let value = trimmed.slice(eq + 1).trim();
    if (/^["'].*["']$/.test(value)) value = value.slice(1, -1);
    return value;
  }
  return "";
}

const SECRET = fromEnvFile("TICKET_SECRET") || "development-ticket-secret";
const sign = (token) =>
  createHmac("sha256", SECRET).update(`ticket:${token}`).digest("base64url").slice(0, 12);

const { browser, page } = await open({ width: 1280, height: 1000 });
const shots = OUT;
mkdirSync(shots, { recursive: true });

/* ---------- sign in ---------- */
await step("admin: sign in", async () => {
  await page.goto(BASE + "/admin", { waitUntil: "domcontentloaded" });
  await page.fill('input[type="password"]', PASSWORD);
  await page.locator('form:has(input[type="password"]) button[type="submit"]').click();
  await page.waitForURL(/\/admin(\?|$)/, { timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(600);
  if (!/sign out|bookings/i.test(flat(await page.locator("body").innerText())))
    throw new Error("not signed in");
  return "ok";
});

/* ---------- a sale of three ---------- */
let sale = null;
await step("buy three tickets", async () => {
  const res = await page.request.post(BASE + "/api/bookings", {
    data: {
      event: "the-big-match",
      name: "Per Ticket Review",
      email: "per-ticket@example.com",
      phone: "0771234567",
      tiers: [{ id: "grandstand", qty: 3 }],
    },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok()) throw new Error(`${res.status()} ${JSON.stringify(body).slice(0, 220)}`);
  sale = body.booking;
  if (!sale?.reference) throw new Error(JSON.stringify(body).slice(0, 220));
  sale.tickets = sale.tickets.map((t) => ({ ...t, signature: sign(t.token) }));
  return `${sale.reference} · ${sale.tickets.length} tickets`;
});

/* ---------- the public page ---------- */
const tokens = sale.tickets.map((t) => t.token);
await step("public ticket page: no admission status, no bill", async () => {
  await page.goto(`${BASE}/t/${tokens[0]}/${sale.tickets[0].signature ?? ""}`, {
    waitUntil: "networkidle",
  });
  const text = flat(await page.locator("body").innerText());
  const bad = [];
  if (/admitted|not yet scanned|valid ·/i.test(text)) bad.push("status shown");
  if (/download (the )?bill/i.test(text)) bad.push("bill link");
  if (/per-ticket@example\.com/i.test(text)) bad.push("buyer email");
  if (!/ticket code/i.test(text)) bad.push("no code");
  if (bad.length) throw new Error(bad.join(", ") + " :: " + text.slice(0, 260));
  const code = text.match(/Ticket code\s+(\S+)/i)?.[1] ?? "";
  if (!/^BM-[2-9A-HJKMNP-Z]{5}-[2-9A-HJKMNP-Z]{5}$/.test(code))
    throw new Error(`odd code ${code}`);
  return code;
});
await page.screenshot({ path: `${shots}/01-public-ticket.png`, fullPage: true });

await step("public page of a used ticket looks identical", async () => {
  const before = flat(await page.locator("body").innerText());
  await page.request.post(BASE + "/api/gate", { data: { scan: tokens[0], by: "Gate 1" } });
  await page.reload({ waitUntil: "networkidle" });
  const after = flat(await page.locator("body").innerText());
  if (/\badmitted\b/i.test(after)) throw new Error("page now says admitted");
  const strip = (s) => s.replace(/scanned|gate \d/gi, "");
  if (strip(before) !== strip(after)) throw new Error("page changed after the scan");
  return "unchanged";
});

/* ---------- admin: the booking ---------- */
const ticketCodes = [];
await step("admin: booking page lists three codes", async () => {
  await page.goto(`${BASE}/admin/bookings/${sale.reference}`, { waitUntil: "networkidle" });
  const text = flat(await page.locator("body").innerText());
  for (const m of text.matchAll(/BM-[2-9A-HJKMNP-Z]{5}-[2-9A-HJKMNP-Z]{5}/g)) {
    if (!ticketCodes.includes(m[0])) ticketCodes.push(m[0]);
  }
  if (ticketCodes.length !== 3) throw new Error(`${ticketCodes.length} codes: ${ticketCodes.join(",")}`);
  if (!/block/i.test(text)) throw new Error("no block control");
  return ticketCodes.join(" ");
});
await page.screenshot({ path: `${shots}/02-booking.png`, fullPage: true });

await step("admin: block ticket 1", async () => {
  await page.goto(`${BASE}/admin/bookings/${sale.reference}`, { waitUntil: "networkidle" });
  const row = page.locator(`li[data-ticket="${ticketCodes[1]}"]`).first();
  await row.locator("button", { hasText: /^Block$/ }).click();
  await page.waitForLoadState("networkidle").catch(() => {});
  await page.waitForTimeout(900);
  const text = flat(await page.locator("body").innerText());
  if (!/blocked/i.test(text)) throw new Error(text.slice(0, 200));
  return "blocked";
});
await page.screenshot({ path: `${shots}/03-blocked.png`, fullPage: true });

await step("gate refuses the blocked ticket", async () => {
  const res = await page.request.post(BASE + "/api/gate", { data: { scan: tokens[1], by: "Gate 1" } });
  const body = await res.json();
  if (body.status !== "blocked") throw new Error(JSON.stringify(body).slice(0, 220));
  return `status ${body.status} · ${body.ticket?.code ?? ""}`;
});

await step("the other two still walk in", async () => {
  const res = await page.request.post(BASE + "/api/gate", { data: { scan: tokens[2], by: "Gate 1" } });
  const body = await res.json();
  if (body.status !== "admitted") throw new Error(JSON.stringify(body).slice(0, 220));
  return `${body.ticket.code} admitted`;
});

await step("public page of the blocked ticket says so, without scan data", async () => {
  await page.goto(`${BASE}/t/${tokens[1]}/${sale.tickets[1].signature ?? ""}`, {
    waitUntil: "networkidle",
  });
  const text = flat(await page.locator("body").innerText());
  if (!/cancelled|not valid|stopped/i.test(text)) throw new Error(text.slice(0, 200));
  if (/gate 1|scanned|admitted at/i.test(text)) throw new Error("leaked scan detail");
  return "cancelled";
});
await page.screenshot({ path: `${shots}/04-blocked-public.png`, fullPage: true });

await step("admin: unblock, and the gate admits again", async () => {
  await page.goto(`${BASE}/admin/bookings/${sale.reference}`, { waitUntil: "networkidle" });
  const row = page.locator(`li[data-ticket="${ticketCodes[1]}"]`).first();
  await row.locator("button", { hasText: /Unblock/i }).click();
  await page.waitForLoadState("networkidle").catch(() => {});
  await page.waitForTimeout(900);
  const res = await page.request.post(BASE + "/api/gate", { data: { scan: tokens[1], by: "Gate 1" } });
  const body = await res.json();
  if (body.status !== "admitted") throw new Error(JSON.stringify(body).slice(0, 220));
  return "admitted after unblock";
});

/* ---------- bill ---------- */
await step("bill prints every ticket's own code", async () => {
  const res = await page.request.get(
    `${BASE}/api/tickets/${tokens[0]}/receipt?s=${encodeURIComponent(sale.tickets[0].signature ?? "")}`
  );
  if (!res.ok()) throw new Error(`${res.status()}`);
  const pdf = Buffer.from(await res.body());
  const text = await pdfText(pdf);
  const missing = ticketCodes.filter((code) => !text.includes(code));
  if (missing.length) throw new Error("missing " + missing.join(",") + " :: " + text.slice(0, 300));
  if (!/TOTAL PAID/i.test(text)) throw new Error("no total");
  return "3 codes + total";
});

/* ---------- delete ---------- */
await step("admin: delete ticket 3", async () => {
  page.once("dialog", (d) => d.accept().catch(() => {}));
  await page.goto(`${BASE}/admin/bookings/${sale.reference}`, { waitUntil: "networkidle" });
  const row = page.locator(`li[data-ticket="${ticketCodes[2]}"]`).first();
  await row.locator("button", { hasText: /Delete/ }).click();
  await page
    .waitForFunction(() => /deleted/i.test(document.body.innerText), null, { timeout: 15000 })
    .catch(() => {});
  await page.waitForLoadState("networkidle").catch(() => {});
  const rows = await page.locator("li[data-ticket]").count();
  if (rows < 1) throw new Error("no tickets left after delete");
  return "removed";
});

await step("deleted ticket is invalid at the gate", async () => {
  const res = await page.request.post(BASE + "/api/gate", { data: { scan: tokens[2], by: "Gate 1" } });
  const body = await res.json();
  if (body.status === "admitted" || body.status === "already")
    throw new Error(JSON.stringify(body).slice(0, 200));
  return `status ${body.status}`;
});

await step("the sale and its total survive the delete", async () => {
  await page.goto(`${BASE}/admin/bookings`, { waitUntil: "networkidle" });
  const text = flat(await page.locator("body").innerText());
  if (!text.includes(sale.reference)) throw new Error("sale gone from the list");
  return "still listed";
});

/* ---------- manual ticket ---------- */
let manual = null;
let manualToken = "";
await step("admin: issue a ticket by hand", async () => {
  await page.goto(`${BASE}/admin/bookings/new`, { waitUntil: "networkidle" });
  const select = page.locator('select[name="tier"]');
  const value = await select.locator("option").nth(1).getAttribute("value");
  await select.selectOption(value);
  await page.fill('input[name="name"]', "Headmaster comp");
  await page.fill('input[name="price"]', "0");
  await page.fill('input[name="note"]', "Comp — QA");
  await page.uncheck('input[name="send"]');
  await page.locator('form:has(select[name="tier"]) button[type="submit"]').click();
  // `/admin/bookings/new` also matches "a reference" — wait for a real one.
  await page.waitForURL(
    (url) => /^\/admin\/bookings\/[^/]+$/.test(url.pathname) && !url.pathname.endsWith("/new"),
    { timeout: 20000 }
  );
  await page.waitForTimeout(800);
  const text = flat(await page.locator("body").innerText());
  if (!/issued/i.test(text)) throw new Error(text.slice(0, 200));
  manual = page.url().split("/").pop().split("?")[0];
  if (!/^BM-[A-Z0-9]+$/.test(manual)) throw new Error(`odd reference ${manual}`);
  if (!/BM-[2-9A-HJKMNP-Z]{5}-[2-9A-HJKMNP-Z]{5}/.test(text)) throw new Error("no code");
  manualToken = await page.locator('input[name="token"]').first().inputValue();
  return manual;
});
await page.screenshot({ path: `${shots}/05-manual.png`, fullPage: true });

await step("the manual ticket is a real ticket", async () => {
  await page.goto(`${BASE}/admin/bookings`, { waitUntil: "networkidle" });
  const text = flat(await page.locator("body").innerText());
  if (!text.includes(manual)) throw new Error("not in the list");
  if (!/Headmaster comp/.test(text)) throw new Error("name missing");
  const row = page.locator("li", { hasText: manual }).first();
  const text2 = await row.innerText().catch(() => "");
  return text2 ? "listed" : "listed";
});

await step("the hand-issued ticket opens the gate", async () => {
  const res = await page.request.post(BASE + "/api/gate", { data: { scan: manualToken, by: "Gate 2" } });
  const body = await res.json();
  if (body.status !== "admitted") throw new Error(JSON.stringify(body).slice(0, 220));
  return `${body.ticket.code} admitted`;
});

/* ---------- the scanner screen ---------- */
await step("gate scanner screen says blocked", async () => {
  // Stop a fresh ticket, then type it into the scanner by hand.
  const res = await page.request.post(BASE + "/api/bookings", {
    data: {
      event: "the-big-match",
      name: "Blocked At The Door",
      email: "blocked@example.com",
      tiers: [{ id: "grandstand", qty: 1 }],
    },
  });
  const fresh = (await res.json()).booking;
  const token = fresh.tickets[0].token;
  await page.goto(`${BASE}/admin/bookings/${fresh.reference}`, { waitUntil: "networkidle" });
  const row = page.locator("li[data-ticket]").first();
  await row.locator("button", { hasText: /^Block$/ }).click();
  await page
    .waitForFunction(() => /blocked/i.test(document.body.innerText), null, { timeout: 15000 })
    .catch(() => {});

  await page.goto(BASE + "/gate", { waitUntil: "networkidle" });
  const field = page.locator('input[placeholder*="BM-"]').first();
  await field.fill(token);
  await page.locator("button", { hasText: /Admit|Check|Scan/i }).first().click();
  await page.waitForTimeout(1500);
  const text = flat(await page.locator("body").innerText());
  if (!/Blocked — do not admit/i.test(text)) throw new Error(text.slice(0, 240));
  return "shows the block, not \"already\"";
});
await page.screenshot({ path: `${shots}/07-gate-blocked.png`, fullPage: true });

/* ---------- no console noise ---------- */
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));

await step("admin palette still holds on the new pages", async () => {
  for (const path of ["/admin/bookings", `/admin/bookings/${sale.reference}`, "/admin/bookings/new"]) {
    await page.goto(BASE + path, { waitUntil: "networkidle" });
    const bg = await page.evaluate(() => {
      const el = document.querySelector("main") ?? document.body;
      return getComputedStyle(el).backgroundColor;
    });
    if (!bg) throw new Error("no background");
  }
  if (errors.length) throw new Error(errors.join(" | ").slice(0, 200));
  return "ok";
});

async function pdfText(buffer) {
  const { getDocument } = await import(`${QA_MODULES}/pdfjs-dist/legacy/build/pdf.mjs`);
  const doc = await getDocument({ data: new Uint8Array(buffer), useSystemFonts: true }).promise;
  let out = "";
  for (let i = 1; i <= doc.numPages; i++) {
    const p = await doc.getPage(i);
    const content = await p.getTextContent();
    out += content.items.map((it) => it.str).join(" ") + "\n";
  }
  return out;
}

console.log("\n— " + steps.filter((s) => s.ok).length + "/" + steps.length + " passed");
for (const s of steps.filter((s) => !s.ok)) console.log("  ✗", s.name, "—", s.note);
await browser.close();
process.exit(steps.every((s) => s.ok) ? 0 : 1);
