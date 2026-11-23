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
import { rename, rm, cp, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { existsSync } from "node:fs";
import { spawnSync } from "node:child_process";

const API = "app/api";
const PARKED = ".api-parked";
const BASE_PATH = "/school-store"; // GitHub Pages project path
const SITE = `https://architecturezen8-cpu.github.io${BASE_PATH}`;

if (existsSync(PARKED)) await rm(PARKED, { recursive: true, force: true });

const hadApi = existsSync(API);
if (hadApi) await rename(API, PARKED);

// --webpack: the WASM Tailwind engine (used in browser IDEs) cannot be statically
// analysed by Turbopack, and webpack is the one engine that works everywhere.
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

if (hadApi) await rename(PARKED, API);
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
