import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { isAdmin } from "@/lib/admin/auth";
import GateScanner from "@/components/admin/GateScanner";
import { hasDatabase } from "@/lib/db";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Gate scanner",
  robots: { index: false, follow: false },
};

export default async function GatePage() {
  if (!hasDatabase()) redirect("/admin?error=database");
  if (!(await isAdmin())) redirect("/admin?next=/gate");

  return (
    <section className="mx-auto max-w-xl px-4 pb-16 pt-28 md:pt-32">
      <header className="mb-6">
        <p className="text-[11px] uppercase tracking-[0.3em] text-gold">St. Thomas&apos; College Matale</p>
        <h1 className="mt-2 font-display text-3xl font-semibold text-white">Gate scanner</h1>
        <p className="mt-2 text-sm text-white/70">
          Scan a ticket to admit one entry. Scanning the same ticket twice shows
          the first admission instead of letting the same code through again.
        </p>
      </header>
      <GateScanner />
    </section>
  );
}
