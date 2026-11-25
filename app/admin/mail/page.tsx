import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { isAdmin } from "@/lib/admin/auth";
import { hasDatabase } from "@/lib/db";
import { listBookings } from "@/lib/bookings";
import { DEFAULT_MAIL_TEMPLATE } from "@/lib/tickets/email";
import { getMailTemplate } from "@/lib/tickets/mail-settings";
import { safeDecode } from "@/lib/safe-decode";
import { saveMailTemplateAction, sendTestMailAction } from "../actions";
import {
  Field,
  Notice,
  PageHeader,
  Panel,
  buttonClass,
  inputClass,
  labelClass,
} from "@/components/admin/ui";
import { ExternalLink, RefreshCw, Send } from "lucide-react";

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

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-10 lg:py-10">
      <PageHeader
        eyebrow="Email"
        title="Ticket email"
        description="One design, sent to every customer. The photo, the reference, the seats, the amount and their QR code are filled in per booking — you only write the words."
        actions={
          <>
            <a href={frameSrc} target="_blank" rel="noreferrer" className={buttonClass("ghost")}>
              <ExternalLink className="h-4 w-4" /> Open full size
            </a>
            <a href={frameSrc} className={buttonClass("secondary")}>
              <RefreshCw className="h-4 w-4" /> Refresh
            </a>
          </>
        }
      />

      <div className="mt-6 space-y-3">
        {ok && (
          <Notice tone="ok">
            {ok === "1" ? "Saved. New tickets use this wording." : safeDecode(ok)}
          </Notice>
        )}
        {error && <Notice tone="error">{safeDecode(error)}</Notice>}
        {!configured && (
          <Notice tone="warn">
            No mail transport yet — add <code className="rounded bg-black/30 px-1">RESEND_API_KEY</code>{" "}
            or the <code className="rounded bg-black/30 px-1">SMTP_*</code> variables to{" "}
            <code className="rounded bg-black/30 px-1">.env.local</code>. Bookings still succeed in
            the meantime; nothing is sent.
          </Notice>
        )}
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
        {/* ---------------- editor ---------------- */}
        <div className="space-y-6">
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
                <li
                  key={token}
                  className="rounded-lg border border-navy-600 bg-navy-950 px-2.5 py-1.5 text-xs"
                >
                  <code className="text-gold">{token}</code>
                  <span className="text-white/60"> {what}</span>
                </li>
              ))}
            </ul>
          </Panel>

          <Panel
            title="Send a test"
            description="A real ticket to a real inbox — the only way to check the QR before a customer sees it."
          >
            <form action={sendTestMailAction} className="space-y-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Send to">
                  <input
                    name="email"
                    type="email"
                    required
                    placeholder="you@example.com"
                    className={inputClass}
                  />
                </Field>
                <Field label="Use booking" hint="blank = latest">
                  <select
                    name="reference"
                    defaultValue=""
                    className={`${inputClass} bg-navy-950`}
                  >
                    <option value="">Latest booking</option>
                    {bookings.map((b) => (
                      <option key={b.reference} value={b.reference}>
                        {b.reference} · {b.name}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>
              <button type="submit" className={buttonClass("secondary")}>
                <Send className="h-4 w-4" /> Send test email
              </button>
            </form>
          </Panel>
        </div>

        {/* ---------------- the actual message ---------------- */}
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className={labelClass}>Exactly what the customer receives</p>
            {bookings.length > 1 && (
              <div className="flex flex-wrap gap-1.5">
                {bookings.slice(0, 4).map((b) => (
                  <Link
                    key={b.reference}
                    href={`/admin/mail?preview=${encodeURIComponent(b.reference)}`}
                    className={`rounded-md px-2 py-1 font-mono text-[11px] ${
                      chosen?.reference === b.reference
                        ? "bg-gold text-navy-950"
                        : "bg-navy-800 text-white/60 hover:bg-navy-700 hover:text-white"
                    }`}
                  >
                    {b.reference}
                  </Link>
                ))}
              </div>
            )}
          </div>

          <div className="overflow-hidden rounded-xl border border-navy-700 bg-navy-950">
            <div className="flex items-center gap-2 border-b border-navy-700 px-3 py-2">
              <span className="h-2 w-2 rounded-full bg-navy-600" />
              <span className="h-2 w-2 rounded-full bg-navy-600" />
              <span className="h-2 w-2 rounded-full bg-navy-600" />
              <span className="ml-2 truncate font-mono text-[11px] text-white/65">
                Subject: {saved.subject.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, k) => {
                  const map: Record<string, string> = {
                    name: chosen?.name ?? "Nimal Perera",
                    event: chosen?.eventTitle ?? "The Big Match",
                    reference: chosen?.reference ?? "BM-ABC123",
                    seats: chosen?.seatsText || String(chosen?.seats ?? 2),
                    total: String(chosen?.total ?? 3000),
                    venue: chosen ? `${chosen.eventTitle}` : "College Grounds",
                    date: chosen ? new Date(chosen.eventDate).toDateString() : "",
                    seatsText: "",
                    seatsCount: "",
                  };
                  return map[k] ?? "";
                })}
              </span>
            </div>
            <iframe
              src={frameSrc}
              title="Ticket email preview"
              className="h-[860px] w-full border-0 bg-[#04060d]"
            />
          </div>
          <p className="text-xs leading-relaxed text-white/65">
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
  );
}
