import type { MetadataRoute } from "next";
import { getProducts } from "@/lib/store";

const base = process.env.NEXT_PUBLIC_SITE_URL ?? "https://the-thomian-store.vercel.app";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const products = await getProducts();
  const now = new Date();

  return [
    { url: base, lastModified: now, changeFrequency: "weekly", priority: 1 },
    { url: `${base}/shop`, lastModified: now, changeFrequency: "weekly", priority: 0.9 },
    { url: `${base}/tickets`, lastModified: now, changeFrequency: "daily", priority: 0.8 },
    ...products.map((p) => ({
      url: `${base}/product/${p.slug}`,
      lastModified: now,
      changeFrequency: "monthly" as const,
      priority: 0.7,
    })),
  ];
}
