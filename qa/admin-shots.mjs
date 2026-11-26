/**
 * Screenshots of the admin as a separate app, and of the real ticket email.
 *
 *   QA_MODULES=/tmp/qaenv/node_modules QA_LIBS=/tmp/al/lib \
 *   QA_STUB_IMAGES=1 node qa/admin-shots.mjs
 */
import fs from "node:fs";
import { open } from "./browser.mjs";

const BASE = process.env.BASE ?? "http://localhost:3000";
const OUT = "/tmp/qa-admin";
const PASSWORD = process.env.ADMIN_PASSWORD ?? "thomian2026";
fs.mkdirSync(OUT, { recursive: true });

const { browser, page, errors } = await open({ width: 1440, height: 1000 });
page.on("console", (m) => {
  if (m.type() === "error" && /hydrat/i.test(m.text())) {
    console.log("HYDRATION", page.url().replace(BASE, ""), m.text().split("\n").slice(-14).join(" ").slice(0, 1200));
  }
});

// sign in
await page.goto(BASE + "/admin", { waitUntil: "domcontentloaded" });
await page.fill('input[name="password"]', PASSWORD);
await page.click('button[type="submit"]');
await page.waitForURL(/\/admin$/, { timeout: 20000 });
await page.waitForTimeout(600);

const routes = [
  ["/admin", "admin-overview"],
  ["/admin/bookings", "admin-bookings"],
  ["/admin/events", "admin-events"],
  ["/admin/events/the-big-match", "admin-event-edit"],
  ["/admin/events/new", "admin-event-new"],
  ["/admin/templates", "admin-templates"],
  ["/admin/mail", "admin-mail"],
  ["/admin/gate", "admin-gate"],
];

for (const [path, name] of routes) {
  await page.goto(BASE + path, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(700);
  // The mail page holds an <iframe>; a full-page screenshot of the parent can
  // skip cross-document content in this Chromium build, so that one is captured
  // as a viewport instead.
  // `caret: "initial"` — Playwright hides text carets by injecting an inline
  // `caret-color: transparent` before a shot. It lands on any input still in the
  // page afterwards, which React then reports as a hydration mismatch on the
  // *next* visit. Nothing to do with the app; keep the tooling's hands off.
  await page.screenshot({
    path: `${OUT}/${name}.png`,
    fullPage: path !== "/admin/mail",
    caret: "initial",
  });
  // what is actually on the page
  const chrome = await page.locator("nav[aria-label='Primary']").count();
  const side = await page.locator("#admin-nav").count();
  console.log(`${path} — store navbar: ${chrome} · admin sidebar: ${side}`);
}

// the real email, as it will arrive
await page.goto(BASE + "/admin/mail/preview", { waitUntil: "domcontentloaded" });
await page.waitForTimeout(800);
await page.screenshot({ path: `${OUT}/email-full.png`, fullPage: true, caret: "initial" });

// the mail page itself, at a laptop width, so the embedded preview is visible
await page.goto(BASE + "/admin/mail", { waitUntil: "domcontentloaded" });
// The preview is an iframe that renders the whole mail (sharp + a QR) on the
// server, so give it room before the frame is captured.
await page
  .frameLocator("iframe[title='Ticket email preview']")
  .locator("body")
  .waitFor({ timeout: 20000 })
  .catch(() => {});
await page.waitForTimeout(1500);
await page.screenshot({ path: `${OUT}/admin-mail-viewport.png`, fullPage: false, caret: "initial" });

// mobile: the sidebar collapses
await page.setViewportSize({ width: 390, height: 844 });
await page.goto(BASE + "/admin", { waitUntil: "domcontentloaded" });
await page.waitForTimeout(500);
await page.screenshot({ path: `${OUT}/admin-mobile.png`, fullPage: false, caret: "initial" });
await page.click("button[aria-controls='admin-nav']");
await page.waitForTimeout(400);
await page.screenshot({ path: `${OUT}/admin-mobile-menu.png`, fullPage: false, caret: "initial" });

// Which route produced a console error — a hydration warning is only a problem
// if it is ours, so the log needs the URL next to the message.
console.log("errors:", errors.length ? errors : "none");
await browser.close();
