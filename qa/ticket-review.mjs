/**
 * Ticket flow review — booking → ticket image → signed ticket page → gate scan
 * → admin (login, templates, mail, bookings).
 *
 * Temporary QA script, not part of the app.
 *   QA_MODULES=/tmp/qaenv/node_modules node qa/ticket-review.mjs
 */
import fs from "node:fs";
import { createHmac } from "node:crypto";
import { open } from "./browser.mjs";

const BASE = process.env.BASE ?? "http://localhost:3000";
const OUT = "/tmp/qa-ticket";
const SECRET = process.env.TICKET_SECRET ?? "local-review-secret-please-change";
const PASSWORD = process.env.ADMIN_PASSWORD ?? "thomian2026";

fs.mkdirSync(OUT, { recursive: true });

const { browser, page, errors } = await open({ width: 1440, height: 1000 });
const where = [];
page.on("console", (m) => {
  if (m.type() === "error") where.push(page.url().replace(BASE, "") + " → " + m.text().slice(0, 160));
});
const log = [];
const say = (m) => {
  log.push(m);
  console.log(m);
};

const sign = (token) =>
  createHmac("sha256", SECRET).update(`ticket:${token}`).digest("base64url").slice(0, 12);

async function step(name, fn) {
  try {
    const r = await fn();
    say(`✓ ${name}${r ? " — " + r : ""}`);
    return r;
  } catch (e) {
    say(`✗ ${name} — ${String(e).split("\n")[0].slice(0, 220)}`);
    await page
      .screenshot({ path: `${OUT}/FAIL-${name.replace(/\W+/g, "-")}.png`, fullPage: true })
      .catch(() => {});
    return null;
  }
}

// ------------------------------------------------------------------ home
await step("home", async () => {
  const res = await page.goto(BASE + "/", { waitUntil: "domcontentloaded" });
  return `HTTP ${res.status()} — ${await page.title()}`;
});
await page.screenshot({ path: `${OUT}/01-home.png`, fullPage: false, caret: "initial" });

await step("/tickets", async () => {
  const res = await page.goto(BASE + "/tickets", { waitUntil: "domcontentloaded" });
  const h1 = await page
    .locator("h1")
    .first()
    .innerText()
    .catch(() => "(none)");
  return `HTTP ${res.status()} — h1 "${h1.replace(/\s+/g, " ").slice(0, 70)}"`;
});
await page.screenshot({ path: `${OUT}/02-tickets.png`, fullPage: false, caret: "initial" });

