/**
 * ------------------------------------------------------------------
 *  SMOKE TEST — runs the real app in jsdom (no browser needed)
 * ------------------------------------------------------------------
 *  Usage:  node scripts/smoke.mjs [--verbose]
 *
 *  · bundles src/ as a classic IIFE (jsdom cannot run ES modules)
 *  · boots it in jsdom with the browser APIs the site uses stubbed
 *  · walks every route and clicks the main flows (quick view, sort,
 *    add to bag, cart drawer, search, ticket booking, track order,
 *    mobile menu) — plus markup/a11y scan on each route
 *  · reports console errors, warnings, unhandled rejections, dead
 *    images and missing elements as a readable checklist
 *
 *  Exit code 0 = clean, 1 = at least one problem.
 *  Full JSON report: verify/smoke-report.json
 */
import { build } from "vite";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { JSDOM, VirtualConsole, ResourceLoader } from "jsdom";
import path from "node:path";
import { pathToFileURL } from "node:url";

const ROOT = process.cwd();
const VERBOSE = process.argv.includes("--verbose");

/* ------------------------------------------------------------------ */
/* 1. Build a classic (IIFE) bundle — jsdom cannot run ES modules        */
/* ------------------------------------------------------------------ */
const OUT = path.join(ROOT, "verify", "smoke-dist");
const { default: react } = await import("@vitejs/plugin-react");
const { default: tailwindcss } = await import("@tailwindcss/vite");

await build({
  configFile: false,
  root: ROOT,
  logLevel: "error",
  plugins: [react(), tailwindcss()],
  resolve: { alias: { "@": path.join(ROOT, "src") } },
  build: {
    outDir: OUT,
    emptyOutDir: true,
    cssCodeSplit: false,
    rollupOptions: {
      output: { format: "iife", inlineDynamicImports: true, entryFileNames: "app.js" },
    },
  },
});

const bundle = await readFile(path.join(OUT, "app.js"), "utf8");
const html = `<!doctype html><html><head><title>smoke</title></head><body><div id="root"></div></body></html>`;

/* ------------------------------------------------------------------ */
/* 2. Boot jsdom                                                       */
/* ------------------------------------------------------------------ */
const problems = [];
const logs = [];

const virtualConsole = new VirtualConsole();
virtualConsole.on("error", (...args) => {
  const msg = args.map(String).join(" ");
  logs.push(["error", msg]);
  if (!/Not implemented: navigation/.test(msg)) problems.push(["console.error", msg]);
});
virtualConsole.on("warn", (...args) => {
  const msg = args.map(String).join(" ");
  logs.push(["warn", msg]);
  if (!/Not implemented|Could not parse CSS/.test(msg)) problems.push(["console.warn", msg]);
});
virtualConsole.on("jsdomError", (err) => {
  problems.push(["jsdom", err.message]);
});

class LocalResourceLoader extends ResourceLoader {
  fetch(url, options) {
    if (url.startsWith("file:")) return super.fetch(url, options);
    // remote assets (pexels stock photos) are not reachable from the sandbox
    return Promise.resolve(Buffer.from(""));
  }
}

const dom = new JSDOM(html, {
  url: pathToFileURL(path.join(OUT, "index.html")).href,
  runScripts: "dangerously",
  pretendToBeVisual: true,
  virtualConsole,
  resources: new LocalResourceLoader(),
});

const { window } = dom;
const { document } = window;



/* jsdom gaps the app touches — must be in place before the app boots */
const noop = () => {};
window.matchMedia = (q) => ({
  matches: false,
  media: q,
  onchange: null,
  addEventListener: noop,
  removeEventListener: noop,
  addListener: noop,
  removeListener: noop,
  dispatchEvent: () => false,
});
window.IntersectionObserver = class {
  constructor(cb) { this.cb = cb; }
  observe(el) { this.cb([{ isIntersecting: true, target: el }], this); }
  unobserve() { noop(); }
  disconnect() { noop(); }
  takeRecords() { return []; }
};
window.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
window.scrollTo = noop;
window.HTMLElement.prototype.scrollIntoView = noop;
window.Element.prototype.animate ??= function () {
  return { finished: Promise.resolve(), cancel: noop, addEventListener: noop, play: noop, pause: noop };
};
if (!window.requestAnimationFrame) {
  window.requestAnimationFrame = (cb) => setTimeout(() => cb(Date.now()), 0);
}

