import { open } from "./browser.mjs";
import fs from "node:fs";
import { createRequire } from "node:module";

/** Accessibility sweep with axe-core. */
const QA_MODULES = process.env.QA_MODULES ?? "/tmp/qaenv/node_modules";
const require_ = createRequire(QA_MODULES + "/");
const axeSrc = fs.readFileSync(require_.resolve("axe-core/axe.min.js"), "utf8");
const { browser, page } = await open({ width: 1440, height: 900 });
const BASE = process.env.BASE ?? "http://localhost:3000";
const routes = ["/", "/shop", "/shop/badges", "/product/crest-hoodie", "/tickets"];
for (const r of routes) {
  await page.goto(BASE + r, { waitUntil: "networkidle" });
  await page.addScriptTag({ content: axeSrc });
  const res = await page.evaluate(async () => {
    const r = await axe.run(document, { resultTypes: ["violations"] });
    return r.violations.map(v => ({ id: v.id, impact: v.impact, n: v.nodes.length, sample: v.nodes[0]?.target?.join(" ").slice(0, 90) }));
  });
  console.log("\n==" + r, res.length ? JSON.stringify(res, null, 1) : "clean");
}
await browser.close();
