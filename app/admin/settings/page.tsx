import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { isAdmin } from "@/lib/admin/auth";
import { getSettings } from "@/lib/settings";
import { hasDatabase } from "@/lib/db";
import { databaseProblem } from "@/lib/admin/db-guard";
import { Eyebrow, Notice, PageHeader } from "@/components/admin/ui";
import LogoForm from "@/components/admin/LogoForm";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "School logo",
  robots: { index: false, follow: false },
};

/**
 * The school's logo.
 *
 * One image, four places: the navbar, the footer, the big mark on the home page,
 * the admin sidebar — and the top of every ticket email. Uploading it once here
 * is why those cannot drift apart.
 */
export default async function SettingsPage() {
  if (!(await isAdmin())) redirect("/admin?next=/admin/settings");
  if (!hasDatabase()) redirect("/admin?error=database");

  const settings = await getSettings();
  const problem = databaseProblem();

  return (
    <div className="grid gap-3 xl:grid-cols-3">
      <section className="rounded-2xl bg-panel p-6 xl:col-span-2">
        <PageHeader
          eyebrow="School"
          title="Logo"
          description="The crest on the storefront and in the admin, and the mark at the top of every ticket email. Upload it once — everything that shows it follows."
        />

        {problem && (
          <div className="mt-4">
            <Notice tone="warn">{problem}</Notice>
          </div>
        )}

        <div className="mt-6">
          <LogoForm current={settings.logo} />
        </div>
      </section>

      <aside className="space-y-3">
        <section className="rounded-2xl bg-panel p-6">
          <Eyebrow>Where it appears</Eyebrow>
          <ul className="mt-3 space-y-2 text-sm leading-relaxed text-body">
            <li>The circle in the top-right of the storefront navbar</li>
            <li>The footer, next to the school&apos;s name</li>
            <li>The big mark on the home page</li>
            <li>The admin sidebar and the mobile header</li>
            <li>The header of every ticket email</li>
          </ul>
          <p className="mt-4 text-xs leading-relaxed text-muted">
            All of them are in a white circle, so the logo reads at any size — which is why
            a dark crest with thin lines works fine even though the site is navy.
          </p>
        </section>

        <section className="rounded-2xl bg-panel p-6">
          <Eyebrow>What works best</Eyebrow>
          <ul className="mt-3 space-y-2 text-sm leading-relaxed text-body">
            <li>A PNG with a transparent background</li>
            <li>Square-ish, or taller than wide (it is never cropped)</li>
            <li>At least 512 px on the short side</li>
          </ul>
          <p className="mt-4 text-xs leading-relaxed text-muted">
            It is padded onto a white square and saved at 512 px, so a phone photo of the
            crest will look soft. Scan or export it if you have the original.
          </p>
        </section>
      </aside>
    </div>
  );
}
