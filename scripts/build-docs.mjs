/**
 * Copies the single-file production build into docs/ so GitHub Pages can serve
 * it straight from the branch (Settings → Pages → Branch: <branch>, Folder: /docs).
 */
import { copyFile, writeFile, mkdir } from "node:fs/promises";

await mkdir("docs", { recursive: true });
await copyFile("dist/index.html", "docs/index.html");
await writeFile("docs/.nojekyll", "");
console.log("docs/index.html written");
