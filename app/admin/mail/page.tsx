import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { isAdmin } from "@/lib/admin/auth";
import { databaseProblem } from "@/lib/admin/db-guard";
import { databaseDown, hasDatabase } from "@/lib/db";
import { listBookings } from "@/lib/bookings";
import {
  DEFAULT_MAIL_TEMPLATE,
  renderTemplate,
  sampleTicket,
} from "@/lib/tickets/email";
import { safeDecode } from "@/lib/safe-decode";
import { sendTestMailAction } from "../actions";
import ParamToast from "@/components/admin/ParamToast";
import SubmitButton from "@/components/SubmitButton";
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
  // Nothing sold yet is the normal state on day one, and it is exactly when an
  // admin wants to check the mail — so the page previews a sample instead of
  // showing an empty frame. The wording says which it is.
  const sample = chosen ? null : await sampleTicket();
  const shown = chosen ?? sample;
  const frameSrc = `/admin/mail/preview${chosen ? `?reference=${encodeURIComponent(chosen.reference)}` : ""}`;

  // The subject exactly as this booking will read it.
  const subject = renderTemplate(DEFAULT_MAIL_TEMPLATE.subject, {
    name: shown?.name ?? "Nimal Perera",
    event: shown?.eventTitle ?? "The Big Match",
    reference: shown?.reference ?? "BM-ABC123",
    seats: chosen?.seatsText || "2",
    total: String(shown?.total ?? 3000),
    venue: shown ? `${shown.venue}, ${shown.city}` : "College Grounds, Matale",
    date: shown ? new Date(shown.eventDate).toDateString() : "",
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
        {sample && !problem && (
          <div className="mt-4">
            <Notice tone="warn">
              No ticket has been sold yet, so the preview below is a{" "}
              <strong>sample</strong>: a real event, a real layout and a real QR, with the
              reference <span className="font-mono">BM-SAMPLE</span>. A sample&apos;s QR does
              not open a live ticket — that is the one thing it cannot show. Once the first
              ticket is sold this switches to your real booking automatically.
            </Notice>
          </div>
        )}

      </section>

      {/* ---------------- send a test ---------------- */}
      <section className="rounded-2xl bg-panel p-6 xl:col-span-2">
        <Eyebrow>Check it lands</Eyebrow>
        <h2 className="mt-2 font-display text-xl font-semibold text-strong">Send a test</h2>
        <p className="mt-2 text-sm leading-relaxed text-muted">
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
          <SubmitButton
            pending="Sending the test ticket…"
            className={`${buttonClass("primary")} w-full`}
            icon={<Mail className="h-4 w-4" />}
          >
            Send test ticket
          </SubmitButton>
        </form>
        <p className="mt-3 text-xs leading-relaxed text-muted">
          {chosen ? (
            <>
              Uses booking{" "}
              <span className="font-mono text-body">{chosen.reference}</span> — the same one
              in the preview.
            </>
          ) : (
            <>
              Nothing sold yet, so this sends the{" "}
              <span className="font-mono text-body">BM-SAMPLE</span> ticket. Delivery, the
              From: line, the artwork and the QR all behave exactly as they will for a real
              purchase.
            </>
          )}
        </p>
      </section>

      {(ok || error || !configured) && (
        <div className="space-y-2 xl:col-span-4">
          <ParamToast
            ok={ok ? safeDecode(ok) : ""}
            error={error ? safeDecode(error) : ""}
          />
          {!configured && (
            <Notice tone="warn">
              No mail transport yet — add{" "}
              <code className="rounded-md bg-page px-1.5 py-0.5">RESEND_API_KEY</code> or the{" "}
              <code className="rounded-md bg-page px-1.5 py-0.5">SMTP_*</code> variables to{" "}
              <code className="rounded-md bg-page px-1.5 py-0.5">.env.local</code>. Bookings
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
                      : "bg-well text-muted hover:text-strong"
                  }`}
                >
                  {b.reference}
                </Link>
              ))}
            </div>
          )}
        </div>
        <p className="mt-2 truncate font-mono text-[11px] text-muted">Subject: {subject}</p>
        <div className="mt-3 overflow-hidden rounded-xl bg-page">
          <iframe
            src={frameSrc}
            title="Ticket email preview"
            className="h-[70vh] max-h-[820px] min-h-[560px] w-full border-0 bg-page"
          />
        </div>
        <p className="mt-3 text-xs leading-relaxed text-muted">
          Rendered by the same code that sends the mail.{" "}
          {chosen ? (
            <>
              The QR belongs to{" "}
              <span className="font-mono text-body">{chosen.reference}</span>, so it is the
              code that will be scanned at the gate.
            </>
          ) : (
            "The QR is drawn from a fresh random token, exactly as it would be for a sale."
          )}
        </p>
      </div>
    </div>
  );
}