// ------------------------------------------------------------------ book
const booking = await step("POST /api/bookings", async () => {
  const res = await page.request.post(BASE + "/api/bookings", {
    data: {
      event: "the-big-match",
      name: "Nimal Perera",
      email: "nimal@example.com",
      phone: "0771234567",
      tiers: [{ id: "grandstand", qty: 2 }],
    },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok()) throw new Error(res.status() + " " + JSON.stringify(body).slice(0, 300));
  return body;
});

const token = booking?.booking?.token;
const sig = token ? sign(token) : "";
say(`  token=${token} reference=${booking?.booking?.reference}`);
say(`  email transport → ${JSON.stringify(booking?.email)}`);

// ------------------------------------------------------------------ image
await step("image without signature is refused", async () => {
  const res = await page.request.get(`${BASE}/api/tickets/${token}/image`);
  if (res.status() !== 403) throw new Error("expected 403, got " + res.status());
  return "403";
});

const image = await step("image with signature", async () => {
  const res = await page.request.get(`${BASE}/api/tickets/${token}/image?s=${sig}`);
  const buf = await res.body();
  const type = res.headers()["content-type"];
  fs.writeFileSync(`${OUT}/ticket.${type?.includes("png") ? "png" : "bin"}`, buf);
  return `HTTP ${res.status()} ${type} ${buf.length} bytes`;
});

// an image that isn't really an image would still "render"; check the QR decodes
await step("ticket QR decodes with jsqr", async () => {
  const { default: jsQR } = await import("jsqr");
  const sharp = (await import("sharp")).default;
  const raw = await sharp(`${OUT}/ticket.png`).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const out = jsQR(new Uint8ClampedArray(raw.data), raw.info.width, raw.info.height);
  if (!out) throw new Error("no QR found in the composed ticket");
  const want = `/t/${token}/${sig}`;
  if (!out.data.includes(want)) throw new Error(`QR carried "${out.data}" not "${want}"`);
  return out.data;
});

// ------------------------------------------------------------------ ticket page
await step("/t/<token> with a bad signature", async () => {
  const res = await page.goto(`${BASE}/t/${token}/wrongsignature`, {
    waitUntil: "domcontentloaded",
  });
  const text = (await page.locator("body").innerText()).replace(/\s+/g, " ");
  if (!/not valid/i.test(text)) throw new Error("bad signature was accepted");
  return `HTTP ${res.status()} — refused as expected`;
});

await step("/t/<token> signed", async () => {
  const res = await page.goto(`${BASE}/t/${token}/${sig}`, { waitUntil: "networkidle" });
  const text = (await page.locator("body").innerText()).replace(/\s+/g, " ");
  const imgs = await page.locator("img").count();
  const shown = /Nimal Perera|BM-|Big Match/.test(text);
  return `HTTP ${res.status()} imgs=${imgs} details=${shown} — "${text.slice(0, 150)}"`;
});
await page.screenshot({ path: `${OUT}/03-ticket.png`, fullPage: true, caret: "initial" });

// ------------------------------------------------------------------ gate
await step("/gate refuses a non-admin scanner", async () => {
  const res = await page.request.post(BASE + "/api/gate", { data: { scan: token } });
  if (res.status() !== 401) throw new Error("expected 401, got " + res.status());
  return "401";
});

await step("/gate page loads", async () => {
  const res = await page.goto(BASE + "/gate", { waitUntil: "networkidle" });
  const text = (await page.locator("body").innerText()).replace(/\s+/g, " ");
  return `HTTP ${res.status()} — "${text.slice(0, 120)}"`;
});
await page.screenshot({ path: `${OUT}/04-gate.png`, fullPage: false, caret: "initial" });

// ------------------------------------------------------------------ admin login
await step("admin: wrong password is refused", async () => {
  await page.goto(BASE + "/admin", { waitUntil: "domcontentloaded" });
  await page.fill('input[type="password"]', "definitely-wrong");
  await page.locator('form:has(input[type="password"]) button[type="submit"]').click();
  await page
    .waitForFunction(() => /That password is not right/i.test(document.body.innerText), null, {
      timeout: 15000,
    })
    .catch(() => {});
  const text = (await page.locator("body").innerText()).replace(/\s+/g, " ");
  if (!/not right|incorrect|invalid/i.test(text)) throw new Error("no error shown: " + text.slice(0, 120));
  return "refused";
});
await page.screenshot({ path: `${OUT}/05-admin-login.png`, fullPage: false, caret: "initial" });

await step("admin: sign in", async () => {
  await page.goto(BASE + "/admin", { waitUntil: "domcontentloaded" });
  await page.fill('input[type="password"]', PASSWORD);
  await page.locator('form:has(input[type="password"]) button[type="submit"]').click();
  await page.waitForURL(/\/admin(\?|$)/, { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(800);
  const text = (await page.locator("body").innerText()).replace(/\s+/g, " ");
  if (/Enter the password/i.test(text)) throw new Error("still on the sign-in screen");
  return `"${text.slice(0, 130)}"`;
});
await page.screenshot({ path: `${OUT}/06-admin.png`, fullPage: true, caret: "initial" });

for (const path of ["/admin/templates", "/admin/mail", "/admin/bookings"]) {
  await step("admin " + path, async () => {
    const res = await page.goto(BASE + path, { waitUntil: "networkidle" });
    const text = (await page.locator("body").innerText()).replace(/\s+/g, " ");
    if (res.status() !== 200) throw new Error("HTTP " + res.status());
    return `${(await page.locator("h1").first().innerText()).replace(/\s+/g, " ")} — "${text.slice(0, 120)}"`;
  });
  await page.screenshot({ path: `${OUT}/admin${path.replace(/\//g, "-")}.png`, fullPage: true, caret: "initial" });
}

// ------------------------------------------------------------------ gate admits (API, as the logged-in admin)
await step("gate: first scan admits", async () => {
  const res = await page.request.post(BASE + "/api/gate", { data: { scan: `${BASE}/t/${token}/${sig}`, by: "Gate 1" } });
  const body = await res.json();
  if (body.status !== "admitted") throw new Error(JSON.stringify(body).slice(0, 220));
  return `admitted → ${body.ticket.name} / ${body.ticket.reference}`;
});

await step("gate: second scan says already", async () => {
  const res = await page.request.post(BASE + "/api/gate", { data: { scan: token, by: "Gate 2" } });
  const body = await res.json();
  if (body.status !== "already") throw new Error(JSON.stringify(body).slice(0, 220));
  return `already admitted at ${body.ticket.admittedAt}`;
});

await step("gate: forged token is invalid", async () => {
  const res = await page.request.post(BASE + "/api/gate", { data: { scan: "totally-made-up-token" } });
  const body = await res.json();
  if (body.status === "admitted") throw new Error("forged token admitted!");
  return `status ${body.status}`;
});

await step("/t/<token> after admission shows the used banner", async () => {
  await page.goto(`${BASE}/t/${token}/${sig}`, { waitUntil: "networkidle" });
  const text = (await page.locator("body").innerText()).replace(/\s+/g, " ");
  if (!/already|used|admitted/i.test(text)) throw new Error("no used banner: " + text.slice(0, 120));
  return `"${text.slice(text.indexOf("ADMISSION") + 130, text.indexOf("ADMISSION") + 300)}"`;
});
await page.screenshot({ path: `${OUT}/07-ticket-used.png`, fullPage: true, caret: "initial" });

await step("gate: undo restores the ticket", async () => {
  const res = await page.request.post(BASE + "/api/gate", { data: { token, reopen: true } });
  const body = await res.json();
  if (!res.ok()) throw new Error(JSON.stringify(body).slice(0, 200));
  return JSON.stringify(body).slice(0, 160);
});

await step("/t/<token> after undo is valid again", async () => {
  await page.goto(`${BASE}/t/${token}/${sig}`, { waitUntil: "networkidle" });
  const text = (await page.locator("body").innerText()).replace(/\s+/g, " ");
  if (/already admitted/i.test(text)) throw new Error("still marked used after undo");
  return "valid again";
});

fs.writeFileSync(
  `${OUT}/log.txt`,
  log.join("\n") + "\n\nerrors:\n" + errors.join("\n") + "\n\nwhere:\n" + where.join("\n") + "\n"
);
await browser.close();
console.log("\nbrowser errors:", errors.length ? errors : "none");
