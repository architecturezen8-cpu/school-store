import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { isAdmin } from "@/lib/admin/auth";
import { hasDatabase } from "@/lib/db";
import { databaseProblem } from "@/lib/admin/db-guard";
import { Field, Notice, Panel, buttonClass, inputClass } from "@/components/admin/ui";
import SubmitButton from "@/components/SubmitButton";
import { ArrowLeft } from "lucide-react";
import { saveCategoryAction } from "../../actions";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "New category",
  robots: { index: false, follow: false },
};

export default async function NewCategoryPage() {
  if (!(await isAdmin())) redirect("/admin?next=/admin/shop/categories/new");
  if (!hasDatabase()) redirect("/admin?error=database");
  const problem = databaseProblem();

  return (
    <div className="space-y-3">
      <section className="rounded-2xl bg-panel px-6 py-4">
        <Link
          href="/admin/shop/categories"
          className="inline-flex items-center gap-1.5 text-[11px] uppercase tracking-[0.16em] text-muted hover:text-strong"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Categories
        </Link>
        {problem && (
          <div className="mt-3">
            <Notice tone="warn">{problem}</Notice>
          </div>
        )}
      </section>

      <div className="grid gap-3 xl:grid-cols-3">
        <Panel
          title="A new collection"
          description="A picture and a name is enough. Products can be moved into it from their own page."
          className="xl:col-span-2"
        >
          <form action={saveCategoryAction} className="space-y-4">
            <input type="hidden" name="mode" value="create" />
            <input type="hidden" name="back" value="/admin/shop/categories" />
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Name">
                <input
                  name="title"
                  required
                  placeholder="Gifts & Souvenirs"
                  className={inputClass}
                />
              </Field>
              <Field label="Address" hint="made from the name if you leave it blank">
                <input name="slug" placeholder="gifts-souvenirs" className={`${inputClass} font-mono text-xs`} />
              </Field>
            </div>
            <Field label="One line under the name" hint="“The crest, kept”">
              <input name="blurb" placeholder="Worn with honour" className={inputClass} />
            </Field>
            <Field label="Description">
              <textarea
                name="description"
                rows={3}
                placeholder="What belongs in this collection, in a sentence."
                className={inputClass}
              />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Picture" hint="PNG, JPEG or WebP">
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
                  placeholder="/images/cat-uniform.jpg"
                  className={`${inputClass} font-mono text-xs`}
                />
              </Field>
            </div>
            <SubmitButton pending="Creating…" className={buttonClass("primary")}>
              Create category
            </SubmitButton>
          </form>
        </Panel>

        <Panel title="What a category is" tone="sunken">
          <ul className="space-y-3 text-sm leading-relaxed text-muted">
            <li>
              <span className="text-strong">A shelf, not a filter.</span> The order here is the order
              down the side of the shop.
            </li>
            <li>
              <span className="text-strong">The count is real.</span> It is worked out from the
              products inside, so it cannot go stale.
            </li>
            <li>
              <span className="text-strong">Empty categories are refused.</span> A collection with
              nothing in it is a dead end, and the shop will not draw one.
            </li>
          </ul>
        </Panel>
      </div>
    </div>
  );
}
