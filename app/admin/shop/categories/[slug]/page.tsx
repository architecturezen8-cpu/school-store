import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { isAdmin } from "@/lib/admin/auth";
import { databaseProblem } from "@/lib/admin/db-guard";
import { hasDatabase } from "@/lib/db";
import { getAdminCategory, listAdminProducts } from "@/lib/catalog";
import { safeDecode } from "@/lib/safe-decode";
import ParamToast from "@/components/admin/ParamToast";
import SubmitButton from "@/components/SubmitButton";
import AdminImage from "@/components/admin/AdminImage";
import {
  Field,
  Notice,
  Panel,
  buttonClass,
  inputClass,
} from "@/components/admin/ui";
import { ArrowLeft, Trash2 } from "lucide-react";
import { deleteCategoryAction, saveCategoryAction } from "../../actions";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Edit category",
  robots: { index: false, follow: false },
};

export default async function EditCategoryPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  const { slug } = await params;
  const { ok, error } = await searchParams;
  if (!(await isAdmin())) redirect(`/admin?next=/admin/shop/categories/${slug}`);
  if (!hasDatabase()) redirect("/admin?error=database");

  const problem = databaseProblem();
  const [category, products] = await Promise.all([getAdminCategory(slug), listAdminProducts()]);
  if (!category) notFound();

  const mine = products.filter((p) => p.category === category.slug);

  return (
    <div className="space-y-3">
      <section className="rounded-2xl bg-panel px-6 py-4">
        <Link
          href="/admin/shop/categories"
          className="inline-flex items-center gap-1.5 text-[11px] uppercase tracking-[0.16em] text-muted hover:text-strong"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Categories
        </Link>

        {/* The collection's own picture, so the page is not just a form. */}
        <div className="mt-4 flex items-center gap-4">
          <span className="h-16 w-28 shrink-0 overflow-hidden rounded-xl bg-well">
            {category.image ? (
              <AdminImage src={category.image} className="h-full w-full object-cover" />
            ) : (
              <span className="grid h-full w-full place-items-center text-[10px] text-muted">
                no picture
              </span>
            )}
          </span>
          <div className="min-w-0">
            <p className="text-[11px] font-medium uppercase tracking-[0.24em] text-muted">
              Collection
            </p>
            <h1 className="truncate font-display text-2xl font-semibold text-strong">
              {category.title}
            </h1>
            <p className="mt-0.5 text-sm text-muted">
              {category.items} product{category.items === 1 ? "" : "s"} · /shop/{category.slug}
            </p>
          </div>
        </div>
        {problem && (
          <div className="mt-3">
            <Notice tone="warn">{problem}</Notice>
          </div>
        )}
        {(ok || error) && (
          <div className="mt-3">
            <ParamToast ok={ok ? safeDecode(ok) : ""} error={error ? safeDecode(error) : ""} />
          </div>
        )}
      </section>

      <div className="grid gap-3 xl:grid-cols-3">
        <Panel
          title="What the shop says"
          description="The name, the line under it and the picture on the card."
          className="xl:col-span-2"
        >
          <form action={saveCategoryAction} className="space-y-4">
            <input type="hidden" name="mode" value="update" />
            <input type="hidden" name="slug" value={category.slug} />
            <input type="hidden" name="back" value={`/admin/shop/categories/${category.slug}`} />
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Name">
                <input name="title" defaultValue={category.title} required className={inputClass} />
              </Field>
              <Field label="Address" hint="fixed — products and links point at it">
                <input
                  value={category.slug}
                  readOnly
                  disabled
                  className={`${inputClass} font-mono text-xs disabled:opacity-60`}
                />
              </Field>
            </div>
            <Field label="One line under the name">
              <input name="blurb" defaultValue={category.blurb} className={inputClass} />
            </Field>
            <Field label="Description">
              <textarea
                name="description"
                rows={3}
                defaultValue={category.description}
                className={inputClass}
              />
            </Field>
            <div className="grid gap-4 sm:grid-cols-[10rem_1fr]">
              <div>
                <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted">
                  Picture
                </p>
                {category.image ? (
                  <AdminImage
                    src={category.image}
                    className="mt-2 aspect-[4/3] w-full rounded-lg object-cover"
                  />
                ) : (
                  <div className="mt-2 grid aspect-[4/3] place-items-center rounded-lg bg-well text-[11px] text-muted">
                    none
                  </div>
                )}
              </div>
              <div className="space-y-3">
                <Field label="Replace with a file" hint="PNG, JPEG or WebP">
                  <input
                    type="file"
                    name="image"
                    accept="image/png,image/jpeg,image/webp"
                    className={`${inputClass} !py-2 text-xs`}
                  />
                </Field>
                <Field label="…or a picture already on the site">
                  <input
                    name="imageUrl"
                    defaultValue={category.image}
                    className={`${inputClass} font-mono text-xs`}
                  />
                </Field>
              </div>
            </div>
            <SubmitButton pending="Saving…" className={buttonClass("primary")}>
              Save
            </SubmitButton>
          </form>
        </Panel>

        <div className="space-y-3">
          <Panel title="In this collection" description={`${mine.length} products`}>
            {mine.length === 0 ? (
              <p className="text-sm text-muted">Empty. Add a product, or move one in.</p>
            ) : (
              <ul className="space-y-2">
                {mine.slice(0, 6).map((p) => (
                  <li key={p.slug}>
                    <Link
                      href={`/admin/shop/products/${p.slug}`}
                      className="flex items-center gap-3 rounded-lg bg-well p-2 hover:bg-panel-2"
                    >
                      <AdminImage
                        src={p.image || "/images/cat-uniform.jpg"}
                        className="h-9 w-9 rounded-md object-cover"
                      />
                      <span className="min-w-0 flex-1 truncate text-xs text-body">{p.name}</span>
                      {!p.active && <span className="text-[10px] text-muted">hidden</span>}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <Panel title="Remove" tone="sunken">
            <p className="text-xs leading-relaxed text-muted">
              Only an empty collection can be removed — a category that still holds products will
              refuse, with the number of products in the way.
            </p>
            <form action={deleteCategoryAction} className="mt-3">
              <input type="hidden" name="slug" value={category.slug} />
              <SubmitButton
                pending="Removing…"
                confirm={`Remove “${category.title}”?`}
                className={`${buttonClass("danger")} w-full`}
                icon={<Trash2 className="h-4 w-4" />}
              >
                Remove category
              </SubmitButton>
            </form>
          </Panel>
        </div>
      </div>
    </div>
  );
}
