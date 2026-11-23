import type { Metadata } from "next";
import ShopPage from "@/components/pages/ShopPage";
import { getCategories, getProducts } from "@/lib/store";

/**
 * Shared renderer for /shop and /shop/[category].
 *
 * Categories are real paths rather than a ?category= query so every collection
 * is statically exportable (no searchParams) and gets its own indexable URL.
 */
export async function shopMetadata(category?: string): Promise<Metadata> {
  const categories = await getCategories();
  const match = categories.find((c) => c.slug === category);

  if (!match) {
    return {
      title: "The Thomian Store",
      description:
        "Badges, uniforms, event wear, exam papers and batch shirts — everything a Thomian needs, in one place.",
    };
  }
  return {
    title: match.title,
    description: `${match.desc} Shop ${match.title.toLowerCase()} at The Thomian Store.`,
    alternates: { canonical: `/shop/${match.slug}` },
  };
}

/** Categories that exist, so /shop/[category] can be fully prerendered. */
export async function shopCategories() {
  return getCategories();
}

export default async function ShopView({ category }: { category?: string }) {
  const [products, categories] = await Promise.all([getProducts(), getCategories()]);
  return <ShopPage category={category} products={products} categories={categories} />;
}
