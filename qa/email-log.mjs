/**
 * Round 20 review — what the scanned page says, and whether the email went.
 *
 *   · the page a QR opens names the *ticket*: event, type, code, which of the
 *     party it is — and no purchaser, no price, no order breakdown
 *   · every send is written to /admin/mail/log: sent, refused, or never tried
 *   · one ticket can be sent again, by hand, to any address
 *   · a refusal is on the page in the mail server's own words
 *
 * Temporary QA script, not part of the app.
 *   QA_MODULES=/tmp/qaenv/node_modules QA_LIBS=/tmp/al/lib node qa/email-log.mjs
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createHmac } from "node:crypto";
import { execSync, spawn } from "node:child_process";
import net from "node:net";
import { open } from "./browser.mjs";

const BASE = process.env.BASE ?? "http://localhost:3000";
const OUT = process.env.OUT ?? "/tmp/maillog20";
const PASSWORD = process.env.ADMIN_PASSWORD ?? "thomian2026";
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
const trapMessages = () => readFileSync(TRAP_LOG, "utf8").split("── message ").slice(1);
const lastTrap = () => trapMessages().at(-1) ?? "";

const BUYER = `log20+${Date.now().toString(36)}@example.com`;
const HAND = `hand20+${Date.now().toString(36)}@example.com`;

/** The trap is the school's mail server for this run; a closed port is a test
 *  that fails for the wrong reason, so it is started here if it is not up. */
function portOpen(port) {
  return new Promise((resolve) => {
    const socket = net.connect({ host: "127.0.0.1", port }, () => {
      socket.end();
      resolve(true);
    });
    socket.on("error", () => resolve(false));
    socket.setTimeout(800, () => {
      socket.destroy();
      resolve(false);
    });
  });
}

/**
 * One trap, and it is this run's.
 *
 * It used to reuse whatever was already on 1025 — which, in a long session, is
 * the trap a *previous* run started, pointed at a different log file. The
 * messages then went somewhere this run cannot read, and two steps failed with
 * "no message in the trap" while the booking log correctly said "sent".
 */
