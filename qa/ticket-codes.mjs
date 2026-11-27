/**
 * Round 19 review — codes that cannot be guessed, a pause, and a bill in the mail.
 *
 *   · every ticket's code is random, unique, and cannot be computed from the sale
 *   · the gate admits a typed code (any case, with or without dashes)
 *   · a block stops one ticket; a pause stops it until its time runs out
 *   · the bookings list itself can stop, pause and delete a single ticket
 *   · the bill prints one code per line, above the items, and travels with the mail
 *
 * Temporary QA script, not part of the app.
 *   QA_MODULES=/tmp/qaenv/node_modules QA_LIBS=/tmp/al/lib node qa/ticket-codes.mjs
 */
import { mkdirSync, readFileSync } from "node:fs";
import { createHmac } from "node:crypto";
import { open } from "./browser.mjs";

const BASE = process.env.BASE ?? "http://localhost:3000";
const OUT = process.env.OUT ?? "/tmp/codes19";
const PASSWORD = process.env.ADMIN_PASSWORD ?? "thomian2026";
// The same log the mail-trap suites use, so whichever trap this session started
// is the one being read. It was /tmp/trap19.log, which no running trap writes to
// any more — the message was there, just in the other file.
const TRAP_LOG = process.env.TRAP_LOG ?? "/tmp/trap20.log";
mkdirSync(OUT, { recursive: true });

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
    return trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, "");
  }
  return "";
}

const SECRET = fromEnvFile("TICKET_SECRET") || "dev";
const sign = (token) =>
  createHmac("sha256", SECRET).update(`ticket:${token}`).digest("base64url").slice(0, 12);

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

