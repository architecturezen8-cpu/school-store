/**
 * Copies the single-file production build into docs/ so GitHub Pages can serve
 * it straight from the branch (Settings → Pages → Branch: <branch>, Folder: /docs).
 */
import { copyFile, writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";

// Vite keeps the entry's relative path in the output, so the built page can be
// at dist/index.html or dist/app/index.html depending on the entry location.
const built = ["dist/index.html", "dist/app/index.html"].find((f) => existsSync(f));
if (!built) {
  console.error("No build output found — run `npm run build` first.");
  process.exit(1);
}

await mkdir("docs", { recursive: true });
await copyFile(built, "docs/index.html");
await writeFile("docs/.nojekyll", "");
console.log("docs/index.html written");
