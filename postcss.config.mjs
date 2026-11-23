/**
 * Tailwind v4 via PostCSS.
 *
 * Normally `@tailwindcss/postcss` uses the native oxide binary. Browser IDEs
 * (StackBlitz / CodeSandbox / WebContainer) cannot load native `.node` binaries,
 * so there we hand Tailwind the WASM build instead. Detection is automatic:
 * load the native engine, and if that throws (wrong platform, no binary, a
 * WebContainer) fall back to `@tailwindcss/oxide-wasm32-wasi`.
 *
 * Override with TAILWIND_ENGINE=native|wasm if the guess is ever wrong.
 */
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const forced = process.env.TAILWIND_ENGINE ?? "";

function nativeWorks() {
  if (forced === "wasm") return false;
  try {
    // Resolve from inside @tailwindcss/postcss: oxide is its dependency and may
    // be nested rather than hoisted to the project root.
    const fromPostcss = createRequire(require.resolve("@tailwindcss/postcss"));

    // `oxide` is only a dispatcher — it loads a platform package such as
    // @tailwindcss/oxide-linux-x64-gnu. In a WebContainer that require fails at
    // scan time (no .node binaries), so ask for the platform package directly.
    const platform = {
      linux: { x64: "linux-x64-gnu", arm64: "linux-arm64-gnu" },
      darwin: { x64: "darwin-x64", arm64: "darwin-arm64" },
      win32: { x64: "win32-x64-msvc", arm64: "win32-arm64-msvc" },
    }[process.platform]?.[process.arch];

    if (!platform) return false;
    fromPostcss(`@tailwindcss/oxide-${platform}`);
    return true;
  } catch {
    return false;
  }
}

const useWasm = forced === "wasm" || !nativeWorks();

const config = {
  plugins: {
    "@tailwindcss/postcss": useWasm
      ? { oxide: require("@tailwindcss/oxide-wasm32-wasi") }
      : {},
  },
};

export default config;