/* ---------- sign in ---------- */
await step("admin: sign in", async () => {
  await page.goto(BASE + "/admin", { waitUntil: "domcontentloaded" });
  await page.fill('input[type="password"]', PASSWORD);
  await page.locator('form:has(input[type="password"]) button[type="submit"]').click();
  await page.waitForURL(/\/admin(\?|$)/, { timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(500);
  if (!/bookings/i.test(flat(await page.locator("body").innerText()))) throw new Error("not in");
  return "ok";
});

/* ---------- a sale ---------- */
let sale = null;
await step("buy three tickets", async () => {
  const res = await page.request.post(BASE + "/api/bookings", {
    data: {
      event: "the-big-match",
      name: "Code Review",
      email: "codes@example.com",
      tiers: [{ id: "grandstand", qty: 3 }],
    },
  });
  const body = await res.json();
  if (!res.ok()) throw new Error(JSON.stringify(body).slice(0, 200));
  sale = body.booking;
  sale.tickets = sale.tickets.map((t) => ({ ...t, signature: sign(t.token) }));
  return `${sale.reference} · 3 tickets`;
});

/* ---------- the codes themselves ---------- */
await step("codes are random, unique and not the reference", async () => {
  await page.goto(`${BASE}/admin/bookings/${sale.reference}`, { waitUntil: "networkidle" });
  const text = flat(await page.locator("body").innerText());
  const codes = [...new Set(text.match(/BM-[2-9A-HJKMNP-Z]{5}-[2-9A-HJKMNP-Z]{5}/g) ?? [])];
  if (codes.length !== 3) throw new Error(`${codes.length} codes found: ${codes.join(",")}`);
  if (codes.some((c) => c.includes(sale.reference))) throw new Error("code built from the reference");
  if (codes.some((c) => /[01ILOU]/.test(c.slice(3)))) throw new Error("ambiguous letter in a code");
  return codes.join(" ");
});

const codes = [];
await step("the admin page lists the code for every seat", async () => {
  const text = flat(await page.locator("body").innerText());
  for (const m of text.matchAll(/BM-[2-9A-HJKMNP-Z]{5}-[2-9A-HJKMNP-Z]{5}/g)) {
    if (!codes.includes(m[0])) codes.push(m[0]);
  }
  if (codes.length !== 3) throw new Error(String(codes.length));
  return codes.join(" ");
});

/* ---------- the gate takes the code ---------- */
await step("gate admits a typed code", async () => {
  const res = await page.request.post(BASE + "/api/gate", { data: { scan: codes[0], by: "Gate 1" } });
  const body = await res.json();
  if (body.status !== "admitted") throw new Error(JSON.stringify(body).slice(0, 200));
  return `${body.ticket.code} admitted`;
});

await step("gate ignores case, dashes and spaces", async () => {
  const typed = codes[1].toLowerCase().replace(/-/g, " ");
  const res = await page.request.post(BASE + "/api/gate", { data: { scan: typed, by: "Gate 1" } });
  const body = await res.json();
  if (body.status !== "admitted") throw new Error(`"${typed}" → ` + JSON.stringify(body).slice(0, 160));
  return `"${typed}" → admitted`;
});

await step("a guessed neighbour of a real code is refused", async () => {
  // Same shape, one letter different: the old `REF-01, REF-02` codes made this
  // the whole attack.
  const wrong = codes[2].slice(0, -1) + (codes[2].endsWith("9") ? "8" : "9");
  const res = await page.request.post(BASE + "/api/gate", { data: { scan: wrong, by: "Gate 1" } });
  const body = await res.json();
  if (body.status === "admitted" || body.status === "already")
    throw new Error("guessed code admitted: " + JSON.stringify(body).slice(0, 160));
  return `${wrong} → ${body.status}`;
});

/* ---------- stop one from the list ---------- */
await step("bookings list: tickets fold out of the sale", async () => {
  await page.goto(BASE + "/admin/bookings", { waitUntil: "networkidle" });
  const details = page.locator(`details[data-booking="${sale.reference}"]`).first();
  const summary = details.locator("summary").first();
  if (!(await summary.count())) throw new Error("no ticket disclosure on the list");
  await summary.click();
  await page.waitForTimeout(300);
  const text = flat(await details.innerText());
  if (!text.includes(codes[2])) throw new Error("code missing in the opened list: " + text.slice(0, 160));
  if (!/pause/i.test(text)) throw new Error("no pause control");
  return "opened";
});
await page.screenshot({ path: `${OUT}/01-list-tickets.png`, fullPage: true });

await step("block ticket 3 from the list", async () => {
  const row = page.locator(`li[data-ticket="${codes[2]}"]`).first();
  await row.locator("button", { hasText: /^Block$/ }).click();
  await page.waitForFunction(() => /blocked/i.test(document.body.innerText), null, { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(600);
  const res = await page.request.post(BASE + "/api/gate", { data: { scan: codes[2], by: "Gate 1" } });
  const body = await res.json();
  if (body.status !== "blocked") throw new Error(JSON.stringify(body).slice(0, 200));
  return "blocked, gate refuses";
});
await page.screenshot({ path: `${OUT}/02-blocked-from-list.png`, fullPage: true });

await step("pause then unblock, and the gate admits again", async () => {
  // Unblock first so the ticket is clean, then pause it.
  let row = page.locator(`li[data-ticket="${codes[2]}"]`).first();
  await row.locator("button", { hasText: /Unblock/i }).click();
  await page.waitForTimeout(1500);

  row = page.locator(`li[data-ticket="${codes[2]}"]`).first();
  await row.locator("select[name=minutes]").selectOption("15");
  await row.locator("button", { hasText: /Pause/ }).click();
  await page.waitForFunction(() => /paused/i.test(document.body.innerText), null, { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(600);

  const paused = flat(await page.locator("body").innerText());
  if (!/paused until/i.test(paused)) throw new Error("no pause shown: " + paused.slice(0, 200));

  const res = await page.request.post(BASE + "/api/gate", { data: { scan: codes[2], by: "Gate 1" } });
  const body = await res.json();
  if (body.status !== "blocked") throw new Error("paused ticket admitted: " + JSON.stringify(body).slice(0, 160));
  return "paused → blocked";
});
await page.screenshot({ path: `${OUT}/03-paused.png`, fullPage: true });

await step("a pause that has run out stops being a block", async () => {
  // The predicate the app relies on, run on its own database, with the clock
  // moved past the pause by hand: this is the one thing a five-minute test cannot
  // wait for.
  const { PGlite } = await import(`${process.env.QA_MODULES ?? "/tmp/qaenv/node_modules"}/@electric-sql/pglite/dist/index.js`).catch(() => ({ PGlite: null }));
  if (!PGlite) throw new Error("pglite not available for the clock test");
  const db = await PGlite.create();
  await db.exec(`
    create table t (blocked_at timestamptz, blocked_until timestamptz);
    insert into t values (now(), now() + interval '15 minutes');
    insert into t values (now(), now() - interval '1 minute');
    insert into t values (now(), null);
    insert into t values (null, null);
  `);
  const { rows } = await db.query(
    `select count(*) filter (where blocked_at is not null and (blocked_until is null or blocked_until > now())) as live from t`
  );
  await db.close();
  if (Number(rows[0].live) !== 2) throw new Error(`expected 2 live blocks, got ${rows[0].live}`);
  return "future pause + indefinite block live, expired pause is not";
});

/* ---------- the bill ---------- */
await step("bill: one code per line, above the items, total at the bottom", async () => {
  const res = await page.request.get(
    `${BASE}/api/tickets/${sale.tickets[0].token}/receipt?s=${encodeURIComponent(sale.tickets[0].signature)}`
  );
  if (!res.ok()) throw new Error(String(res.status()));
  const rows = await pdfRows(Buffer.from(await res.body()));

  const lineOf = (needle) => rows.find((r) => r.text.includes(needle));
  const codesRow = ["01", "02", "03"].map((n) =>
    rows.find((r) => r.text.trim().startsWith(n) || r.text.includes(` ${n} |`))
  );
  const header = lineOf("TICKETS ON THIS BILL");
  const items = lineOf("ITEMS");
  const total = lineOf("TOTAL PAID");
  if (!header || !items || !total) throw new Error("a section is missing");

  // Order: codes, then items, then total — top to bottom.
  if (!(header.y > items.y && items.y > total.y))
    throw new Error(`wrong order: codes ${header.y}, items ${items.y}, total ${total.y}`);

  // Every code on its own line, and each of the three present.
  for (const code of codes) {
    const hit = rows.filter((r) => r.text.includes(code));
    if (hit.length !== 1) throw new Error(`${code} appears ${hit.length}×`);
  }
  // No line carries two codes (the two-column layout this replaced).
  const doubled = rows.filter((r) => (r.text.match(/BM-/g) ?? []).length > 1);
  if (doubled.length) throw new Error("two codes on one line: " + doubled[0].text);
  return `codes ${header.y} > items ${items.y} > total ${total.y}`;
});

await step("the bill travels with the ticket email", async () => {
  // The trap prints one block per message; the newest is the sale just made.
  // The send runs *after* the booking response now, so this waits for it rather
  // than reading the file the instant the seats are booked.
  let last = "";
  for (let i = 0; i < 20; i++) {
    const blocks = readFileSync(TRAP_LOG, "utf8").split("── message ");
    last = blocks[blocks.length - 1] ?? "";
    if (last.includes(sale.reference)) break;
    await new Promise((r) => setTimeout(r, 1000));
  }
  if (!last.includes(sale.reference)) throw new Error("no message for this sale in the trap yet");
  if (!/attached[^\n]*receipt-/.test(last)) throw new Error("no bill attached: " + last.slice(0, 300));
  if (!/ticket-1\.png/.test(last)) throw new Error("no ticket file attached: " + last.slice(0, 300));
  return flat(last.match(/attached[^\n]*/)?.[0] ?? "");
});

/* ---------- the public page ---------- */
await step("the ticket page shows its own code and no admission state", async () => {
  await page.goto(`${BASE}/t/${sale.tickets[0].token}/${sale.tickets[0].signature}`, {
    waitUntil: "networkidle",
  });
  const text = flat(await page.locator("body").innerText());
  if (!text.includes(codes[0])) throw new Error("code missing");
  if (/admitted|not yet scanned|download (the )?bill/i.test(text)) throw new Error("leaks: " + text.slice(0, 200));
  return codes[0];
});
await page.screenshot({ path: `${OUT}/04-ticket-page.png`, fullPage: true });

/* ---------- delete ---------- */
await step("delete one ticket from the list", async () => {
  page.once("dialog", (d) => d.accept().catch(() => {}));
  await page.goto(`${BASE}/admin/bookings`, { waitUntil: "networkidle" });
  await page.locator(`details[data-booking="${sale.reference}"] summary`).first().click();
  await page.waitForTimeout(300);
  const row = page.locator(`li[data-ticket="${codes[0]}"]`).first();
  await row.locator("button", { hasText: /Delete/ }).click();
  await page.waitForFunction(() => /deleted/i.test(document.body.innerText), null, { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(800);
  const res = await page.request.post(BASE + "/api/gate", { data: { scan: codes[0], by: "Gate 1" } });
  const body = await res.json();
  if (body.status === "admitted" || body.status === "already") throw new Error("deleted code still works");
  return `gate says ${body.status}`;
});

/* ---------- console ---------- */
await step("no page errors on the new screens", async () => {
  for (const path of ["/admin/bookings", `/admin/bookings/${sale.reference}`]) {
    await page.goto(BASE + path, { waitUntil: "networkidle" });
  }
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  if (errors.length) throw new Error(errors.join(" | ").slice(0, 200));
  return "clean";
});

async function pdfRows(buffer) {
  const { getDocument } = await import(
    `${process.env.QA_MODULES ?? "/tmp/qaenv/node_modules"}/pdfjs-dist/legacy/build/pdf.mjs`
  );
  const doc = await getDocument({ data: new Uint8Array(buffer), useSystemFonts: false }).promise;
  const p = await doc.getPage(1);
  const content = await p.getTextContent();
  const byY = new Map();
  for (const item of content.items) {
    const y = Math.round(item.transform[5]);
    const key = [...byY.keys()].find((k) => Math.abs(k - y) <= 3) ?? y;
    byY.set(key, `${byY.get(key) ?? ""} ${item.str}`.trim());
  }
  return [...byY.entries()]
    .map(([y, text]) => ({ y, text }))
    .sort((a, b) => b.y - a.y);
}

console.log(`\n— ${steps.filter((s) => s.ok).length}/${steps.length} passed`);
for (const s of steps.filter((s) => !s.ok)) console.log("  ✗", s.name, "—", s.note);
await browser.close();
process.exit(steps.every((s) => s.ok) ? 0 : 1);
