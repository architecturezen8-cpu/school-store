/**
 * Next.js configuration.
 *
 * `.mjs` on purpose: StackBlitz/CodeSandbox evaluate config files with jiti,
 * whose WASM build refuses `.ts` configs. Keeping this file plain JavaScript
 * means the same config loads locally, on Vercel and inside a WebContainer.
 */

const isStatic = process.env.NEXT_STATIC_EXPORT === "1";
const basePath = process.env.NEXT_BASE_PATH ?? "";

/** @type {import('next').NextConfig} */
const baseConfig = {
  reactStrictMode: true,

  // Dev servers behind a proxy/tunnel host (sandbox previews, StackBlitz) need
  // to be allowed to fetch HMR resources.
  allowedDevOrigins: [
    "*.e2b.app",
    "*.stackblitz.io",
    "*.webcontainer-api.io",
    "*.local-credentialless.webcontainer-api.io",
    "*.csb.app",
  ],

  // PGlite ships WASM plus a node-fs data dir; bundling it breaks its internal
  // path resolution, so let Node require it directly.
  serverExternalPackages: ["@electric-sql/pglite", "sharp"],

  // Ticket artwork is uploaded through a Server Action; the default 1 MB cap is
  // too small for a designed ticket.
  experimental: { serverActions: { bodySizeLimit: "9mb" } },

  ...(basePath ? { basePath, assetPrefix: basePath } : {}),
  ...(isStatic ? { output: "export", images: { unoptimized: true } } : {}),
};

/*
 * A production build must not quietly fill itself in with demo data.
 *
 * `next build` sets STORE_STRICT here rather than in an npm script because
 * `"build": "STORE_STRICT=1 next build"` is POSIX shell syntax — on Windows'
 * cmd.exe it fails with "'STORE_STRICT' is not recognized as an internal or
 * external command". Doing it in the config works on every platform and for
 * anyone who runs `npx next build` directly.
 *
 * The phase argument is used rather than process.env.NEXT_PHASE: the variable
 * is not set when this module body runs, but the argument always is.
 */
export default (phase) => {
  if (phase === "phase-production-build") process.env.STORE_STRICT = "1";
  return baseConfig;
};
