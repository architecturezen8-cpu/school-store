import type { Metadata, Viewport } from "next";
import "./globals.css";
import { CartProvider } from "@/components/context/CartContext";
import SiteChrome from "@/components/SiteChrome";
import { BrandProvider } from "@/components/context/BrandContext";
import { faviconUrl, getSettings, logoUrl } from "@/lib/settings";
import { getProducts } from "@/lib/store";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://the-thomian-store.vercel.app";

/**
 * Metadata is generated, not declared, because the tab icon is a setting.
 *
 * The icon is uploaded in the admin (`site_settings.favicon`); a `const metadata`
 * would have frozen the built-in mark at build time, and "I uploaded the falcon
 * and it still shows the old one" would be a cache question with no answer.
 */
export async function generateMetadata(): Promise<Metadata> {
  const icon = await faviconUrl();
  return {
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
    // An uploaded icon still wants the built-in one as its shortcut/apple sibling:
    // browsers that ignore `<link rel="icon">` sizes fall back to something rather
    // than to a blank page.
    icons: icon
      ? {
          icon: [{ url: icon, type: "image/png", sizes: "512x512" }],
          shortcut: icon,
          apple: icon,
        }
      : { icon: `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/favicon.svg` },
  };
}

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
  // The logo the admin uploaded, read once here and handed to every surface that
  // shows a mark. One read per request, and no client-side fetch for an image
  // that changes about once a year.
  const [products, logo, settings] = await Promise.all([
    getProducts(),
    logoUrl(),
    getSettings(),
  ]);
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
          <BrandProvider logo={logo} scale={settings.logoScale}>
            <SiteChrome searchIndex={searchIndex}>{children}</SiteChrome>
          </BrandProvider>
        </CartProvider>
      </body>
    </html>
  );
}
