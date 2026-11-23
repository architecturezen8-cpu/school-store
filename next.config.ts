import type { NextConfig } from "next";

/**
 * Deployed on Vercel (server + database). For a static GitHub Pages preview,
 * set NEXT_STATIC_EXPORT=1 — that produces an `out/` folder, with the caveat
 * that DB-backed routes (order tracking, checkout) need a server and are then
 * served read-only from seed data.
 */
const isStatic = process.env.NEXT_STATIC_EXPORT === "1";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  ...(isStatic ? { output: "export" as const, images: { unoptimized: true } } : {}),
  experimental: {
    serverActions: { bodySizeLimit: "1mb" },
  },
};

export default nextConfig;
