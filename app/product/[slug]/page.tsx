import type { Metadata } from "next";
import { notFound } from "next/navigation";
import ProductPage from "@/components/pages/ProductPage";
import { getCategories, getProduct, getProducts } from "@/lib/store";
import { lkr } from "@/data/seed";

export const revalidate = 300;
// Every product is prerendered; unknown slugs still reach notFound() on a server,
// while a static export simply 404s at the host level.
export const dynamicParams = false;

type Params = Promise<{ slug: string }>;

/** One page per product, so the static export has every product URL. */
export async function generateStaticParams() {
  const products = await getProducts();
  return products.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { slug } = await params;
  const product = await getProduct(slug);
  if (!product) return { title: "Product not found" };

  return {
    title: product.name,
    description: `${product.description} ${lkr(product.price)} — The Thomian Store.`,
    openGraph: {
      title: product.name,
      description: product.description,
      images: [product.image],
    },
  };
}

export default async function Product({ params }: { params: Params }) {
  const { slug } = await params;
  const [products, categories] = await Promise.all([getProducts(), getCategories()]);

  // `notFound()` renders app/not-found.tsx with a real 404 status.
  if (!products.some((p) => p.slug === slug)) notFound();

  return <ProductPage slug={slug} products={products} categories={categories} />;
}
