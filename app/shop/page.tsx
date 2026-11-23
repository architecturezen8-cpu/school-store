import type { Metadata } from "next";
import ShopPage from "@/components/pages/ShopPage";
import { getCategories, getProducts } from "@/lib/store";

export const revalidate = 300;

type SearchParams = Promise<{ category?: string }>;

export async function generateMetadata({ searchParams }: { searchParams: SearchParams }): Promise<Metadata> {
  const { category } = await searchParams;
  const categories = await getCategories();
  const match = categories.find((c) => c.slug === category);
  return {
    title: match ? `${match.title} — The Store` : "The Thomian Store",
    description:
      match?.desc ??
      "Badges, uniforms, event wear, exam papers and batch shirts — everything a Thomian needs, in one place.",
  };
}

export default async function Shop({ searchParams }: { searchParams: SearchParams }) {
  const { category } = await searchParams;
  const [products, categories] = await Promise.all([getProducts(), getCategories()]);

  return (
    <ShopPage category={category} products={products} categories={categories} />
  );
}
