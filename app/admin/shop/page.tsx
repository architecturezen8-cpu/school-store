import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { isAdmin } from "@/lib/admin/auth";
import { databaseProblem } from "@/lib/admin/db-guard";
import { databaseDown, hasDatabase } from "@/lib/db";
import {
  listAdminCategories,
  listAdminProducts,
  productWarnings,
  type AdminProduct,
} from "@/lib/catalog";
import { lkr } from "@/lib/format";
import { safeDecode } from "@/lib/safe-decode";
import ParamToast from "@/components/admin/ParamToast";
import SubmitButton from "@/components/SubmitButton";
import AdminImage from "@/components/admin/AdminImage";
import {
  Empty,
  Eyebrow,
  Notice,
  PageHeader,
  Panel,
  Pill,
  Stat,
  buttonClass,
} from "@/components/admin/ui";
import { AlertTriangle, ArrowUpRight, PackagePlus, Star, Tag } from "lucide-react";
import { toggleProductActiveAction } from "./actions";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Products",
  robots: { index: false, follow: false },
};

/**
 * The shelf, as the admin sees it.
 *
 * Not a table. A shop is pictures of things with a price under them, and every
 * decision on this page — is that photo right, is that badge really "Gold" — is a
 * decision you can only make by looking. So the products are cards, the same
 * shape as the storefront's, and the counts and warnings sit above them.
 */
