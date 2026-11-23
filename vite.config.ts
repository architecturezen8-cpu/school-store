import path from "path";
import { fileURLToPath } from "url";
import { existsSync, promises as fs } from "node:fs";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, type Plugin, type ResolvedConfig } from "vite";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Single-file build: one self-contained `index.html` that also runs straight
 * from the filesystem (`file:///…/index.html`).
 *
 * Vite normally emits `<script type="module">` + a separate CSS file. Module
 * scripts are blocked under `file://` (module CORS rules), so this plugin
 * rewrites the emitted HTML instead: it inlines the CSS as a `<style>` in the
 * head and the JS as one classic `<script>` at the end of the body. Images and
 * fonts from `src/assets` are already inlined by `assetsInlineLimit`.
 */
function singleFile(): Plugin {
  let outDir = "dist";

  return {
    name: "single-file",
    apply: "build" as const,
    enforce: "post" as const,
    configResolved(config: ResolvedConfig) {
      outDir = config.build.outDir;
    },
    async closeBundle() {
      // rollup keeps the entry's relative path (app/index.html) in the output
      const candidates = [path.join(outDir, "index.html"), path.join(outDir, "app/index.html")];
      const file = candidates.find((f) => existsSync(f)) ?? candidates[0];
      // stylesheets/scripts are emitted at build.outDir; index.html may be nested
      const assetBase = outDir;
      const resolveAsset = (href: string) => {
        const rel = href.replace(/^\//, "");
        const nested = path.join(path.dirname(file), rel);
        return existsSync(nested) ? nested : path.join(assetBase, rel);
      };
      let html = await fs.readFile(file, "utf8");
      const used = new Set<string>();

      // CSS → <style> in the head
      const links = [...html.matchAll(/<link rel="stylesheet"[^>]*href="([^"]+)"[^>]*>/g)];
      for (const [tag, href] of links) {
        const css = await fs.readFile(resolveAsset(href), "utf8");
        used.add(href);
        html = html.replace(tag, `<style>${css}</style>`);
      }

      // JS → classic <script> at the end of the body
      const scripts = [...html.matchAll(/<script type="module"[^>]*src="([^"]+)"[^>]*><\/script>/g)];
      for (const [tag, src] of scripts) {
        const js = await fs.readFile(resolveAsset(src), "utf8");
        used.add(src);
        html = html.replace(tag, "");
        html = html.replace("</body>", `  <script>${js}</script>\n  </body>`);
      }

      html = html.replace(/<link rel="modulepreload"[^>]*>/g, "");

      // the bundle must never be split across HTML files
      if (!html.includes("<script>")) {
        throw new Error("single-file: no script was inlined — build output changed");
      }

      for (const asset of used) {
        await fs.rm(resolveAsset(asset), { force: true });
      }

      // flatten: always leave the finished page at <outDir>/index.html
      const flat = path.join(outDir, "index.html");
      if (file !== flat) {
        await fs.writeFile(flat, html);
        await fs.rm(path.dirname(file), { recursive: true, force: true });
        await fs.rm(path.join(outDir, "assets"), { recursive: true, force: true });
        console.log(`[single-file] ${path.relative(process.cwd(), flat)} — ${(html.length / 1024).toFixed(0)} KB, self-contained`);
        return;
      }

      await fs.writeFile(file, html);
      console.log(`[single-file] ${path.relative(process.cwd(), flat)} — ${(html.length / 1024).toFixed(0)} KB, self-contained`);
    },
  };
}

// https://vite.dev/config/
export default defineConfig({
  // The app entry lives in app/index.html, NOT the repo root: the root
  // index.html is the GitHub Pages redirect to docs/index.html, and Vite would
  // otherwise treat it as the entry and emit a 1.5 KB "site".
  // NOTE: `root` stays at the repo root on purpose — Tailwind v4 discovers the
  // source files it has to scan from Vite's root. Pointing root at app/ made it
  // scan an empty tree and drop every utility class.
  publicDir: false,
  plugins: [react(), tailwindcss(), singleFile()],
  build: {
    target: "es2020",
    cssCodeSplit: false,
    modulePreload: false,
    // inline every asset (images, fonts) so the HTML is self-contained
    assetsInlineLimit: 100_000_000,
    outDir: path.resolve(__dirname, "dist"),
    emptyOutDir: true,
    rollupOptions: {
      input: path.resolve(__dirname, "app/index.html"),
      output: { format: "iife", inlineDynamicImports: true },
    },
  },
  server: {
    host: "0.0.0.0",
    port: 5173,
    // Allow the sandbox preview host (e.g. *.e2b.app) to load the dev server.
    allowedHosts: true,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
});
