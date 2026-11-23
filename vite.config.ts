import path from "path";
import { fileURLToPath } from "url";
import { promises as fs } from "node:fs";
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
      const file = path.join(outDir, "index.html");
      let html = await fs.readFile(file, "utf8");
      const used = new Set<string>();

      // CSS → <style> in the head
      const links = [...html.matchAll(/<link rel="stylesheet"[^>]*href="([^"]+)"[^>]*>/g)];
      for (const [tag, href] of links) {
        const css = await fs.readFile(path.join(outDir, href.replace(/^\//, "")), "utf8");
        used.add(href);
        html = html.replace(tag, `<style>${css}</style>`);
      }

      // JS → classic <script> at the end of the body
      const scripts = [...html.matchAll(/<script type="module"[^>]*src="([^"]+)"[^>]*><\/script>/g)];
      for (const [tag, src] of scripts) {
        const js = await fs.readFile(path.join(outDir, src.replace(/^\//, "")), "utf8");
        used.add(src);
        html = html.replace(tag, "");
        html = html.replace("</body>", `  <script>${js}</script>\n  </body>`);
      }

      html = html.replace(/<link rel="modulepreload"[^>]*>/g, "");

      // the bundle must never be split across HTML files
      if (!html.includes("<script>")) {
        throw new Error("single-file: no script was inlined — build output changed");
      }

      await fs.writeFile(file, html);
      for (const asset of used) {
        await fs.rm(path.join(outDir, asset.replace(/^\//, "")), { force: true });
      }
    },
  };
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(), singleFile()],
  build: {
    target: "es2020",
    cssCodeSplit: false,
    modulePreload: false,
    // inline every asset (images, fonts) so the HTML is self-contained
    assetsInlineLimit: 100_000_000,
    rollupOptions: {
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