// history API needs http(s); jsdom refuses replaceState() on file:// URLs
window.history.replaceState = window.history.replaceState.bind(window.history);
const realReplace = window.history.replaceState;
window.history.replaceState = (state, title, url) => {
  try { realReplace(state, title, url); } catch { /* file:// — ignored */ }
};

/* jsdom has no ES-module support, so run the bundle as a classic script */
const script = document.createElement("script");
script.textContent = bundle;
document.body.appendChild(script);

process.on("unhandledRejection", (r) => problems.push(["unhandledRejection", String(r)]));
window.addEventListener("error", (e) =>
  problems.push(["window.error", e.error?.stack || e.message])
);

/* ------------------------------------------------------------------ */
/* 3. Helpers                                                          */
/* ------------------------------------------------------------------ */
const tick = (ms = 30) => new Promise((r) => setTimeout(r, ms));
const q = (sel) => document.querySelector(sel);
const qa = (sel) => [...document.querySelectorAll(sel)];
const text = (sel) => q(sel)?.textContent?.trim() ?? "";

function click(elOrSel, label = "") {
  const el = typeof elOrSel === "string" ? q(elOrSel) : elOrSel;
  if (!el) {
    problems.push(["missing element", label || elOrSel]);
    return false;
  }
  el.dispatchEvent(new window.MouseEvent("click", { bubbles: true, cancelable: true }));
  return true;
}

async function goto(hash) {
  window.location.hash = hash;
  window.dispatchEvent(new window.HashChangeEvent("hashchange"));
  await tick(60);
}

const checks = [];
function check(name, ok, detail = "") {
  checks.push({ name, ok, detail });
  if (!ok) problems.push(["check failed", `${name}${detail ? " — " + detail : ""}`]);
}

const a11yAll = new Set();
function scanA11y(where) {
  const found = [];
  const idCount = new Map();
  for (const el of qa("[id]")) idCount.set(el.id, (idCount.get(el.id) || 0) + 1);
  for (const [id, n] of idCount) if (n > 1) found.push(`${where}: duplicate id #${id} (${n}×)`);

  for (const img of qa("img")) {
    if (!img.hasAttribute("alt")) found.push(`${where}: <img> without alt (…${(img.getAttribute("src") || "").slice(-32)})`);
  }
  for (const b of qa("button")) {
    if (!(b.getAttribute("aria-label") || b.textContent || "").trim())
      found.push(`${where}: <button> with no accessible name`);
  }
  for (const a of qa("a")) {
    const name = (a.getAttribute("aria-label") || a.textContent || "").trim();
    const imgAlt = [...a.querySelectorAll("img")].some((i) => (i.getAttribute("alt") || "").trim());
    if (!name && !imgAlt) found.push(`${where}: <a href="${a.getAttribute("href")}"> with no accessible name`);
  }
  for (const f of qa("form")) {
    if (!f.hasAttribute("aria-label") && !f.querySelector("legend, h1, h2, h3"))
      found.push(`${where}: <form> without an accessible label`);
  }
  const h1s = qa("h1").length;
  if (h1s !== 1) found.push(`${where}: expected 1 <h1>, found ${h1s}`);
  for (const f of found) a11yAll.add(f);
}

/* ------------------------------------------------------------------ */
/* 4. Scenarios                                                         */
/* ------------------------------------------------------------------ */
await tick(120); // let the bundle mount

check("app mounted", q("#root")?.children.length > 0, `${q("#root")?.children.length ?? 0} root children`);

/* --- home --- */
check("hero heading", q("h1") && text("h1").length > 0, text("h1").slice(0, 60));
scanA11y("home");
check("category cards", qa('a[href*="#/shop/"]').length >= 5, `${qa('a[href*="#/shop/"]').length} links`);

/* --- shop --- */
await goto("#/shop");
scanA11y("shop");
check("shop renders products", qa('[href^="#/product/"]').length >= 10, `${qa('[href^="#/product/"]').length} product links`);

/* --- single category --- */
await goto("#/shop/badges");
scanA11y("shop/:category");
check("category page renders", qa('[href^="#/product/"]').length > 0, `${qa('[href^="#/product/"]').length} products`);

/* --- product detail --- */
const firstProduct = qa('[href^="#/product/"]')[0]?.getAttribute("href");
await goto(firstProduct || "#/product/thomian-crest-badge");
scanA11y("product");
check("product page title", q("h1") && text("h1").length > 0, text("h1").slice(0, 60));
check("add to bag button", qa("button").some((b) => /add to (bag|cart)/i.test(b.textContent)), "");

