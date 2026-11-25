/**
 * Tailwind v4 via PostCSS.
 *
 * Deliberately a *static* object. The previous version probed for a native
 * engine at load time and swapped in `@tailwindcss/oxide-wasm32-wasi` for
 * browser IDEs, but Turbopack bundles this file and cannot follow a dynamic
 * `require` of a `.node` binary or a `.wasm` module — every page came back 500
 * with "non-ecmascript placeable asset".
 *
 * Tailwind already does that platform selection itself: `@tailwindcss/oxide`
 * resolves its own platform package, and `lightningcss` does the same. Handing
 * it an empty options object is what runs the native binary here, and on a
 * WebContainer the two packages fall back to their own WASM builds if their
 * commit-time detection says so. If a browser IDE ever needs forcing, set
 * `TAILWIND_ENGINE=wasm` and run webpack (`npm run build:pages`), which can load
 * the WASM module that Turbopack cannot.
 */
const config = {
  plugins: { "@tailwindcss/postcss": {} },
};

export default config;
