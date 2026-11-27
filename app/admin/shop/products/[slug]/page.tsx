import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { isAdmin } from "@/lib/admin/auth";
import { databaseProblem } from "@/lib/admin/db-guard";
import { hasDatabase } from "@/lib/db";
import {
  getAdminProduct,
  listAdminCategories,
  listAdminProducts,
  listFilters,
} from "@/lib/catalog";
import { safeDecode } from "@/lib/safe-decode";
import ProductEditor from "@/components/admin/ProductEditor";
import ParamToast from "@/components/admin/ParamToast";
import SubmitButton from "@/components/SubmitButton";
import { Notice, buttonClass } from "@/components/admin/ui";
import { ArrowLeft, Trash2 } from "lucide-react";
import { deleteProductAction, saveProductAction, uploadProductImageAction } from "../../actions";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Edit product",
  robots: { index: false, follow: false },
};

export default async function EditProductPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  const { slug } = await params;
  const { ok, error } = await searchParams;
  if (!(await isAdmin())) redirect(`/admin?next=/admin/shop/products/${slug}`);
  if (!hasDatabase()) redirect("/admin?error=database");

  const problem = databaseProblem();
  const [product, categories, products, filters] = await Promise.all([
    getAdminProduct(slug),
    listAdminCategories(),
    listAdminProducts(),
    listFilters(),
  ]);
  if (!product) notFound();

  const colours = filters.filter((f) => f.kind === "colour");
  const sizes = filters.filter((f) => f.kind === "size");

  return (
    <div className="space-y-3">
      <section className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-panel px-6 py-4">
        <Link
          href="/admin/shop"
          className="inline-flex items-center gap-1.5 text-[11px] uppercase tracking-[0.16em] text-muted hover:text-strong"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Products
        </Link>
        <form action={deleteProductAction}>
          <input type="hidden" name="slug" value={product.slug} />
          <input type="hidden" name="back" value="/admin/shop" />
          <SubmitButton
            pending="Removing…"
            confirm={`Remove ${product.name}? If it has ever been sold it is hidden rather than deleted, so the old orders still make sense.`}
            className={`${buttonClass("danger")} !px-3 !py-1.5 !text-xs`}
            icon={<Trash2 className="h-3.5 w-3.5" />}
          >
            Remove
          </SubmitButton>
        </form>
      </section>

      {(ok || error || problem) && (
        <section className="space-y-2">
          {(ok || error) && (
            <ParamToast ok={ok ? safeDecode(ok) : ""} error={error ? safeDecode(error) : ""} />
          )}
          {problem && <Notice tone="warn">{problem}</Notice>}
        </section>
      )}

      <ProductEditor
        initial={{
          slug: product.slug,
          name: product.name,
          price: product.price,
          image: product.image,
          tag: product.tag,
          category: product.category,
          rating: product.rating,
          reviews: product.reviews,
          description: product.description,
          details: product.details,
          options: product.options,
          gallery: product.gallery,
          colours: product.colours,
          colourSwatches: product.colourSwatches,
          isFeatured: product.isFeatured,
          isNew: product.isNew,
          active: product.active,
          stock: product.stock ?? {},
        }}
        mode="update"
        takenSlugs={products.map((p) => p.slug)}
        categories={categories.map((c) => ({ slug: c.slug, title: c.title }))}
        colourOptions={colours.map((f) => f.label)}
        sizeOptions={sizes.map((f) => f.label)}
        saveAction={saveProductAction}
        uploadAction={uploadProductImageAction}
      />
    </div>
  );
}