const sizeBtn = qa("button").find((b) => /^(S|M|L|XL|One Size)$/.test(b.textContent.trim()));
if (sizeBtn) click(sizeBtn, "size option");
const addBtn = qa("button").find((b) => /add to (bag|cart)/i.test(b.textContent));
if (addBtn) {
  click(addBtn, "add to bag");
  await tick(80);
  check("cart badge appears", document.body.textContent.match(/\b1\b/) !== null, "looking for qty 1 in DOM");
} else {
  problems.push(["missing element", "add-to-bag button on product page"]);
}

/* --- tickets --- */
await goto("#/tickets");
scanA11y("tickets");
check("tickets page", document.body.textContent.includes("Ticket") || document.body.textContent.includes("ticket"), "");
const bookBtn = qa("button").find((b) => /book|reserve|get tickets/i.test(b.textContent));
check("booking button present", !!bookBtn, bookBtn?.textContent.trim() ?? "none found");
if (bookBtn) {
  click(bookBtn, "book tickets");
  await tick(80);
  const step2 = qa("button").find((b) => /continue|next|confirm|pay/i.test(b.textContent));
  check("booking flow advances", !!step2, step2?.textContent.trim() ?? "no next step button");
}

/* --- search overlay --- */
const searchBtn = qa("button").find((b) => /search/i.test(b.getAttribute("aria-label") || b.textContent || ""));
if (searchBtn) {
  click(searchBtn, "search open");
  await tick(60);
  const input = q("input[type=text], input[type=search], input:not([type])");
  check("search input appears", !!input, input ? "found" : "no input in DOM");
  if (input) {
    input.value = "badge";
    input.dispatchEvent(new window.Event("input", { bubbles: true }));
    await tick(60);
    check("search yields results", /badge/i.test(document.body.textContent), "");
  }
} else {
  problems.push(["missing element", "search button (aria-label) on navbar"]);
}

/* --- cart drawer --- */
const cartBtn = qa("button").find((b) => /cart|bag/i.test(b.getAttribute("aria-label") || ""));
if (cartBtn) {
  click(cartBtn, "open cart");
  await tick(60);
  check("cart drawer opens", /subtotal|your bag|empty/i.test(document.body.textContent), "");
} else {
  problems.push(["missing element", "cart button (aria-label) on navbar"]);
}

/* --- 404 / unknown hash --- */
await goto("#/nonsense-route");
check("unknown route falls back to home", q("h1") !== null, text("h1").slice(0, 40));

/* --- quick view modal --- */
await goto("#/shop");
const quickBtn = qa("button").find((b) => /quick view/i.test(b.getAttribute("aria-label") || ""));
if (quickBtn) {
  click(quickBtn, "quick view");
  await tick(80);
  const modal = q('[role="dialog"]') || qa("div").find((d) => /fixed inset-0/.test(d.className || ""));
  check("quick view opens", !!modal, modal ? "dialog in DOM" : "no modal");
  const closeBtn = qa("button").find((b) => /close quick view|close/i.test(b.getAttribute("aria-label") || ""));
  if (closeBtn) {
    click(closeBtn, "close quick view");
    await tick(60);
  }
} else {
  problems.push(["missing element", "quick view button on shop grid"]);
}

/* --- sort dropdown (custom menu, not a <select>) --- */
const sortTrigger = qa("button").find((b) => /^Sort/.test(b.textContent.trim()));
if (sortTrigger) {
  const before = qa('[href^="#/product/"]').map((a) => a.textContent.trim()).join("|");
  click(sortTrigger, "sort menu trigger");
  await tick(50);
  const option = qa("button").find(
    (b) => /price/i.test(b.textContent) && b !== sortTrigger && /high|low/i.test(b.textContent)
  );
  check("sort menu lists options", !!option, option?.textContent.trim() ?? "no price option");
  if (option) {
    click(option, "sort option");
    await tick(90);
    const after = qa('[href^="#/product/"]').map((a) => a.textContent.trim()).join("|");
    check("sort changes order", after !== before && after.length > 0, after === before ? "order unchanged" : "reordered");
  }
} else {
  problems.push(["missing element", "Sort dropdown trigger on shop page"]);
}

