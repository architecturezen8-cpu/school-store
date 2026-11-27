import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTicketByToken } from "@/lib/bookings";
import { hasDatabase } from "@/lib/db";
import { verifyTicketSignature } from "@/lib/tickets/sign";
import { fullDate } from "@/lib/dates";
import { asset } from "@/lib/assets";
import { safeDecode } from "@/lib/safe-decode";

/**
 * The page a customer's camera opens after scanning their ticket.
 *
 * Everything here is read-only: it names the ticket and nothing else. It used to
 * print the purchaser — name, reference, what was paid and which tiers were
 * bought — and that is the wrong document for the reader. The person holding the
 * phone is not the person who paid: it is a guest, a friend, a steward who has
 * just scanned somebody else's code. What all of them need is the one answer the
 * page can give honestly — *which* admission is this, for which event, for which
 * ticket type — and none of them need the buyer's name, the price of the party's
 * seats, or a running total.
 *
 * What it still does not say, by design: whether the ticket has been scanned.
 * Admitting happens on /gate, so a customer can never hand themselves in at the
 * door by refreshing this page, and a screenshot cannot be checked for validity.
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

  // The ticket's own type, and only it: "Grandstand Seat", not the four rows of
  // the sale. A booking of six may hold three types; each ticket carries one.
  const type = ticket.tierName || ticket.tiers.map((t) => t.name).join(", ") || "Admission";

  return (
    <section className="mx-auto max-w-2xl px-6 pb-20 pt-32 md:pt-36">
      <p className="text-[11px] uppercase tracking-[0.3em] text-gold">
        Admission ticket
        {ticket.of > 1 && (
          <span className="text-white/50"> · ticket {ticket.seq} of {ticket.of}</span>
        )}
      </p>
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

      {/*
        What this page does *not* say: whether the ticket has been scanned.
        It used to, in a green "valid" or a red "already admitted" panel, and that
        is the one fact a stranger who photographs somebody's QR most wants —
        "has this been used yet?" is the question a shared screenshot asks. The
        holder does not need it either: the gate tells them. So the page states
        what the ticket is for and nothing about its state.
      */}
      <div
        className={`mt-6 rounded-2xl border p-5 ${
          ticket.blocked
            ? "border-red-400/40 bg-red-500/10"
            : "border-gold/25 bg-white/[0.03]"
        }`}
      >
        <p className="font-display text-lg font-semibold text-white">
          {ticket.blocked ? "This ticket has been cancelled" : "Show this at the gate"}
        </p>
        <p className="mt-1 text-sm text-white/70">
          {ticket.blocked
            ? "The school has stopped this ticket, so the gate will not admit it. Contact the store with the code below — the rest of the party is unaffected."
            : ticket.of > 1
              ? `It admits one person — this is ticket ${ticket.seq} of ${ticket.of} on the sale, and every seat in it has a code of its own. Keep it to yourself: a screenshot is how somebody gets in on your seat.`
              : "It admits one person, once. Keep it to yourself: a screenshot is how somebody gets in on your seat."}
        </p>
      </div>

      {/* The code, large: this page is what a volunteer reads when the QR will
          not scan and the phone has to be handed over. */}
      <div className="mt-8 rounded-2xl border border-white/10 bg-white/[0.02] p-6">
        <p className="text-[11px] uppercase tracking-[0.2em] text-white/65">Ticket code</p>
        <p className="mt-1 font-mono text-2xl font-semibold tracking-[0.08em] text-white sm:text-3xl">
          {ticket.code}
        </p>

        <dl className="mt-6 grid grid-cols-2 gap-5 sm:grid-cols-3">
          <Seat label="Ticket type" value={type} />
          <Seat label="Ticket" value={`${ticket.seq} of ${ticket.of}`} />
          <Seat label="Doors" value={ticket.doors || "—"} />
        </dl>
      </div>

      <p className="mt-8 text-center text-xs text-white/65">
        St. Thomas&apos; College Matale · Animo et Fide · Est. 1873
      </p>
    </section>
  );
}
