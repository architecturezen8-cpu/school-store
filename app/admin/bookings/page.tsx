import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { isAdmin } from "@/lib/admin/auth";
import { hasDatabase } from "@/lib/db";
import { listBookings } from "@/lib/bookings";
import { lkr } from "@/lib/format";
import { safeDecode } from "@/lib/safe-decode";
import { resendTicketAction } from "../actions";
import { ArrowLeft, Check, Mail } from "lucide-react";

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
  const bookings = await listBookings(200);
  const admitted = bookings.filter((b) => b.admittedAt).length;
  const revenue = bookings.reduce((n, b) => n + b.total, 0);

  return (
    <section className="mx-auto max-w-5xl px-6 pb-20 pt-32 md:pt-36">
      <Link href="/admin" className="inline-flex items-center gap-2 text-sm text-white/65 hover:text-white">
        <ArrowLeft className="h-4 w-4" /> Admin
      </Link>

      <h1 className="mt-4 font-display text-3xl font-semibold text-white">Bookings</h1>

      {ok && (
        <p className="mt-4 flex items-center gap-2 rounded-xl border border-emerald-400/40 bg-emerald-500/10 p-3 text-sm text-emerald-200">
          <Check className="h-4 w-4" /> Ticket re-sent for {safeDecode(ok)}.
        </p>
      )}
      {error && (
        <p className="mt-4 rounded-xl border border-red-400/40 bg-red-500/10 p-3 text-sm text-red-200">
          {safeDecode(error)}
        </p>
      )}

      <dl className="mt-6 grid gap-3 sm:grid-cols-3">
        <Stat label="Bookings" value={String(bookings.length)} />
        <Stat label="Admitted at the gate" value={String(admitted)} />
        <Stat label="Taken" value={lkr(revenue)} />
      </dl>

      {bookings.length === 0 ? (
        <p className="mt-8 text-sm text-white/65">
          No bookings yet. They appear here the moment someone reserves a ticket.
        </p>
      ) : (
        <div className="mt-8 overflow-x-auto rounded-2xl border border-white/10">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="bg-white/[0.04] text-[11px] uppercase tracking-[0.15em] text-white/65">
              <tr>
                <th className="px-4 py-3">Reference</th>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Event</th>
                <th className="px-4 py-3">Total</th>
                <th className="px-4 py-3">Gate</th>
                <th className="px-4 py-3"><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody>
              {bookings.map((b) => (
                <tr key={b.reference} className="border-t border-white/[0.06]">
                  <td className="px-4 py-3 font-mono text-xs text-white/70">{b.reference}</td>
                  <td className="px-4 py-3 text-white">
                    {b.name}
                    <span className="block text-xs text-white/65">{b.email}</span>
                  </td>
                  <td className="px-4 py-3 text-white/70">{b.eventTitle}</td>
                  <td className="px-4 py-3 text-white/70">{lkr(b.total)}</td>
                  <td className="px-4 py-3">
                    {b.admittedAt ? (
                      <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[11px] text-emerald-300">
                        {new Date(b.admittedAt).toLocaleString("en-GB")}
                      </span>
                    ) : (
                      <span className="rounded-full bg-white/10 px-2 py-0.5 text-[11px] text-white/65">
                        not scanned
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <form action={resendTicketAction}>
                      <input type="hidden" name="token" value={b.token} />
                      <button
                        type="submit"
                        className="inline-flex items-center gap-1.5 rounded-lg border border-white/15 px-3 py-1.5 text-xs text-white/70"
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
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
      <dt className="text-[11px] uppercase tracking-[0.2em] text-white/65">{label}</dt>
      <dd className="mt-1 font-display text-xl text-white">{value}</dd>
    </div>
  );
}
