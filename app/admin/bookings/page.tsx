import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { isAdmin } from "@/lib/admin/auth";
import { databaseProblem } from "@/lib/admin/db-guard";
import { databaseDown, hasDatabase } from "@/lib/db";
import { listBookings } from "@/lib/bookings";
import { lkr } from "@/lib/format";
import { safeDecode } from "@/lib/safe-decode";
import { resendTicketAction } from "../actions";
import { Empty, Notice, PageHeader, Panel, Pill, Stat, buttonClass } from "@/components/admin/ui";
import { Mail } from "lucide-react";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Bookings",
  robots: { index: false, follow: false },
};

export default async function BookingsPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  if (!(await isAdmin())) redirect("/admin?next=/admin/bookings");
  if (!hasDatabase()) redirect("/admin?error=database");

  const { ok, error } = await searchParams;
  // A database that has already failed is not asked again: one timeout per
  // process is a diagnosis, three hundred is a hung page.
  const problem = databaseProblem();
  const bookings = databaseDown() ? [] : await listBookings(300);
  const admitted = bookings.filter((b) => b.admittedAt).length;
  const revenue = bookings.reduce((n, b) => n + b.total, 0);
  const seats = bookings.reduce((n, b) => n + b.seats, 0);

  return (
    <div className="space-y-3">
      <section className="rounded-2xl bg-panel p-6">
        <PageHeader
          eyebrow="Tickets"
          title="Bookings"
          description="Everyone who has bought a ticket, what they paid and whether the code has been used at the gate."
        />
        {problem && (
          <div className="mt-4">
            <Notice tone="warn">{problem}</Notice>
          </div>
        )}

        {(ok || error) && (
          <div className="mt-4 space-y-2">
            {ok && <Notice tone="ok">Ticket re-sent for {safeDecode(ok)}.</Notice>}
            {error && <Notice tone="error">{safeDecode(error)}</Notice>}
          </div>
        )}
      </section>

      <dl className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Bookings" value={String(bookings.length)} />
        <Stat label="Seats" value={String(seats)} />
        <Stat
          label="Admitted at the gate"
          value={String(admitted)}
          note={`${bookings.length - admitted} outstanding`}
        />
        <Stat label="Taken" value={lkr(revenue)} tone="invert" />
      </dl>

      <Panel title="All bookings" description="Newest first.">
        {bookings.length === 0 ? (
          <Empty>No bookings yet. They appear here the moment someone reserves a ticket.</Empty>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="text-[11px] uppercase tracking-[0.14em] text-white/65">
                <tr>
                  <th className="pb-3 pr-4 font-medium">Reference</th>
                  <th className="pb-3 pr-4 font-medium">Customer</th>
                  <th className="pb-3 pr-4 font-medium">Seats</th>
                  <th className="pb-3 pr-4 font-medium">Paid</th>
                  <th className="pb-3 pr-4 font-medium">Gate</th>
                  <th className="pb-3 text-right font-medium">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {bookings.map((b) => (
                  <tr key={b.reference} className="align-middle">
                    <td className="py-3 pr-4 font-mono text-xs text-white/70">{b.reference}</td>
                    <td className="py-3 pr-4">
                      <span className="block text-white">{b.name}</span>
                      <span className="block truncate text-xs text-white/65">{b.email}</span>
                    </td>
                    <td className="py-3 pr-4 text-white/75">
                      {b.seatsText || `${b.seats} seats`}
                      <span className="block text-xs text-white/65">{b.eventTitle}</span>
                    </td>
                    <td className="py-3 pr-4 text-white/75">{lkr(b.total)}</td>
                    <td className="py-3 pr-4">
                      {b.admittedAt ? (
                        <Pill tone="ok">{new Date(b.admittedAt).toLocaleString("en-GB")}</Pill>
                      ) : (
                        <Pill>not scanned</Pill>
                      )}
                    </td>
                    <td className="py-3 text-right">
                      <form action={resendTicketAction}>
                        <input type="hidden" name="token" value={b.token} />
                        <button
                          type="submit"
                          className={`${buttonClass("ghost")} !px-3 !py-1.5 !text-xs`}
                        >
                          <Mail className="h-3.5 w-3.5" /> Resend
                        </button>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  );
}