async function ensureTrap() {
  if (await portOpen(1025)) {
    if (process.env.QA_REUSE_TRAP === "1") return "already up";
    execSync("pkill -f '[m]ail-trap.mjs' || true");
    for (let i = 0; i < 40 && (await portOpen(1025)); i++) {
      await new Promise((r) => setTimeout(r, 100));
    }
  }
  // A fresh file, so this run's messages are the only ones in it.
  try {
    writeFileSync(TRAP_LOG, "");
  } catch {}
  const child = spawn(
    "sh",
    ["-c", `node scripts/mail-trap.mjs --port 1025 >> "${TRAP_LOG}" 2>&1`],
    { detached: true, stdio: "ignore" }
  );
  child.unref();
  for (let i = 0; i < 40; i++) {
    if (await portOpen(1025)) return "started";
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error("could not start the test mail server");
}

const { browser, page } = await open({ width: 1440, height: 1000 });

await step("the test mail server is listening", ensureTrap);

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
await step("buy two tickets", async () => {
  const res = await page.request.post(BASE + "/api/bookings", {
    data: {
      event: "the-big-match",
      name: "Log Review Twenty",
      email: BUYER,
      tiers: [{ id: "grandstand", qty: 2 }],
    },
  });
  const body = await res.json();
  if (!res.ok()) throw new Error(JSON.stringify(body).slice(0, 220));
  sale = body.booking;
  sale.tickets = sale.tickets.map((t) => ({ ...t, signature: sign(t.token) }));
  return `${sale.reference} · ${sale.tickets.length} tickets to ${BUYER}`;
});

/* The API returns the seats, not their codes: the codes are the ticket's own
   name and are read off the admin page, exactly as the office reads them. */
const codes = [];
await step("the admin page lists a code per seat", async () => {
  await page.goto(`${BASE}/admin/bookings/${sale.reference}`, { waitUntil: "networkidle" });
  const text = flat(await page.locator("body").innerText());
  for (const m of text.matchAll(/BM-[2-9A-HJKMNP-Z]{5}-[2-9A-HJKMNP-Z]{5}/g)) {
    if (!codes.includes(m[0])) codes.push(m[0]);
  }
  if (codes.length !== 2) throw new Error(`${codes.length} codes`);
  return codes.join(" ");
});

/* ---------- 1. the page the QR opens ---------- */
await step("the scanned page names the ticket, not the buyer", async () => {
  await page.goto(`${BASE}/t/${sale.tickets[0].token}/${sale.tickets[0].signature}`, {
    waitUntil: "networkidle",
  });
  const text = flat(await page.locator("body").innerText());
  if (!text.includes(codes[0])) throw new Error("code missing");
  if (!/ticket type/i.test(text)) throw new Error("no ticket type");
  if (!/1 of 2/.test(text)) throw new Error("no seat of the party");

  // Everything that belongs to the purchaser rather than to the ticket.
  const leaks = [];
  if (text.includes("Log Review Twenty")) leaks.push("buyer name");
  if (text.toLowerCase().includes(BUYER.toLowerCase())) leaks.push("buyer email");
  if (/\breference\b/i.test(text)) leaks.push("sale reference");
  if (/\bpaid\b/i.test(text) || /LKR/.test(text)) leaks.push("money");
  if (/grandstand\s*×|\d+\s*×\s*LKR/.test(text)) leaks.push("order lines");
  if (sale.reference && text.includes(sale.reference)) leaks.push("reference value");
  if (leaks.length) throw new Error(leaks.join(", ") + " :: " + text.slice(0, 300));
  return `code + type + 1 of 2, and ${text.length} chars of nothing else`;
});
await page.screenshot({ path: `${OUT}/01-ticket-page.png`, fullPage: true });

/* ---------- 2. the sale is in the log ---------- */
await step("the sale's email is in the log as sent", async () => {
  await page.goto(BASE + "/admin/mail/log", { waitUntil: "networkidle" });
  const row = page
    .locator('li[data-mail][data-mail-status="sent"]', { hasText: sale.reference })
    .filter({ hasText: BUYER })
    .first();
  await row.waitFor({ timeout: 15000 });
  const text = flat(await row.innerText());
  if (!/\bsent\b/.test(text)) throw new Error("not marked sent: " + text);
  if (!text.includes(codes[0]) || !text.includes(codes[1])) throw new Error("codes missing: " + text);
  if (!/with the sale/.test(text)) throw new Error("kind wrong: " + text);
  if (!/smtp/i.test(text)) throw new Error("provider missing: " + text);
  return `sent via smtp · ${codes.join(" ")}`;
});
await page.screenshot({ path: `${OUT}/02-log.png`, fullPage: true });

await step("the trap actually received both ticket files", async () => {
  const block = lastTrap();
  if (!block.includes(BUYER)) throw new Error("not addressed to the buyer: " + block.slice(0, 200));
  const attached = block.match(/attached[^\n]*/)?.[0] ?? "";
  if (!/-ticket-1\.png/.test(attached) || !/-ticket-2\.png/.test(attached)) {
    throw new Error("expected two ticket files: " + attached);
  }
  if (!/receipt-/.test(attached)) throw new Error("no bill: " + attached);
  return flat(attached);
});

/* ---------- 3. one ticket, by hand ---------- */
await step("send one ticket again, to a different address", async () => {
  const before = trapMessages().length;
  await page.goto(BASE + "/admin/mail/log", { waitUntil: "networkidle" });
  const form = page.locator("#send-one");
  await form.locator('input[name="code"]').fill(codes[1].toLowerCase().replace(/-/g, " "));
  await form.locator('input[name="to"]').fill(HAND);
  await form.locator('button[type="submit"]').click();
  await page.waitForFunction(() => /sent to/i.test(document.body.innerText), null, {
    timeout: 20000,
  });
  await page.waitForTimeout(800);
  const after = trapMessages();
  if (after.length <= before) throw new Error("no new message in the trap");
  const block = after.at(-1);
  if (!block.includes(HAND)) throw new Error("not addressed to the hand-typed address");
  const attached = block.match(/attached[^\n]*/)?.[0] ?? "";
  const files = attached.match(/-ticket-\d+\.png/g) ?? [];
  if (files.length !== 1) throw new Error(`${files.length} ticket files: ` + attached);
  // The second seat of the party, under the name it has in the first message.
  if (!/-ticket-2\.png/.test(attached)) throw new Error("wrong seat's file: " + attached);
  return `1 file (seat 2) to ${HAND}`;
});

await step("the resend is in the log as its own row", async () => {
  const row = page
    .locator('li[data-mail][data-mail-status="sent"]', { hasText: HAND })
    .filter({ hasText: "sent again by hand" })
    .first();
  await row.waitFor({ timeout: 15000 });
  const text = flat(await row.innerText());
  if (!text.includes(codes[1])) throw new Error("wrong code in the row: " + text);
  if (text.includes(codes[0])) throw new Error("the other ticket is in the row: " + text);
  return "one code, one address";
});
await page.screenshot({ path: `${OUT}/03-resend.png`, fullPage: true });

/* ---------- 4. a refusal is written down ---------- */
await step("a refused send is in the log, with the reason", async () => {
  // The trap is the mail server; stop it and the connection is refused the same
  // way a wrong host refuses one.
  // The bracket keeps pkill from matching the shell that is running it.
  execSync("pkill -f '[m]ail-trap.mjs' || true");
  await page.waitForTimeout(400);

  try {
    await page.goto(BASE + "/admin/mail/log", { waitUntil: "networkidle" });
    const form = page.locator("#send-one");
    await form.locator('input[name="code"]').fill(codes[0]);
    await form.locator('input[name="to"]').fill("refused20@example.com");
    await form.locator('button[type="submit"]').click();
    await page.waitForFunction(() => /refused|did not work|ECONN/i.test(document.body.innerText), null, {
      timeout: 25000,
    });
    await page.waitForTimeout(1200);
    await page.goto(BASE + "/admin/mail/log", { waitUntil: "networkidle" });

    const row = page
      .locator('li[data-mail][data-mail-status="failed"]', { hasText: "refused20@example.com" })
      .first();
    await row.waitFor({ timeout: 15000 });
    const text = flat(await row.innerText());
    if (!/refused/i.test(text)) throw new Error("not marked refused: " + text);
    const reason = await row.locator("[data-mail-error]").innerText().catch(() => "");
    if (!reason.trim()) throw new Error("no reason on the row: " + text);
    await page.screenshot({ path: `${OUT}/04-refused.png`, fullPage: true });
    return flat(reason).slice(0, 120);
  } finally {
    // Put the mail server back for whoever runs next.
    const child = spawn(
      "sh",
      ["-c", `node scripts/mail-trap.mjs --port 1025 >> "${TRAP_LOG}" 2>&1`],
      { detached: true, stdio: "ignore" }
    );
    child.unref();
    await page.waitForTimeout(1200);
  }
});

await step("the mail server is back and a send succeeds again", async () => {
  await page.goto(BASE + "/admin/mail/log", { waitUntil: "networkidle" });
  const form = page.locator("#send-one");
  await form.locator('input[name="code"]').fill(sale.reference);
  await form.locator('input[name="to"]').fill(HAND);
  await form.locator('button[type="submit"]').click();
  await page.waitForFunction(() => /2 tickets for/i.test(document.body.innerText), null, {
    timeout: 25000,
  });
  const row = page
    .locator('li[data-mail][data-mail-status="sent"]', { hasText: HAND })
    .filter({ hasText: codes[0] })
    .filter({ hasText: codes[1] })
    .first();
  await row.waitFor({ timeout: 15000 });
  if (!/sent/.test(flat(await row.innerText()))) throw new Error("not sent");
  return "the reference sends the party";
});

/* ---------- 5. the nav ---------- */
await step("the sidebar has one active section on the log", async () => {
  const active = page.locator("nav#admin-sidebar a[aria-current='page']");
  const count = await active.count();
  if (count !== 1) throw new Error(`${count} active sections`);
  const label = flat(await active.first().innerText());
  if (!/email log/i.test(label)) throw new Error(`active is ${label}`);
  return label;
});
await page.screenshot({ path: `${OUT}/05-sidebar.png`, fullPage: false });

/* ---------- console ---------- */
await step("no page errors", async () => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  for (const path of ["/admin/mail/log", "/admin/mail", `/admin/bookings/${sale.reference}`, `/t/${sale.tickets[1].token}/${sale.tickets[1].signature}`]) {
    await page.goto(BASE + path, { waitUntil: "networkidle" });
  }
  if (errors.length) throw new Error(errors.join(" | ").slice(0, 220));
  return "clean";
});

await browser.close();

const failed = steps.filter((s) => !s.ok);
console.log(
  `\n${steps.length - failed.length}/${steps.length} passed${failed.length ? ` — ${failed.length} failed` : ""}`
);
process.exit(failed.length ? 1 : 0);
