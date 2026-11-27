/**
 * The admin's palette contract, checked instead of remembered.
 *
 *   node qa/admin-palette.mjs     (needs the dev server on :3000)
 *
 * Two things went wrong in this panel and neither was a bug a test would catch:
 *
 *   1. pure white text on a pure black page. Contrast was 21:1 — more than
 *      enough — and it was still tiring to read, because a 21:1 step between
 *      letterform and background keeps the eye readjusting. Readability is a
 *      range, not a maximum.
 *   2. surface steps too small to see. A #111 tile on a #000 page is 1.11:1;
 *      the layers existed in the CSS and not on the screen.
 *
 * So this reads the real rendered pages and checks the numbers that encode
 * those mistakes: no pure black surface, no pure white text, and every text run
 * at least 4.5:1 against the surface actually behind it (3:1 when large).
 *
 * It is run by hand rather than in the build because it needs a server:
 *
 *   npm run dev
 *   node qa/admin-palette.mjs
 *
 * Verified to fail on the palette it replaced — it reported 6 pages with a pure
 * black surface and 16+ pure white text runs — so a pass here means something.
 */
import { open } from "./browser.mjs";

const BASE = process.env.QA_BASE ?? "http://localhost:3000";

const lum = (rgb) => {
  const [r, g, b] = rgb.map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const ratio = (a, b) => {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
};
const parse = (css) => {
  const m = css.match(/rgba?\(([^)]+)\)/);
  if (!m) return null;
  const parts = m[1].split(/[,\s/]+/).filter(Boolean).map(Number);
  return { rgb: parts.slice(0, 3), a: parts.length > 3 ? parts[3] : 1 };
};

const ROUTES = [
  "/admin",
  "/admin/stock",
  "/admin/shop",
  "/admin/settings",
  "/admin/events",
  "/admin/events/the-big-match",
  "/admin/bookings",
  "/admin/mail",
  "/admin/gate",
];

const { browser, page, errors } = await open({ width: 1440, height: 1000 });

// sign in
await page.goto(`${BASE}/admin`, { waitUntil: "domcontentloaded" });
await page.fill('input[type="password"]', process.env.QA_PASSWORD ?? "thomian2026");
await page.locator('form:has(input[type="password"]) button[type="submit"]').click();
await page.locator('input[type="password"]').waitFor({ state: "detached", timeout: 25000 });

let pass = 0;
let fail = 0;
const ok = (m) => {
  pass++;
  console.log(`  ✓ ${m}`);
};
const bad = (m) => {
  fail++;
  console.log(`  ✗ ${m}`);
};

/** Every text node's colour against the nearest opaque background behind it. */
async function audit(path) {
  await page.goto(BASE + path, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1200);

  const found = await page.evaluate(() => {
    const opaque = (el) => {
      for (let n = el; n; n = n.parentElement) {
        const cs = getComputedStyle(n);
        const c = cs.backgroundColor.match(/rgba?\(([^)]+)\)/);
        if (!c) continue;
        const p = c[1].split(/[,\s/]+/).filter(Boolean).map(Number);
        const a = p.length > 3 ? p[3] : 1;
        if (a > 0.9) return { rgb: p.slice(0, 3), alpha: 1, from: n.className || n.tagName };
      }
      return { rgb: [255, 255, 255], alpha: 1, from: "root" };
    };

    const out = { texts: [], surfaces: {} };
    const body = document.body;
    out.body = getComputedStyle(body).backgroundColor;

    for (const el of document.querySelectorAll("body *")) {
      const cs = getComputedStyle(el);
      const bg = parseC(cs.backgroundColor);
      if (bg && bg.a > 0.9) {
        const key = bg.rgb.join(",");
        out.surfaces[key] = (out.surfaces[key] ?? 0) + 1;
      }

      // only elements that actually render words
      const own = [...el.childNodes]
        .filter((n) => n.nodeType === 3)
        .map((n) => n.textContent.trim())
        .join("");
      if (!own) continue;
      if (cs.visibility === "hidden" || cs.display === "none") continue;
      const r = el.getBoundingClientRect();
      if (r.width < 2 || r.height < 2) continue;

      const fg = parseC(cs.color);
      if (!fg) continue;
      const behind = opaque(el);
      out.texts.push({
        text: own.slice(0, 40),
        fg: fg.rgb,
        bg: behind.rgb,
        size: parseFloat(cs.fontSize),
        weight: Number(cs.fontWeight) || 400,
        cls: String(el.className).slice(0, 60),
      });
    }
    return out;

    function parseC(css) {
      const m = css.match(/rgba?\(([^)]+)\)/);
      if (!m) return null;
      const p = m[1].split(/[,\s/]+/).filter(Boolean).map(Number);
      return { rgb: p.slice(0, 3), a: p.length > 3 ? p[3] : 1 };
    }
  });

  console.log(`\n${path}`);

  // 1. no pure black anywhere a page fill is drawn
  const blacks = Object.keys(found.surfaces).filter((k) => k === "0,0,0");
  if (blacks.length) bad(`pure black surface (${blacks.length} elements)`);
  else ok("no pure black surface");

  // 2. no pure white text
  const whites = found.texts.filter((t) => t.fg.every((v) => v === 255));
  if (whites.length) bad(`pure white text: "${whites[0].text}" (${whites.length})`);
  else ok("no pure white text");

  // 3. every piece of text clears 4.5:1 (3:1 if it is large)
  const low = found.texts
    .map((t) => ({ ...t, r: ratio(t.fg, t.bg) }))
    .filter((t) => {
      const large = t.size >= 24 || (t.size >= 18.66 && t.weight >= 700);
      return t.r < (large ? 3 : 4.5);
    });
  if (low.length) {
    for (const t of low.slice(0, 3)) {
      bad(`${t.r.toFixed(2)}:1 — "${t.text}" ${t.size}px · ${t.cls}`);
    }
  } else {
    const min = Math.min(
      ...found.texts.map((t) => {
        const large = t.size >= 24 || (t.size >= 18.66 && t.weight >= 700);
        return ratio(t.fg, t.bg) / (large ? 3 : 4.5);
      })
    );
    ok(`all ${found.texts.length} text runs clear their ratio (worst at ${(min * 100).toFixed(0)}% of budget)`);
  }

  return found;
}

for (const route of ROUTES) await audit(route);

console.log(`\n${pass}/${pass + fail} checks passed`);
if (errors.length) console.log("browser errors:", errors.slice(0, 3));
await browser.close();
process.exit(fail ? 1 : 0);
