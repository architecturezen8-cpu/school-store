import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { isAdmin } from "@/lib/admin/auth";
import { hasDatabase } from "@/lib/db";
import { listBookings } from "@/lib/bookings";
import GateScanner from "@/components/admin/GateScanner";
import { PageHeader, Pill, Stat } from "@/components/admin/ui";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Gate scanner",
  robots: { index: false, follow: false },
};

/**
 * The gate scanner, inside the admin.
 *
 * `/gate` still exists for a volunteer who is handed a phone that is already
 * signed in — it is the same component with the storefront around it. This is
 * the same screen without leaving the panel.
 */
export default async function AdminGatePage() {
  if (!hasDatabase()) redirect("/admin?error=database");
  if (!(await isAdmin())) redirect("/admin?next=/admin/gate");

  const bookings = await listBookings(300);
  const admitted = bookings.filter((b) => b.admittedAt).length;

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:py-10">
      <PageHeader
        eyebrow="At the door"
        title="Gate scanner"
        description="Scan a ticket to admit one entry. The same code scanned twice shows the first admission instead of letting anyone through again."
        actions={<Pill tone="gold">{bookings.length - admitted} still to come</Pill>}
      />

      <dl className="mt-6 grid gap-3 sm:grid-cols-3">
        <Stat label="Sold" value={String(bookings.length)} />
        <Stat label="Admitted" value={String(admitted)} />
        <Stat label="Outstanding" value={String(bookings.length - admitted)} />
      </dl>

      <div className="mt-6 overflow-hidden rounded-xl border border-navy-700 bg-navy-900 p-4 sm:p-5">
        <GateScanner />
      </div>
    </div>
  );
}
