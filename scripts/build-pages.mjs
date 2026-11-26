/**
 * Static build for the GitHub Pages preview.
 *
 * `output: export` refuses to build API routes, and `app/api` is not needed on a
 * static host anyway (there are no server functions there). This script moves the
 * routes aside for the duration of the build, then puts them back — the working
 * tree is left exactly as it was.
 *
 *   npm run build:pages
 */
import { rename, rm, cp, writeFile, readFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { existsSync } from "node:fs";
import { spawnSync } from "node:child_process";

/*
 * Routes that cannot exist on a static host: they read a database, a session
 * cookie or an uploaded ticket on every request, and the export refuses a page
 * marked `force-dynamic`. They are parked for the build and put back afterwards.
 * Only `app/api` was parked before, so once the admin, the gate and the ticket
 * pages went dynamic the static preview stopped building at all.
 */
const PARKED_ROUTES = ["app/api", "app/admin", "app/gate", "app/t", "components/admin"];
const PARKED = ".static-parked";
const BASE_PATH = "/school-store"; // GitHub Pages project path
const SITE = `https://architecturezen8-cpu.github.io${BASE_PATH}`;

if (existsSync(PARKED)) await rm(PARKED, { recursive: true, force: true });

const moved = [];
for (const route of PARKED_ROUTES) {
  if (!existsSync(route)) continue;
  const target = path.join(PARKED, route);
  await mkdir(path.dirname(target), { recursive: true });
  await rename(route, target);
  moved.push([target, route]);
}

// A dev server leaves type validators for the parked routes in .next; they make
// the production type check fail on files that intentionally are not there.
await rm(".next/dev", { recursive: true, force: true });

// --webpack: the WASM Tailwind engine (used in browser IDEs) cannot be statically
// analysed by Turbopack, and webpack is the one engine that works everywhere.
/*
 * `dynamicParams: true` is right for a server — a product added at 9am has to
 * answer before the next deploy — and illegal in an export ("cannot be used with
 * output: export"), where every slug is known when the build starts anyway. The
 * flags are flipped for the build and restored with the parked routes, so the
 * source keeps the value the server needs.
 */
const DYNAMIC_PARAM_PAGES = ["app/product/[slug]/page.tsx", "app/events/[slug]/page.tsx"];
const flipped = [];
for (const file of DYNAMIC_PARAM_PAGES) {
  if (!existsSync(file)) continue;
  const before = await readFile(file, "utf8");
  const after = before.replace(/export const dynamicParams = true;/, "export const dynamicParams = false;");
  if (after === before) continue;
  await writeFile(file, after);
  flipped.push([file, before]);
}

const result = spawnSync("npx", ["next", "build", "--webpack"], {
  stdio: "inherit",
  env: {
    ...process.env,
    NEXT_STATIC_EXPORT: "1",
    NEXT_BASE_PATH: BASE_PATH,
    NEXT_PUBLIC_BASE_PATH: BASE_PATH,
    NEXT_PUBLIC_SITE_URL: SITE,
    DATABASE_URL: "", // build against the seed so the export needs no DB
  },
});

for (const [target, route] of moved) await rename(target, route);
await rm(PARKED, { recursive: true, force: true });
for (const [file, before] of flipped) await writeFile(file, before);
if (result.status !== 0) process.exit(result.status ?? 1);

// ---------------------------------------------------------------------------
//  Turn /shop.html into /shop/index.html
//
//  A static export writes `<route>.html`. GitHub Pages serves `/shop/` from
//  `shop/index.html` (or `shop.html`, but only when the file is a *fallback*),
//  so every route folder gets its HTML as index.html and the siblings are
//  removed. Route folders also carry internal RSC payloads (.txt) that Pages
//  has no use for.
// ---------------------------------------------------------------------------
const { readdir, rm: rmf } = await import("node:fs/promises");

// Pages needs .nojekyll, otherwise `_next/` is skipped by Jekyll.
await rm("docs", { recursive: true, force: true });
await cp("out", "docs", { recursive: true });

// create the folder for each `<route>.html` before moving into it
async function nest(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  for (const e of entries) {
    if (e.name === "_next" || e.name === "images") continue;
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      await nest(full);
      continue;
    }
    if (e.name.endsWith(".txt")) {
      await rm(full, { force: true });
      continue;
    }
    if (e.name.endsWith(".html")) {
      const slug = e.name.slice(0, -5);
      if (slug === "index" || slug === "404") continue;
      const target = path.join(dir, slug, "index.html");
      await mkdir(path.dirname(target), { recursive: true });
      await rename(full, target);
    }
  }
}

await nest("docs");
await writeFile("docs/.nojekyll", "");

// `_not-found` holds only payloads
await rm("docs/_not-found", { recursive: true, force: true });

console.log(`✓ static preview written to docs/ (base path ${BASE_PATH})`);
