import type { NextConfig } from "next";

/**
 * Deployed on Vercel (server + database). For a static GitHub Pages preview,
 * set NEXT_STATIC_EXPORT=1 — that produces an `out/` folder, with the caveat
 * that DB-backed routes (order tracking, checkout) need a server and are then
 * served read-only from seed data.
 */
const isStatic = process.env.NEXT_STATIC_EXPORT === "1";

const basePath = process.env.NEXT_BASE_PATH ?? "";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Dev servers behind a proxy/tunnel host (sandbox previews, StackBlitz) need
  // to be allowed to fetch HMR resources. Any *.e2b.app / *.stackblitz.io host
  // is fine for development; production is unaffected.
  // PGlite ships WASM + a node-fs data dir; bundling it breaks its internal
  // path resolution. Let Node require it directly instead.
  serverExternalPackages: ["@electric-sql/pglite"],
  allowedDevOrigins: [
    "*.e2b.app",
    "*.stackblitz.io",
    "*.webcontainer-api.io",
    "*.local-credentialless.webcontainer-api.io",
  ],
  ...(basePath ? { basePath, assetPrefix: basePath } : {}),
  ...(isStatic ? { output: "export" as const, images: { unoptimized: true } } : {}),
  experimental: {
    serverActions: { bodySizeLimit: "1mb" },
  },
};

export default nextConfig;
