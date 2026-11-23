/**
 * Interaction QA: mobile layout + the real flows (search, bag, checkout,
 * order tracking, ticket booking).
 *
 * Usage: node qa/flows.mjs
 */
import { open, shot } from "./browser.mjs";

const BASE = process.env.BASE ?? "http://localhost:3000";
const out = [];

function log(label, data) {
  out.push({ label, data });
  console.log(label, JSON.stringify(data));
}

/* ---------------- mobile layout ---------------- */
{
  const { browser, page, errors } = await open({ width: 393, height: 850 });
  for (const [name, path] of [
    ["home", "/"],
    ["shop", "/shop"],
    ["product", "/product/crest-hoodie"],
    ["tickets", "/tickets"],
  ]) {
    errors.length = 0;
    await page.goto(BASE + path, { waitUntil: "networkidle" });
    await page.waitForTimeout(500);
    const m = await page.evaluate(() => {
      const winW = window.innerWidth;
      const tiny = [...document.querySelectorAll("main *")]
        .filter((el) => {
          const t = el.textContent?.trim();
          if (!t || el.children.length) return false;
          return parseFloat(getComputedStyle(el).fontSize) < 11;
        })
        .slice(0, 5)
        .map((el) => `${el.tagName} ${getComputedStyle(el).fontSize}: ${el.textContent.trim().slice(0, 30)}`);
      return {
        docW: document.documentElement.scrollWidth,
        winW,
        tiny,
      };
    });
    await shot(page, `m-${name}`, true);
    log("mobile " + name, {
      overflow: m.docW > m.winW ? `${m.docW}>${m.winW}` : "none",
      tinyText: m.tiny,
      errors: errors.slice(0, 2),
    });
  }
  await browser.close();
}