export default async function ShopAdminPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; error?: string; category?: string }>;
}) {
  if (!(await isAdmin())) redirect("/admin?next=/admin/shop");
  if (!hasDatabase()) redirect("/admin?error=database");

  const { ok, error, category } = await searchParams;
  const problem = databaseProblem();
  const down = databaseDown();
  const [categories, products] = down
    ? [[], [] as AdminProduct[]]
    : await Promise.all([listAdminCategories(), listAdminProducts()]);

  const shown = category ? products.filter((p) => p.category === category) : products;
  const live = products.filter((p) => p.active);
  const hidden = products.length - live.length;
  const warnings = products
    .map((p) => ({ product: p, issues: productWarnings(p, categories) }))
    .filter((w) => w.issues.length);
  const featured = live.filter((p) => p.isFeatured).length;
  const value = live.reduce((n, p) => n + p.price, 0);

  return (
    <div className="space-y-3">
      <section className="rounded-2xl bg-panel p-6">
        <PageHeader
          eyebrow="Shop"
          title="Products"
          description="What the store sells, in the order you would walk past it. Every card here is a card on the storefront."
          actions={
            <Link href="/admin/shop/products/new" className={buttonClass("primary")}>
              <PackagePlus className="h-4 w-4" /> Add a product
            </Link>
          }
        />
        {problem && (
          <div className="mt-4">
            <Notice tone="warn">{problem}</Notice>
          </div>
        )}
        {(ok || error) && (
          <div className="mt-4">
            <ParamToast ok={ok ? safeDecode(ok) : ""} error={error ? safeDecode(error) : ""} />
          </div>
        )}
      </section>

      <dl className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="In the shop" value={String(live.length)} note={`${products.length} in total`} />
        <Stat
          label="Featured"
          value={String(featured)}
          note="on the storefront's top row"
        />
        <Stat
          label="Hidden"
          value={String(hidden)}
          note={hidden ? "not for sale, not deleted" : "everything is live"}
        />
        <Stat label="Shelf value" value={lkr(value)} note="one of each" tone="invert" />
      </dl>

      {warnings.length > 0 && (
        <Panel
          title={`${warnings.length} product${warnings.length === 1 ? "" : "s"} worth a look`}
          description="Not errors — the shop will still sell them. These are the mistakes a customer notices before you do."
          actions={
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-panel-2 text-gold">
              <AlertTriangle className="h-4 w-4" />
            </span>
          }
        >
          <ul className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {warnings.map(({ product, issues }) => (
              <li key={product.slug}>
                <Link
                  href={`/admin/shop/products/${product.slug}`}
                  className="flex items-center gap-3 rounded-xl bg-well p-2 transition-colors hover:bg-panel-2"
                >
                  <AdminImage
                    src={product.image || "/images/cat-uniform.jpg"}
                    className="h-12 w-12 shrink-0 rounded-lg object-cover"
                  />
                  <span className="min-w-0">
                    <span className="block truncate text-sm text-strong">{product.name}</span>
                    <span className="block truncate text-[11px] text-gold">
                      {issues.join(" · ")}
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </Panel>
      )}

      <Panel
        title="The shelf"
        description="Newest categories first. Click a card to change its picture, price or words."
        actions={
          <div className="flex flex-wrap gap-1.5">
            <Link
              href="/admin/shop"
              className={`rounded-full px-3 py-1.5 text-[11px] font-medium ${
                !category ? "bg-gold text-black" : "bg-well text-muted hover:text-strong"
              }`}
            >
              All
            </Link>
            {categories.map((c) => (
              <Link
                key={c.slug}
                href={`/admin/shop?category=${encodeURIComponent(c.slug)}`}
                className={`rounded-full px-3 py-1.5 text-[11px] font-medium ${
                  category === c.slug ? "bg-gold text-black" : "bg-well text-muted hover:text-strong"
                }`}
              >
                {c.title}
              </Link>
            ))}
          </div>
        }
      >
        {shown.length === 0 ? (
          <Empty>
            Nothing here yet.{" "}
            <Link href="/admin/shop/products/new" className="text-gold underline-offset-4 hover:underline">
              Add the first product
            </Link>
            .
          </Empty>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
            {shown.map((p) => (
              <li key={p.slug} data-product={p.slug} className="group relative">
                <Link
                  href={`/admin/shop/products/${p.slug}`}
                  className="block overflow-hidden rounded-xl bg-well transition-colors hover:bg-panel-2"
                >
                  <div className="relative aspect-[4/5] overflow-hidden bg-page">
                    {p.image ? (
                      <AdminImage
                        src={p.image}
                        className="transition-transform duration-500 group-hover:scale-[1.03]"
                      />
                    ) : (
                      <span className="grid h-full place-items-center text-[11px] text-muted">
                        no picture
                      </span>
                    )}
                    {p.tag && (
                      <span className="absolute left-2 top-2 rounded-md bg-gold px-2 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-black">
                        {p.tag}
                      </span>
                    )}
                    {!p.active && (
                      <span className="absolute right-2 top-2 rounded-md bg-page/90 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-strong">
                        hidden
                      </span>
                    )}
                    {p.colours.length > 0 && (
                      <span className="absolute bottom-2 left-2 flex gap-1">
                        {p.colours.slice(0, 4).map((c) => (
                          <span
                            key={c}
                            className="h-3 w-3 rounded-full bg-white/85 ring-1 ring-black/20"
                            title={c}
                          />
                        ))}
                      </span>
                    )}
                  </div>
                  <div className="p-3">
                    <p className="truncate text-sm font-medium text-strong">{p.name}</p>
                    <div className="mt-1 flex items-center justify-between gap-2">
                      <span className="text-sm text-body">{lkr(p.price)}</span>
                      <span className="flex items-center gap-1 text-[11px] text-muted">
                        <Star className="h-3 w-3 fill-gold text-gold" />
                        {p.rating}
                      </span>
                    </div>
                    <p className="mt-1 flex items-center gap-1 truncate text-[11px] text-muted">
                      <Tag className="h-3 w-3" />
                      {categories.find((c) => c.slug === p.category)?.title ?? p.category}
                      {p.options?.values.length
                        ? ` · ${p.options.values.length} ${p.options.label.toLowerCase()}s`
                        : ""}
                    </p>
                  </div>
                </Link>
                <form action={toggleProductActiveAction} className="absolute bottom-3 right-3">
                  <input type="hidden" name="slug" value={p.slug} />
                  <input type="hidden" name="active" value={p.active ? "false" : "true"} />
                  <input type="hidden" name="back" value="/admin/shop" />
                  <SubmitButton
                    pending="…"
                    className={`${buttonClass("ghost")} !px-2 !py-1 !text-[10px]`}
                    ariaLabel={p.active ? `Hide ${p.name}` : `Show ${p.name}`}
                  >
                    {p.active ? "Hide" : "Show"}
                  </SubmitButton>
                </form>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <section className="grid gap-3 sm:grid-cols-2">
        <Link
          href="/admin/shop/categories"
          className="group flex items-center justify-between gap-3 rounded-2xl bg-panel p-5 transition-colors hover:bg-panel-2"
        >
          <span>
            <Eyebrow>Collections</Eyebrow>
            <span className="mt-2 block font-display text-lg text-strong">Categories</span>
            <span className="mt-1 block text-sm text-muted">
              {categories.length} collections · rename, re-picture, remove
            </span>
          </span>
          <ArrowUpRight className="h-5 w-5 text-muted transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
        </Link>
        <Link
          href="/admin/shop/filters"
          className="group flex items-center justify-between gap-3 rounded-2xl bg-panel p-5 transition-colors hover:bg-panel-2"
        >
          <span>
            <Eyebrow>Filters</Eyebrow>
            <span className="mt-2 block font-display text-lg text-strong">Colours &amp; sizes</span>
            <span className="mt-1 block text-sm text-muted">
              The chips a shopper narrows the shelf with
            </span>
          </span>
          <ArrowUpRight className="h-5 w-5 text-muted transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
        </Link>
      </section>
    </div>
  );
}
