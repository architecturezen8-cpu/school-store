/**
 * QA crawl: walks every route, records console errors, broken images,
 * horizontal overflow, and writes a full-page screenshot.
 *
 * Usage: node qa/crawl.mjs [width]
 */
import { open, shot } from "./browser.mjs";

const BASE = process.env.BASE ?? "http://localhost:3000";
const WIDTH = Number(process.argv[2] ?? 1440);

const ROUTES = [
  ["home", "/"],
  ["shop", "/shop"],
  ["badges", "/shop/badges"],
  ["uniforms", "/shop/uniforms"],
  ["product", "/product/crest-hoodie"],
  ["tickets", "/tickets"],
  ["contact", "/contact"],
];

const { browser, page, errors } = await open({ width: WIDTH, height: 900 });

const report = [];

for (const [name, path] of ROUTES) {
  errors.length = 0;
  const res = await page.goto(BASE + path, { waitUntil: "networkidle" });

  // Scroll the whole page so scroll-reveal sections mount like a real visit.
  await page.evaluate(async () => {
    const step = window.innerHeight * 0.7;
    for (let y = 0; y < document.body.scrollHeight; y += step) {
      window.scrollTo(0, y);
      await new Promise((r) => setTimeout(r, 120));
    }
    window.scrollTo(0, 0);
    await new Promise((r) => setTimeout(r, 250));
  });

  const info = await page.evaluate(() => {
    const broken = [...document.images]
      .filter((i) => !i.complete || i.naturalWidth === 0)
      .map((i) => i.currentSrc || i.src);

    const docW = document.documentElement.scrollWidth;
    const winW = window.innerWidth;

    // Only flag elements that are actually clipped and visible: decorative
    // absolutely-positioned art is clipped by an ancestor with overflow-hidden,
    // so DOM position alone is a false positive.
    const clipped = (el) => {
      for (let a = el.parentElement; a; a = a.parentElement) {
        const o = getComputedStyle(a).overflowX;
        if (o === "hidden" || o === "clip" || o === "auto" || o === "scroll") return true;
      }
      return false;
    };

    const overflowing = [...document.querySelectorAll("body *")]
      .filter((el) => {
        const r = el.getBoundingClientRect();
        if (r.width <= 0 || r.right <= winW + 1.5) return false;
        if (clipped(el)) return false;
        const cs = getComputedStyle(el);
        return cs.visibility !== "hidden" && cs.display !== "none";
      })
      .slice(0, 6)
      .map((el) => {
        const r = el.getBoundingClientRect();
        return `${el.tagName.toLowerCase()}.${(el.className || "").toString().split(" ")[0]} right=${Math.round(r.right)}`;
      });

    // Anything still invisible after scrolling past it.
    const invisible = [...document.querySelectorAll("main *")].filter((el) => {
      const cs = getComputedStyle(el);
      const r = el.getBoundingClientRect();
      return (
        cs.opacity === "0" &&
        r.height > 40 &&
        el.textContent.trim().length > 30
      );
    }).length;

    return {
      h1: document.querySelector("h1")?.textContent?.replace(/\s+/g, " ").trim(),
      broken: [...new Set(broken)],
      docW,
      winW,
      overflowing,
      invisible,
      scrollH: document.body.scrollHeight,
    };
  });

  const file = await shot(page, `w${WIDTH}-${name}`);
  report.push({ name, path, status: res?.status(), ...info, errors: [...errors], file });
  console.log(
    `${name.padEnd(8)} ${String(res?.status()).padEnd(3)} h=${info.scrollH} ` +
      `overflow=${info.docW > info.winW ? "YES " + info.docW + ">" + info.winW : "no"} ` +
      `broken=${info.broken.length} invisible=${info.invisible} errors=${errors.length}`
  );
  if (info.overflowing.length) console.log("    overflowing:", info.overflowing);
  if (errors.length) console.log("    errors:", errors.slice(0, 3));
  if (info.broken.length) console.log("    broken img:", info.broken.slice(0, 4));
}

await browser.close();
