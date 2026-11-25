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
    <div className="space-y-3">
      <section className="rounded-2xl bg-navy-900 p-6">
        <PageHeader
          eyebrow="At the door"
          title="Gate scanner"
          description="Scan a ticket to admit one entry. The same code scanned twice shows the first admission instead of letting anyone through again."
          actions={<Pill tone="invert">{bookings.length - admitted} still to come</Pill>}
        />
      </section>

      <dl className="grid gap-3 sm:grid-cols-3">
        <Stat label="Sold" value={String(bookings.length)} />
        <Stat label="Admitted" value={String(admitted)} tone="invert" />
        <Stat label="Outstanding" value={String(bookings.length - admitted)} />
      </dl>

      <section className="rounded-2xl bg-navy-900 p-4 sm:p-6">
        <GateScanner />
      </section>
    </div>
  );
}
