import type { Metadata, Viewport } from "next";
import "./globals.css";
import { CartProvider } from "@/components/context/CartContext";
import SiteChrome from "@/components/SiteChrome";
import { getProducts } from "@/lib/store";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://the-thomian-store.vercel.app";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "St. Thomas' College Matale — The Thomian Store",
    template: "%s · The Thomian Store",
  },
  description:
    "The official store of St. Thomas' College Matale. Merchandise, event tickets, uniforms & badges — Animo et Fide, Est. 1873.",
  keywords: [
    "St. Thomas' College Matale",
    "Thomian Store",
    "college merchandise",
    "school uniforms Sri Lanka",
    "Big Match tickets",
  ],
  openGraph: {
    type: "website",
    siteName: "The Thomian Store",
    title: "St. Thomas' College Matale — The Thomian Store",
    description:
      "Merchandise, event tickets, uniforms & badges — the official store of St. Thomas' College Matale.",
    images: ["/images/hero-1.jpg"],
  },
  twitter: { card: "summary_large_image" },
  icons: { icon: `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/favicon.svg` },
};

export const viewport: Viewport = {
  themeColor: "#04060d",
  colorScheme: "dark",
};

/** Only the fields the search overlay needs — keeps the RSC payload small. */
const searchFields = (p: { slug: string; name: string; price: number; image: string; category: string }) => ({
  slug: p.slug,
  name: p.name,
  price: p.price,
  image: p.image,
  category: p.category,
});

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const products = await getProducts();
  const searchIndex = products.map((p) => ({
    ...searchFields(p),
    rating: 0,
    reviews: 0,
    description: "",
    details: [],
  }));
  return (
    <html lang="en">
      <body className="bg-ink text-white">
        <div className="grain-overlay" aria-hidden />
        <CartProvider>
          <SiteChrome searchIndex={searchIndex}>{children}</SiteChrome>
        </CartProvider>
      </body>
    </html>
  );
}
