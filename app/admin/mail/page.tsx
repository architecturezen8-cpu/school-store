import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { isAdmin } from "@/lib/admin/auth";
import { hasDatabase } from "@/lib/db";
import { listBookings } from "@/lib/bookings";
import { DEFAULT_MAIL_TEMPLATE, renderTemplate } from "@/lib/tickets/email";
import { getMailTemplate } from "@/lib/tickets/mail-settings";
import { safeDecode } from "@/lib/safe-decode";
import { saveMailTemplateAction } from "../actions";
import {
  Field,
  Notice,
  PageHeader,
  Panel,
  buttonClass,
  inputClass,
  labelClass,
} from "@/components/admin/ui";
import { ExternalLink, RefreshCw } from "lucide-react";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Ticket email",
  robots: { index: false, follow: false },
};

const PLACEHOLDERS: [string, string][] = [
  ["{{name}}", "customer"],
  ["{{event}}", "event"],
  ["{{reference}}", "reference"],
  ["{{seats}}", "seats"],
  ["{{total}}", "amount"],
  ["{{venue}}", "venue"],
  ["{{date}}", "date"],
];

export default async function MailPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; error?: string; preview?: string }>;
}) {
  if (!(await isAdmin())) redirect("/admin?next=/admin/mail");
  if (!hasDatabase()) redirect("/admin?error=database");

  const { ok, error, preview } = await searchParams;
  const saved = await getMailTemplate();
  const configured = Boolean(process.env.RESEND_API_KEY || process.env.SMTP_HOST);

  // The preview always reflects a real booking, because the ticket artwork and
  // the QR are per-booking. If nothing has been sold yet there is nothing to
  // preview, and the frame explains that in place.
  const bookings = await listBookings(20);
  const chosen = preview ? bookings.find((b) => b.reference === preview.toUpperCase()) : bookings[0];
  const frameSrc = `/admin/mail/preview${chosen ? `?reference=${encodeURIComponent(chosen.reference)}` : ""}`;

  const fields: { name: keyof typeof saved; label: string; rows: number; hint: string }[] = [
    { name: "subject", label: "Subject", rows: 1, hint: "the line in the inbox" },
    { name: "heading", label: "Heading", rows: 1, hint: "the big line over the photo" },
    { name: "body", label: "Message", rows: 8, hint: "blank line = new paragraph" },
    { name: "footer", label: "Footer", rows: 3, hint: "small print under the button" },
  ];

  // The subject as this booking will actually read it.
  const subject = renderTemplate(saved.subject, {
    name: chosen?.name ?? "Nimal Perera",
    event: chosen?.eventTitle ?? "The Big Match",
    reference: chosen?.reference ?? "BM-ABC123",
    seats: chosen?.seatsText || "2",
    total: String(chosen?.total ?? 3000),
    venue: chosen ? `${chosen.venue}, ${chosen.city}` : "College Grounds, Matale",
    date: chosen ? new Date(chosen.eventDate).toDateString() : "",
  });

  return (
    <div className="space-y-3">
      <section className="rounded-2xl bg-navy-900 p-6">
        <PageHeader
          eyebrow="Email"
          title="Ticket email"
          description="One design, sent to every customer. The photo, the reference, the seats, the amount and their QR code are filled in per booking — you only write the words."
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
        {(ok || error || !configured) && (
          <div className="mt-4 space-y-2">
            {ok && (
              <Notice tone="ok">
                {ok === "1" ? "Saved. New tickets use this wording." : safeDecode(ok)}
              </Notice>
            )}
            {error && <Notice tone="error">{safeDecode(error)}</Notice>}
            {!configured && (
              <Notice tone="warn">
                No mail transport yet — add{" "}
                <code className="rounded-md bg-black/40 px-1.5 py-0.5">RESEND_API_KEY</code> or the{" "}
                <code className="rounded-md bg-black/40 px-1.5 py-0.5">SMTP_*</code> variables to{" "}
                <code className="rounded-md bg-black/40 px-1.5 py-0.5">.env.local</code>. Bookings
                still succeed in the meantime; nothing is sent.
              </Notice>
            )}
          </div>
        )}
      </section>

      <div className="grid gap-3 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
        {/* ---------------- editor ---------------- */}
        <div className="space-y-3">
          <Panel title="Wording" description="Clear a box to fall back to the shipped default.">
            <form action={saveMailTemplateAction} className="space-y-4">
              {fields.map((f) => (
                <Field key={f.name} label={f.label} hint={f.hint}>
                  {f.rows === 1 ? (
                    <input
                      name={f.name}
                      defaultValue={saved[f.name]}
                      placeholder={DEFAULT_MAIL_TEMPLATE[f.name]}
                      className={inputClass}
                    />
                  ) : (
                    <textarea
                      name={f.name}
                      rows={f.rows}
                      defaultValue={saved[f.name]}
                      placeholder={DEFAULT_MAIL_TEMPLATE[f.name]}
                      className={`${inputClass} resize-y leading-relaxed`}
                    />
                  )}
                </Field>
              ))}

              <button type="submit" className={buttonClass("primary")}>
                Save message
              </button>
            </form>
          </Panel>

          <Panel title="Placeholders" description="Type these anywhere in the fields above.">
            <ul className="flex flex-wrap gap-2">
              {PLACEHOLDERS.map(([token, what]) => (
                <li key={token} className="rounded-full bg-navy-950 px-3 py-1.5 text-xs">
                  <code className="text-white">{token}</code>
                  <span className="text-white/65"> {what}</span>
                </li>
              ))}
            </ul>
          </Panel>
        </div>

        {/* ---------------- the actual message ---------------- */}
        <div className="space-y-3">
          <div className="rounded-2xl bg-navy-900 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className={labelClass}>Exactly what the customer receives</p>
              {bookings.length > 1 && (
                <div className="flex flex-wrap gap-1.5">
                  {bookings.slice(0, 4).map((b) => (
                    <Link
                      key={b.reference}
                      href={`/admin/mail?preview=${encodeURIComponent(b.reference)}`}
                      className={`rounded-full px-2.5 py-1 font-mono text-[11px] ${
                        chosen?.reference === b.reference
                          ? "bg-white text-black"
                          : "bg-navy-950 text-white/65 hover:text-white"
                      }`}
                    >
                      {b.reference}
                    </Link>
                  ))}
                </div>
              )}
            </div>
            <p className="mt-2 truncate font-mono text-[11px] text-white/65">
              Subject: {subject}
            </p>
            <div className="mt-3 overflow-hidden rounded-xl bg-black">
              <iframe
                src={frameSrc}
                title="Ticket email preview"
                className="h-[820px] w-full border-0 bg-black"
              />
            </div>
            <p className="mt-3 text-xs leading-relaxed text-white/65">
              Rendered by the same code that sends the mail. The QR belongs to{" "}
              {chosen ? (
                <span className="font-mono text-white/60">{chosen.reference}</span>
              ) : (
                "—"
              )}
              , so it is the code that will be scanned at the gate.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
