import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { isAdmin } from "@/lib/admin/auth";
import { databaseProblem } from "@/lib/admin/db-guard";
import { databaseDown, hasDatabase } from "@/lib/db";
import { listBookings } from "@/lib/bookings";
import { DEFAULT_MAIL_TEMPLATE, renderTemplate } from "@/lib/tickets/email";
import { safeDecode } from "@/lib/safe-decode";
import { sendTestMailAction } from "../actions";
import {
  Eyebrow,
  Field,
  Notice,
  PageHeader,
  Panel,
  buttonClass,
  inputClass,
} from "@/components/admin/ui";
import { ExternalLink, Mail, RefreshCw } from "lucide-react";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Ticket email",
  robots: { index: false, follow: false },
};

/**
 * The ticket email.
 *
 * The design and the wording are the shipped default — there is nothing here to
 * edit, on purpose: every customer gets the same, tested ticket. So this page
 * does the two things an admin actually needs before a real sale:
 *
 *   1. **Preview** it, rendered by the same code that sends it, for a real
 *      booking (the QR is per-booking, so a fake one would prove nothing).
 *   2. **Send a test** to any address, to check it lands in an inbox and not in
 *      spam.
 */
export default async function MailPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; error?: string; preview?: string }>;
}) {
  if (!(await isAdmin())) redirect("/admin?next=/admin/mail");
  if (!hasDatabase()) redirect("/admin?error=database");

  const { ok, error, preview } = await searchParams;
  const configured = Boolean(process.env.RESEND_API_KEY || process.env.SMTP_HOST);

  const problem = databaseProblem();
  const bookings = databaseDown() ? [] : await listBookings(20);
  const chosen = preview ? bookings.find((b) => b.reference === preview.toUpperCase()) : bookings[0];
  const frameSrc = `/admin/mail/preview${chosen ? `?reference=${encodeURIComponent(chosen.reference)}` : ""}`;

  // The subject exactly as this booking will read it.
  const subject = renderTemplate(DEFAULT_MAIL_TEMPLATE.subject, {
    name: chosen?.name ?? "Nimal Perera",
    event: chosen?.eventTitle ?? "The Big Match",
    reference: chosen?.reference ?? "BM-ABC123",
    seats: chosen?.seatsText || "2",
    total: String(chosen?.total ?? 3000),
    venue: chosen ? `${chosen.venue}, ${chosen.city}` : "College Grounds, Matale",
    date: chosen ? new Date(chosen.eventDate).toDateString() : "",
  });

  return (
    <div className="grid gap-3 xl:grid-cols-4">
      <section className="rounded-2xl bg-panel p-6 xl:col-span-2">
        <PageHeader
          eyebrow="Email"
          title="Ticket email"
          description="The design and the wording are fixed — the same tested ticket goes to every customer, with their photo, reference, seats, amount and QR filled in. Check it here, send yourself a copy, and you are done."
          actions={
            <>
              <a href={frameSrc} target="_blank" rel="noreferrer" className={buttonClass("secondary")}>
                <ExternalLink className="h-4 w-4" /> Open full size
              </a>
              <a href={frameSrc} className={buttonClass("ghost")}>
                <RefreshCw className="h-4 w-4" /> Refresh
              </a>
            </>
          }
        />
        {problem && (
          <div className="mt-4">
            <Notice tone="warn">{problem}</Notice>
          </div>
        )}

      </section>

      {/* ---------------- send a test ---------------- */}
      <section className="rounded-2xl bg-panel p-6 xl:col-span-2">
        <Eyebrow>Check it lands</Eyebrow>
        <h2 className="mt-2 font-display text-xl font-semibold text-white">Send a test</h2>
        <p className="mt-2 text-sm leading-relaxed text-white/65">
          The real ticket, sent to your own inbox. The booking is untouched.
        </p>
        {/* The booking is bound into the action rather than posted in a hidden
            field: a hidden value rendered on the server is one more thing that
            can disagree with the client and trip hydration. */}
        <form
          action={sendTestMailAction.bind(null, chosen?.reference ?? "")}
          className="mt-4 space-y-3"
        >
          <Field label="Send to" hint="any inbox">
            <input
              name="to"
              type="email"
              required
              autoComplete="email"
              placeholder="you@example.com"
              className={inputClass}
            />
          </Field>
          <button type="submit" className={`${buttonClass("primary")} w-full`}>
            <Mail className="h-4 w-4" /> Send test ticket
          </button>
        </form>
        <p className="mt-3 text-xs leading-relaxed text-white/60">
          {chosen ? (
            <>
              Uses booking{" "}
              <span className="font-mono text-white/75">{chosen.reference}</span> — the same one
              in the preview.
            </>
          ) : (
            "Sell one ticket first: the test needs a real booking for its QR code."
          )}
        </p>
      </section>

      {(ok || error || !configured) && (
        <div className="space-y-2 xl:col-span-4">
          {ok && <Notice tone="ok">{safeDecode(ok)}</Notice>}
          {error && <Notice tone="error">{safeDecode(error)}</Notice>}
          {!configured && (
            <Notice tone="warn">
              No mail transport yet — add{" "}
              <code className="rounded-md bg-black/40 px-1.5 py-0.5">RESEND_API_KEY</code> or the{" "}
              <code className="rounded-md bg-black/40 px-1.5 py-0.5">SMTP_*</code> variables to{" "}
              <code className="rounded-md bg-black/40 px-1.5 py-0.5">.env.local</code>. Bookings
              still succeed in the meantime; nothing is sent. (Everything below still works.)
            </Notice>
          )}
        </div>
      )}

      {/* ---------------- the preview ---------------- */}
      <div className="rounded-2xl bg-panel p-4 xl:col-span-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Eyebrow>Exactly what the customer receives</Eyebrow>
          {bookings.length > 1 && (
            <div className="flex flex-wrap gap-1.5">
              {bookings.slice(0, 5).map((b) => (
                <Link
                  key={b.reference}
                  href={`/admin/mail?preview=${encodeURIComponent(b.reference)}`}
                  className={`rounded-full px-2.5 py-1 font-mono text-[11px] ${
                    chosen?.reference === b.reference
                      ? "bg-gold text-black"
                      : "bg-well text-white/65 hover:text-white"
                  }`}
                >
                  {b.reference}
                </Link>
              ))}
            </div>
          )}
        </div>
        <p className="mt-2 truncate font-mono text-[11px] text-white/65">Subject: {subject}</p>
        <div className="mt-3 overflow-hidden rounded-xl bg-black">
          <iframe
            src={frameSrc}
            title="Ticket email preview"
            className="h-[70vh] max-h-[820px] min-h-[560px] w-full border-0 bg-black"
          />
        </div>
        <p className="mt-3 text-xs leading-relaxed text-white/60">
          Rendered by the same code that sends the mail. The QR belongs to{" "}
          {chosen ? <span className="font-mono text-white/75">{chosen.reference}</span> : "—"}, so
          it is the code that will be scanned at the gate.
        </p>
      </div>
    </div>
  );
}
