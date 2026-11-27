import type { MetadataRoute } from "next";

// Static export friendly (needs an explicit dynamic setting under output: export).
export const dynamic = "force-static";

const base = process.env.NEXT_PUBLIC_SITE_URL ?? "https://the-thomian-store.vercel.app";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/api/"] }],
    sitemap: `${base}/sitemap.xml`,
  };
}