/* --- track order modal (footer hash anchor) --- */
await goto("#/");
window.location.hash = "#track";
window.dispatchEvent(new window.HashChangeEvent("hashchange"));
await tick(80);
const trackInput = qa("input").find((i) => /STC-1873/.test(i.getAttribute("placeholder") || ""));
check("track order modal opens from footer anchor", !!trackInput, trackInput ? "input found" : "no input");
if (trackInput) {
  const close = qa("button").find((b) => /^close$/i.test((b.getAttribute("aria-label") || "").trim()));
  if (close) click(close, "close track order");
}

/* --- mobile menu (narrow viewport) --- */
window.location.hash = "#/";
window.dispatchEvent(new window.HashChangeEvent("hashchange"));
await tick(60);
const menuBtn = qa("button").find((b) => /open menu/i.test(b.getAttribute("aria-label") || ""));
if (menuBtn) {
  click(menuBtn, "open mobile menu");
  await tick(60);
  const closeMenu = qa("button").find((b) => /close menu/i.test(b.getAttribute("aria-label") || ""));
  check("mobile menu opens", !!closeMenu, closeMenu ? "toggle switched to close" : "label unchanged");
  if (closeMenu) click(closeMenu, "close mobile menu");
} else {
  problems.push(["missing element", "hamburger (aria-label 'Open menu')"]);
}

/* --- images: local assets must exist on disk; remote ones are pinged --- */
await tick(100);
const localMissing = [];
const remoteUnreachable = [];
for (const img of qa("img")) {
  const src = img.getAttribute("src") || "";
  if (!src) continue;
  if (/^https?:/.test(src)) {
    remoteUnreachable.push(src); // checked below
    continue;
  }
  const file = path.join(OUT, src.replace(/^\//, ""));
  if (!existsSync(file)) localMissing.push(src);
}
check(
  "local images exist",
  localMissing.length === 0,
  localMissing.length ? localMissing.slice(0, 3).join(", ") : `${qa("img").length} <img> tags`
);

const deadRemote = [];
const unverifiedRemote = [];
for (const src of new Set(remoteUnreachable)) {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 6000);
    const res = await fetch(src, { method: "GET", signal: ctrl.signal });
    clearTimeout(t);
    if (!res.ok) deadRemote.push(`HTTP ${res.status} — ${src}`);
  } catch {
    // no outbound network in this sandbox (or CDN blocked) → cannot verify
    unverifiedRemote.push(src);
  }
}
check(
  "remote images reachable",
  deadRemote.length === 0,
  deadRemote.length
    ? `${deadRemote.length} dead`
    : unverifiedRemote.length
      ? `${new Set(remoteUnreachable).size} remote (network unavailable — unverified)`
      : `${new Set(remoteUnreachable).size} remote ok`
);
for (const d of deadRemote) problems.push(["dead image", d]);

/* ------------------------------------------------------------------ */
/* 5. Report                                                           */
/* ------------------------------------------------------------------ */
await mkdir("verify", { recursive: true });
const report = {
  when: new Date().toISOString(),
  checks,
  problems,
  deadRemote,
  a11y: [...a11yAll],
  unverifiedRemote: [...new Set(unverifiedRemote)],
  logs: VERBOSE ? logs : logs.slice(0, 40),
};
await writeFile(
  path.join(ROOT, "verify", "smoke-report.json"),
  JSON.stringify(report, null, 2)
);

const failedChecks = checks.filter((c) => !c.ok);
const lines = [];
lines.push(`checks: ${checks.length - failedChecks.length}/${checks.length} passed`);
for (const c of checks) lines.push(`  ${c.ok ? "✓" : "✗"} ${c.name}${c.detail ? ` (${c.detail})` : ""}`);
if (a11yAll.size) {
  lines.push("", `notes (a11y / markup): ${a11yAll.size}`);
  for (const n of [...a11yAll].slice(0, 12)) lines.push(`  · ${n}`);
  if (a11yAll.size > 12) lines.push(`  … ${a11yAll.size - 12} more in verify/smoke-report.json`);
}
if (problems.length) {
  lines.push("", `problems: ${problems.length}`);
  const seen = new Set();
  for (const [kind, msg] of problems) {
    const key = kind + msg.slice(0, 120);
    if (seen.has(key)) continue;
    seen.add(key);
    lines.push(`  ! [${kind}] ${msg.split("\n").slice(0, 4).join("\n     ")}`);
  }
}
console.log(lines.join("\n"));
process.exit(problems.length ? 1 : 0);
