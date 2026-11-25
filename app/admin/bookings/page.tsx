import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { isAdmin } from "@/lib/admin/auth";
import { databaseProblem } from "@/lib/admin/db-guard";
import { databaseDown, hasDatabase } from "@/lib/db";
import { listBookings } from "@/lib/bookings";
import { lkr } from "@/lib/format";
import { safeDecode } from "@/lib/safe-decode";
import Link from "next/link";
import ParamToast from "@/components/admin/ParamToast";
import DownloadReceipt from "@/components/DownloadReceipt";
import SubmitButton from "@/components/SubmitButton";
import { resendTicketAction } from "../actions";
import { Empty, Notice, PageHeader, Panel, Pill, Stat, buttonClass } from "@/components/admin/ui";
import { Mail, TicketPlus } from "lucide-react";
import { asset } from "@/lib/assets";
import { signTicket } from "@/lib/tickets/sign";

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

  const okText = ok ? `Ticket re-sent for ${safeDecode(ok)}.` : "";
  const errorText = error ? safeDecode(error) : "";
  // A database that has already failed is not asked again: one timeout per
  // process is a diagnosis, three hundred is a hung page.
  const problem = databaseProblem();
  const bookings = databaseDown() ? [] : await listBookings(300);
  // People, not bookings: with one ticket per person a four-seat booking can be
  // half in, and "2 bookings admitted" would be a lie in the middle of the day.
  const admitted = bookings.reduce((n, b) => n + b.admitted, 0);
  const revenue = bookings.reduce((n, b) => n + b.total, 0);
  const seats = bookings.reduce((n, b) => n + b.seats, 0);

  return (
    <div className="space-y-3">
      <section className="rounded-2xl bg-panel p-6">
        <PageHeader
          eyebrow="Tickets"
          title="Bookings"
          actions={
            <Link href="/admin/bookings/new" className={buttonClass("primary")}>
              <TicketPlus className="h-4 w-4" /> Issue a ticket
            </Link>
          }
          description="Everyone who has bought a ticket, what they paid and whether the code has been used at the gate."
        />
        {problem && (
          <div className="mt-4">
            <Notice tone="warn">{problem}</Notice>
          </div>
        )}

        {(ok || error) && (
          <div className="mt-4 space-y-2">
            <ParamToast ok={okText} error={errorText} />
            
          </div>
        )}
      </section>

      <dl className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Bookings" value={String(bookings.length)} />
        <Stat label="Seats" value={String(seats)} />
        <Stat
          label="Admitted at the gate"
          value={String(admitted)}
          note={`${seats - admitted} of ${seats} still to come`}
        />
        <Stat label="Taken" value={lkr(revenue)} tone="invert" />
      </dl>

      <Panel title="All bookings" description="Newest first.">
        {bookings.length === 0 ? (
          <Empty>No bookings yet. They appear here the moment someone reserves a ticket.</Empty>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="text-[11px] uppercase tracking-[0.14em] text-muted">
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
                    <td className="py-3 pr-4 font-mono text-xs text-body">{b.reference}</td>
                    <td className="py-3 pr-4">
                      <Link
                        href={`/admin/bookings/${encodeURIComponent(b.reference)}`}
                        className="block text-strong underline-offset-4 hover:underline"
                      >
                        {b.name}
                      </Link>
                      <span className="block truncate text-xs text-muted">{b.email}</span>
                      <Link
                        href={`/admin/bookings/${encodeURIComponent(b.reference)}`}
                        className="mt-0.5 block font-mono text-[11px] text-faint underline-offset-4 hover:underline"
                      >
                        {b.reference}
                      </Link>
                    </td>
                    <td className="py-3 pr-4 text-body">
                      {b.seatsText || `${b.seats} seats`}
                      <span className="block text-xs text-muted">{b.eventTitle}</span>
                    </td>
                    <td className="py-3 pr-4 text-body">{lkr(b.total)}</td>
                    <td className="py-3 pr-4">
                      {b.seats > 1 && (
                        <span className="mr-1 font-mono text-[11px] text-faint">
                          {b.admitted}/{b.seats}
                        </span>
                      )}
                      {b.admittedAt ? (
                        <Pill tone="ok">{new Date(b.admittedAt).toLocaleString("en-GB")}</Pill>
                      ) : (
                        <Pill>not scanned</Pill>
                      )}
                    </td>
                    <td className="py-3 text-right">
                      {/* The bill, for a parent at the door who needs a receipt
                          on paper rather than four ticket QR codes. */}
                      <span className="mr-1.5 inline-block align-middle">
                        <DownloadReceipt
                          href={asset(
                            `/api/tickets/${encodeURIComponent(b.token)}/receipt?s=${encodeURIComponent(
                              signTicket(b.token)
                            )}`
                          )}
                          pending="Drawing…"
                          showNote={false}
                          className={`${buttonClass("ghost")} !px-3 !py-1.5 !text-xs`}
                        >
                          Bill
                        </DownloadReceipt>
                      </span>
                      <form action={resendTicketAction} className="inline">
                        <input type="hidden" name="token" value={b.token} />
                        <SubmitButton
                          pending="Sending…"
                          className={`${buttonClass("ghost")} !px-3 !py-1.5 !text-xs`}
                          icon={<Mail className="h-3.5 w-3.5" />}
                        >
                          Resend
                        </SubmitButton>
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
