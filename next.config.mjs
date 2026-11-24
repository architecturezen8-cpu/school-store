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
const nextConfig = {
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

export default nextConfig;
