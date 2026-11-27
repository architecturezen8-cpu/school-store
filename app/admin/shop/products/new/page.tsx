import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { isAdmin } from "@/lib/admin/auth";
import { databaseProblem } from "@/lib/admin/db-guard";
import { hasDatabase } from "@/lib/db";
import { listAdminCategories, listAdminProducts, listFilters } from "@/lib/catalog";
import ProductEditor from "@/components/admin/ProductEditor";
import { Notice } from "@/components/admin/ui";
import { ArrowLeft } from "lucide-react";
import { saveProductAction, uploadProductImageAction } from "../../actions";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "New product",
  robots: { index: false, follow: false },
};

export default async function NewProductPage() {
  if (!(await isAdmin())) redirect("/admin?next=/admin/shop/products/new");
  if (!hasDatabase()) redirect("/admin?error=database");

  const problem = databaseProblem();
  const [categories, products, filters] = await Promise.all([
    listAdminCategories(),
    listAdminProducts(),
    listFilters(),
  ]);

  const colours = filters.filter((f) => f.kind === "colour");
  const sizes = filters.filter((f) => f.kind === "size");

  return (
    <div className="space-y-3">
      <section className="rounded-2xl bg-panel px-6 py-4">
        <Link
          href="/admin/shop"
          className="inline-flex items-center gap-1.5 text-[11px] uppercase tracking-[0.16em] text-muted hover:text-strong"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Products
        </Link>
        {problem && (
          <div className="mt-3">
            <Notice tone="warn">{problem}</Notice>
          </div>
        )}
      </section>

      <ProductEditor
        initial={{
          slug: "",
          name: "",
          price: 0,
          image: "",
          tag: "",
          category: categories[0]?.slug ?? "",
          rating: 0,
          reviews: 0,
          description: "",
          details: [],
          options: null,
          gallery: [],
          colours: [],
          isFeatured: false,
          isNew: true,
          active: true,
          stock: {},
        }}
        mode="create"
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
