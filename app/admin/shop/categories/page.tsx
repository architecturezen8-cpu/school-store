import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { isAdmin } from "@/lib/admin/auth";
import { databaseProblem } from "@/lib/admin/db-guard";
import { hasDatabase } from "@/lib/db";
import { listAdminCategories } from "@/lib/catalog";
import { safeDecode } from "@/lib/safe-decode";
import ParamToast from "@/components/admin/ParamToast";
import { Empty, Notice, PageHeader, Panel } from "@/components/admin/ui";
import AdminImage from "@/components/admin/AdminImage";
import { ArrowLeft, ArrowUpRight, FolderPlus } from "lucide-react";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Categories",
  robots: { index: false, follow: false },
};

export default async function CategoriesPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  if (!(await isAdmin())) redirect("/admin?next=/admin/shop/categories");
  if (!hasDatabase()) redirect("/admin?error=database");

  const { ok, error } = await searchParams;
  const problem = databaseProblem();
  const categories = await listAdminCategories();

  return (
    <div className="space-y-3">
      <section className="rounded-2xl bg-panel p-6">
        <Link
          href="/admin/shop"
          className="inline-flex items-center gap-1.5 text-[11px] uppercase tracking-[0.16em] text-muted hover:text-strong"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Products
        </Link>
        <div className="mt-3">
          <PageHeader
            eyebrow="Shop"
            title="Categories"
            description="The collections down the side of the shop. A picture, a name, and a line of copy — the number of items is counted, never typed."
            actions={
              <Link
                href="/admin/shop/categories/new"
                className="inline-flex items-center gap-2 rounded-xl bg-gold px-4 py-2.5 text-sm font-semibold text-black hover:bg-gold-bright"
              >
                <FolderPlus className="h-4 w-4" /> New category
              </Link>
            }
          />
        </div>
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

      {categories.length === 0 ? (
        <Panel title="Collections">
          <Empty>No categories yet. A product needs one to live in.</Empty>
        </Panel>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {categories.map((c) => (
            <li key={c.slug}>
              <Link
                href={`/admin/shop/categories/${c.slug}`}
                className="group block overflow-hidden rounded-2xl bg-panel transition-colors hover:bg-panel-2"
              >
                <div className="relative aspect-[16/9] overflow-hidden bg-well">
                  {c.image ? (
                    <AdminImage
                      src={c.image}
                      alt=""
                      className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                    />
                  ) : (
                    <span className="grid h-full place-items-center text-xs text-muted">
                      no picture
                    </span>
                  )}
                  <span className="absolute right-2 top-2 rounded-md bg-page/90 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-strong">
                    {c.items} {c.items === 1 ? "item" : "items"}
                  </span>
                </div>
                <div className="flex items-start justify-between gap-3 p-4">
                  <div className="min-w-0">
                    <p className="truncate font-display text-lg text-strong">{c.title}</p>
                    <p className="mt-0.5 truncate text-[11px] text-muted">
                      {c.blurb || c.description || "No line of copy"}
                    </p>
                  </div>
                  <ArrowUpRight className="mt-1 h-4 w-4 shrink-0 text-muted transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
