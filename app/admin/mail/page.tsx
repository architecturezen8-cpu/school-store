import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { isAdmin } from "@/lib/admin/auth";
import { hasDatabase } from "@/lib/db";
import { DEFAULT_MAIL_TEMPLATE, renderTemplate } from "@/lib/tickets/email";
import { getMailTemplate } from "@/lib/tickets/mail-settings";
import { safeDecode } from "@/lib/safe-decode";
import { saveMailTemplateAction, sendTestMailAction } from "../actions";
import { ArrowLeft, Check, Mail, Send } from "lucide-react";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Ticket email",
  robots: { index: false, follow: false },
};

/** A plausible customer, so the preview reads like a real message. */
const PREVIEW = {
  name: "Nimal Perera",
  event: "The Big Match",
  reference: "BM-ABC123",
  seats: "Grandstand Seat × 2",
  total: "3000",
  venue: "College Grounds, Matale",
  date: new Date("2027-01-09T10:00:00+05:30").toDateString(),
};

export default async function MailPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  if (!(await isAdmin())) redirect("/admin?next=/admin/mail");
  if (!hasDatabase()) redirect("/admin?error=database");

  const { ok, error } = await searchParams;
  const saved = await getMailTemplate();
  const configured = Boolean(process.env.RESEND_API_KEY || process.env.SMTP_HOST);

  const fields: { name: keyof typeof saved; label: string; rows: number; hint: string }[] = [
    { name: "subject", label: "Subject", rows: 1, hint: "The line in the inbox." },
    { name: "heading", label: "Heading", rows: 1, hint: "The big line above the ticket artwork." },
    { name: "body", label: "Message", rows: 9, hint: "Blank line starts a new paragraph." },
    { name: "footer", label: "Footer", rows: 3, hint: "Small print under the ticket." },
  ];

  return (
    <section className="mx-auto max-w-3xl px-6 pb-20 pt-32 md:pt-36">
      <Link href="/admin" className="inline-flex items-center gap-2 text-sm text-white/65 hover:text-white">
        <ArrowLeft className="h-4 w-4" /> Admin
      </Link>

      <h1 className="mt-4 flex items-center gap-3 font-display text-3xl font-semibold text-white">
        <Mail className="h-7 w-7 text-gold" /> Ticket email
      </h1>
      <p className="mt-2 text-sm text-white/70">
        The message every customer gets when they buy a ticket. The artwork they
        see is the design you uploaded under{" "}
        <Link href="/admin/templates" className="text-gold underline underline-offset-4">
          Ticket designs
        </Link>
        , with their own QR code in the white square.
      </p>

      {ok && (
        <p className="mt-5 flex items-center gap-2 rounded-xl border border-emerald-400/40 bg-emerald-500/10 p-3 text-sm text-emerald-200">
          <Check className="h-4 w-4" />{" "}
          {ok === "1" ? "Saved. New tickets use this wording." : safeDecode(ok)}
        </p>
      )}
      {error && (
        <p className="mt-5 rounded-xl border border-red-400/40 bg-red-500/10 p-3 text-sm text-red-200">
          {safeDecode(error)}
        </p>
      )}
      {!configured && (
        <p className="mt-5 rounded-xl border border-amber-400/40 bg-amber-500/10 p-3 text-sm text-amber-100">
          No mail transport yet. Add <code className="rounded bg-black/30 px-1">RESEND_API_KEY</code>{" "}
          or the <code className="rounded bg-black/30 px-1">SMTP_*</code> variables to{" "}
          <code className="rounded bg-black/30 px-1">.env.local</code>. Bookings still
          succeed meanwhile — nothing is sent.
        </p>
      )}

      {/* ---------------- placeholders ---------------- */}
      <div className="mt-6 rounded-2xl border border-white/10 bg-white/[0.03] p-5">
        <p className="text-[11px] uppercase tracking-[0.2em] text-white/65">
          Placeholders — click to copy the idea, type them anywhere
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {[
            ["{{name}}", "customer"],
            ["{{event}}", "event"],
            ["{{reference}}", "reference"],
            ["{{seats}}", "seats"],
            ["{{total}}", "amount"],
            ["{{venue}}", "venue"],
            ["{{date}}", "date"],
          ].map(([token, what]) => (
            <span key={token} className="rounded-lg border border-white/10 px-2 py-1 text-xs">
              <code className="text-gold">{token}</code>
              <span className="text-white/65"> {what}</span>
            </span>
          ))}
        </div>
      </div>

      {/* ---------------- editor ---------------- */}
      <form action={saveMailTemplateAction} className="mt-6 space-y-5 rounded-2xl border border-white/10 bg-white/[0.03] p-6">
        {fields.map((f) => (
          <label key={f.name} className="block">
            <span className="flex items-baseline justify-between">
              <span className="text-[11px] uppercase tracking-[0.2em] text-white/65">{f.label}</span>
              <span className="text-[11px] text-white/65">{f.hint}</span>
            </span>
            {f.rows === 1 ? (
              <input
                name={f.name}
                defaultValue={saved[f.name]}
                placeholder={DEFAULT_MAIL_TEMPLATE[f.name]}
                className="mt-1 w-full rounded-xl border border-white/15 bg-white/[0.04] px-4 py-3 text-sm text-white outline-none focus:border-gold/60"
              />
            ) : (
              <textarea
                name={f.name}
                rows={f.rows}
                defaultValue={saved[f.name]}
                placeholder={DEFAULT_MAIL_TEMPLATE[f.name]}
                className="mt-1 w-full resize-y rounded-xl border border-white/15 bg-white/[0.04] px-4 py-3 text-sm leading-relaxed text-white outline-none focus:border-gold/60"
              />
            )}
          </label>
        ))}

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="submit"
            className="rounded-xl bg-gold px-5 py-3 text-sm font-semibold text-navy-950"
          >
            Save message
          </button>
          <span className="text-xs text-white/65">
            Clear a box to fall back to the default wording.
          </span>
        </div>
      </form>

      {/* ---------------- preview ---------------- */}
      <div className="mt-6 rounded-2xl border border-white/10 bg-white/[0.03] p-6">
        <h2 className="font-display text-lg text-white">Preview</h2>
        <p className="mt-1 text-sm text-white/65">
          How the saved message reads for a made-up customer. The QR is added when
          a real ticket is sent.
        </p>

        <div className="mt-4 overflow-hidden rounded-xl border border-white/10 bg-white text-[#111]">
          <div className="bg-[#0a1224] px-6 py-5">
            <p className="text-[10px] uppercase tracking-[0.25em] text-[#ffd444]">Admission ticket</p>
            <p className="mt-2 text-xl font-semibold text-white">
              {renderTemplate(saved.heading, PREVIEW)}
            </p>
          </div>
          <div className="space-y-3 px-6 py-5 text-sm leading-relaxed">
            {renderTemplate(saved.body, PREVIEW)
              .split(/\n{2,}/)
              .map((p, i) => (
                <p key={i} className="whitespace-pre-line">
                  {p}
                </p>
              ))}
            <div className="rounded-lg border border-dashed border-[#9a9aa2] p-6 text-center text-xs text-[#4a4a52]">
              the customer&apos;s ticket artwork with their QR code
            </div>
            <p className="whitespace-pre-line border-t border-[#9a9aa2] pt-3 text-xs text-[#4a4a52]">
              {renderTemplate(saved.footer, PREVIEW)}
            </p>
          </div>
        </div>
        <p className="mt-3 text-xs text-white/65">
          <span className="text-white/60">Subject:</span>{" "}
          {renderTemplate(saved.subject, PREVIEW)}
        </p>
      </div>

      {/* ---------------- test send ---------------- */}
      <form action={sendTestMailAction} className="mt-6 space-y-3 rounded-2xl border border-white/10 bg-white/[0.03] p-6">
        <h2 className="flex items-center gap-2 font-display text-lg text-white">
          <Send className="h-4 w-4 text-gold" /> Send a test
        </h2>
        <p className="text-sm text-white/65">
          Sends a real ticket to a real inbox, so you can check the design and the
          QR before the first customer buys.
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="text-[11px] uppercase tracking-[0.2em] text-white/65">
              Send to
            </span>
            <input
              name="email"
              type="email"
              required
              placeholder="you@example.com"
              className="mt-1 w-full rounded-xl border border-white/15 bg-white/[0.04] px-4 py-3 text-sm text-white outline-none focus:border-gold/60"
            />
          </label>
          <label className="block">
            <span className="text-[11px] uppercase tracking-[0.2em] text-white/65">
              Use booking (optional)
            </span>
            <input
              name="reference"
              placeholder="BM-ABC123 — blank = latest"
              className="mt-1 w-full rounded-xl border border-white/15 bg-white/[0.04] px-4 py-3 text-sm text-white outline-none focus:border-gold/60"
            />
          </label>
        </div>
        <button
          type="submit"
          className="rounded-xl border border-white/15 px-5 py-3 text-sm font-semibold text-white/85 hover:border-gold/50"
        >
          Send test email
        </button>
      </form>
    </section>
  );
}
