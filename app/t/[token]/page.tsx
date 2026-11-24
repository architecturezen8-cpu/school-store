import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTicketByToken } from "@/lib/bookings";
import { hasDatabase } from "@/lib/db";
import { verifyTicketSignature } from "@/lib/tickets/sign";
import { fullDate } from "@/lib/dates";
import { lkr } from "@/lib/format";
import { asset } from "@/lib/assets";
import { safeDecode } from "@/lib/safe-decode";

/**
 * The page a customer's camera opens after scanning their ticket.
 *
 * Everything here is read-only: it shows the booking, the seats and whether the
 * ticket has already been used. Admitting happens on /gate, so a customer can
 * never hand themselves in at the door by refreshing this page.
 */

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Your ticket",
  robots: { index: false, follow: false },
};

function Seat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[11px] uppercase tracking-[0.2em] text-white/65">{label}</dt>
      <dd className="mt-1 text-sm text-white/90">{value}</dd>
    </div>
  );
}

export default async function TicketPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string; signature?: string | string[] }>;
  searchParams: Promise<{ s?: string }>;
}) {
  const { token, signature: pathSignature } = await params;
  const { s } = await searchParams;
  // The QR carries /t/<token>/<signature>; tickets issued earlier used ?s=.
  // Next hands a single dynamic segment over as a plain string, not an array.
  const signature = (Array.isArray(pathSignature) ? pathSignature[0] : pathSignature) ?? s;

  if (!hasDatabase()) notFound();

  const ticket = await getTicketByToken(safeDecode(token));
  if (!ticket) notFound();

  const signed = Boolean(signature) && verifyTicketSignature(ticket.token, signature!);
  if (!signed) {
    return (
      <section className="mx-auto max-w-lg px-6 pb-24 pt-32 text-center md:pt-40">
        <h1 className="font-display text-3xl font-semibold text-white">
          This ticket link is not valid
        </h1>
        <p className="mt-4 text-white/60">
          The signature on this link does not match the booking. Open the ticket
          from your confirmation email, or the original QR code, rather than
          typing the address by hand.
        </p>
      </section>
    );
  }

  const seats = ticket.tiers.reduce((n, t) => n + t.qty, 0);
  const used = Boolean(ticket.admittedAt);

  return (
    <section className="mx-auto max-w-2xl px-6 pb-20 pt-32 md:pt-36">
      <p className="text-[11px] uppercase tracking-[0.3em] text-gold">Admission ticket</p>
      <h1 className="mt-3 font-display text-4xl font-semibold text-white">
        {ticket.eventTitle}
      </h1>
      <p className="mt-2 text-white/60">
        {fullDate(new Date(ticket.eventDate))} · {ticket.venue}, {ticket.city}
      </p>

      {/* The design the admin uploaded, with this booking's QR already in it.
          Rendering it here means the customer always sees exactly what the
          email carried, including any artwork changes made after purchase. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={asset(
          `/api/tickets/${encodeURIComponent(ticket.token)}/image?s=${encodeURIComponent(signature!)}`
        )}
        alt={`Ticket for ${ticket.eventTitle}`}
        className="mt-8 w-full rounded-2xl border border-white/10 shadow-2xl"
      />

      <div
        className={`mt-6 rounded-2xl border p-5 ${
          used
            ? "border-red-400/40 bg-red-500/10"
            : "border-emerald-400/30 bg-emerald-500/10"
        }`}
      >
        <p className="font-display text-lg font-semibold text-white">
          {used ? "Already admitted" : "Valid · not yet scanned at the gate"}
        </p>
        <p className="mt-1 text-sm text-white/70">
          {used
            ? `Scanned on ${new Date(ticket.admittedAt!).toLocaleString("en-GB")}${
                ticket.admittedBy ? ` by ${ticket.admittedBy}` : ""
              }. One entry per ticket.`
            : "Show the QR above at the gate. Staff will scan it once to admit you."}
        </p>
      </div>

      <dl className="mt-8 grid grid-cols-2 gap-5 rounded-2xl border border-white/10 bg-white/[0.02] p-6 sm:grid-cols-3">
        <Seat label="Reference" value={ticket.reference} />
        <Seat label="Name" value={ticket.name} />
        <Seat label="Seats" value={String(seats)} />
        <Seat label="Doors" value={ticket.doors || "—"} />
        <Seat label="Paid" value={lkr(ticket.total)} />
        <Seat label="Email" value={ticket.email} />
      </dl>

      <ul className="mt-6 space-y-2">
        {ticket.tiers.map((t) => (
          <li
            key={t.id}
            className="flex items-center justify-between rounded-xl border border-white/10 px-4 py-3 text-sm"
          >
            <span className="text-white/80">{t.name}</span>
            <span className="text-white/65">
              {t.qty} × {lkr(t.price)}
            </span>
          </li>
        ))}
      </ul>

      <p className="mt-10 text-center text-xs text-white/65">
        St. Thomas&apos; College Matale · Animo et Fide · Est. 1873
      </p>
    </section>
  );
}
