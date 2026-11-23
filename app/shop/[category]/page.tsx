import { notFound } from "next/navigation";
import ShopView, { shopCategories, shopMetadata } from "@/components/pages/ShopView";

export const revalidate = 300;

type Params = Promise<{ category: string }>;

/** Prerender one page per collection present in the database (or the seed). */
export async function generateStaticParams() {
  const categories = await shopCategories();
  return categories.map((c) => ({ category: c.slug }));
}

export const generateMetadata = async ({ params }: { params: Params }) => {
  const { category } = await params;
  return shopMetadata(category);
};

export default async function Category({ params }: { params: Params }) {
  const { category } = await params;
  const categories = await shopCategories();
  if (!categories.some((c) => c.slug === category)) notFound();
  return <ShopView category={category} />;
}
