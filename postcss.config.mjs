/**
 * Tailwind v4 via PostCSS.
 *
 * Normally `@tailwindcss/postcss` uses the native oxide binary. Inside a browser
 * IDE (StackBlitz / CodeSandbox / a WebContainer) native binaries cannot load —
 * only the WASM build can. There is no reliable way to ask "am I in a browser?",
 * so the choice is explicit and defaults to the native path:
 *
 *   TAILWIND_ENGINE=wasm   use @tailwindcss/oxide-wasm32-wasi
 *   (anything else)        use the native package
 *
 * `.env` in the browser-IDE setup sets it; nothing else needs to know.
 */
import { createRequire } from "node:module";

const useWasm = process.env.TAILWIND_ENGINE === "wasm";
const require = createRequire(import.meta.url);

const config = {
  plugins: {
    "@tailwindcss/postcss": useWasm
      ? { oxide: require("@tailwindcss/oxide-wasm32-wasi") }
      : {},
  },
};

export default config;
