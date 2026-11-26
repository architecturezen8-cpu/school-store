import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { isAdmin } from "@/lib/admin/auth";
import { databaseProblem } from "@/lib/admin/db-guard";
import { databaseDown, hasDatabase } from "@/lib/db";
import {
  listMailLog,
  mailLogSummary,
  type MailLogEntry,
  type MailLogSummary,
} from "@/lib/tickets/mail-log";
import { safeDecode } from "@/lib/safe-decode";
import { emailTicketAction } from "../../actions";
import ParamToast from "@/components/admin/ParamToast";
import SubmitButton from "@/components/SubmitButton";
import {
  Empty,
  Eyebrow,
  Field,
  Notice,
  PageHeader,
  Panel,
  Pill,
  Stat,
  buttonClass,
  inputClass,
} from "@/components/admin/ui";
import { Mail, Send } from "lucide-react";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Email log",
  robots: { index: false, follow: false },
};

/**
 * Whether the ticket email actually went.
 *
 * Until now the answer to "the email never came" was a shrug: the sale existed,
 * the code worked at the gate, and there was nothing anywhere that said a
 * message had been handed to the mail server at all. This page is that record —
 * every attempt, what it carried, where it went, and the mail server's own words
 * when it refused.
 *
 * The second half of the page is the fix: one ticket, to any address, by hand.
 * That is the case the school actually meets — a parent whose work mailbox
 * bounces, standing at the counter with a printed reference.
 */
export default async function MailLogPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  if (!(await isAdmin())) redirect("/admin?next=/admin/mail/log");
  if (!hasDatabase()) redirect("/admin?error=database");

  const { ok, error } = await searchParams;
  const problem = databaseProblem();
  const down = databaseDown();

  // A database that is already down is not asked twice, and a page that cannot
  // read the log still renders the form that sends a ticket.
  const EMPTY: MailLogSummary = {
    total: 0,
    sent: 0,
    failed: 0,
    skipped: 0,
    problems: 0,
    lastAt: null,
  };
  const attempts: MailLogEntry[] = down ? [] : await listMailLog(60).catch(() => []);
  const summary: MailLogSummary = down ? EMPTY : await mailLogSummary().catch(() => EMPTY);

  return (
    <div className="space-y-3">
      <section className="rounded-2xl bg-panel p-6">
        <PageHeader
          eyebrow="Email"
          title="Email log"
          description="Every ticket email this store has tried to send, newest first. A refusal is written down with the mail server's reason — and any one of them can be sent again, to any address, below."
          actions={
            <Link href="/admin/mail" className={buttonClass("secondary")}>
              <Mail className="h-4 w-4" /> Ticket email
            </Link>
          }
        />
        {problem && (
          <div className="mt-4">
            <Notice tone="warn">{problem}</Notice>
          </div>
        )}
        {(ok || error) && (
          <div className="mt-4">
            <ParamToast ok={ok ? safeDecode(ok) : ""} error={error ? safeDecode(error) : ""} />
          </div>
        )}
      </section>

      <dl className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Sent" value={String(summary.sent)} note={`${summary.total} attempts`} />
        <Stat
          label="Refused"
          value={String(summary.failed)}
          note={summary.failed ? "the mail server said no" : "nothing refused"}
        />
        <Stat
          label="Not attempted"
          value={String(summary.skipped)}
          note="no mail transport configured"
        />
        <Stat
          label="Last attempt"
          value={
            summary.lastAt
              ? new Date(summary.lastAt).toLocaleTimeString("en-GB", {
                  hour: "2-digit",
                  minute: "2-digit",
                })
              : "—"
          }
          note={
            summary.lastAt
              ? new Date(summary.lastAt).toLocaleDateString("en-GB", {
                  day: "numeric",
                  month: "short",
                })
              : "nothing sent yet"
          }
        />
      </dl>

      <div className="grid gap-3 xl:grid-cols-4">
        {/* ---------------- one ticket, by hand ---------------- */}
        <section className="rounded-2xl bg-panel p-6 xl:col-span-2">
          <Eyebrow>Send one again</Eyebrow>
          <h2 className="mt-2 font-display text-xl font-semibold text-strong">
            A ticket that did not arrive
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-muted">
            Type the ticket&apos;s own code — <span className="font-mono text-body">BM-BK7MQ-9WXT3</span>{" "}
            — to send that one person&apos;s ticket and nothing else. Type the sale&apos;s reference to
            send the whole party. The address here is where it goes: it does not have to be the one
            on the booking.
          </p>
          <form id="send-one" action={emailTicketAction} className="mt-4 space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Ticket code or reference">
                <input
                  name="code"
                  required
                  autoComplete="off"
                  spellCheck={false}
                  placeholder="BM-BK7MQ-9WXT3"
                  className={`${inputClass} font-mono uppercase`}
                />
              </Field>
              <Field label="Send to">
                <input
                  name="to"
                  type="email"
                  required
                  autoComplete="email"
                  placeholder="parent@example.com"
                  className={inputClass}
                />
              </Field>
            </div>
            <SubmitButton
              pending="Sending the ticket…"
              className={`${buttonClass("primary")} w-full sm:w-auto`}
              icon={<Send className="h-4 w-4" />}
            >
              Send this ticket
            </SubmitButton>
          </form>
          <p className="mt-3 text-xs leading-relaxed text-muted">
            The message is the real one: the artwork with its code, the QR for that ticket, and the
            bill. The attempt is added to the log either way, so a second refusal is visible too.
          </p>
        </section>

        {/* ---------------- what counts as a problem ---------------- */}
        <section className="rounded-2xl bg-panel p-6 xl:col-span-2">
          <Eyebrow>How to read it</Eyebrow>
          <h2 className="mt-2 font-display text-xl font-semibold text-strong">
            Sent, refused, or never tried
          </h2>
          <ul className="mt-4 space-y-3 text-sm text-muted">
            <li className="flex items-start gap-3">
              <Pill tone="ok">sent</Pill>
              <span className="flex-1 leading-relaxed">
                The mail server accepted the message. A message that is accepted can still land in
                spam — that is the inbox&apos;s decision, not the store&apos;s.
              </span>
            </li>
            <li className="flex items-start gap-3">
              <Pill tone="stop">refused</Pill>
              <span className="flex-1 leading-relaxed">
                The server said no, and its words are on the row. A wrong password, a From: address
                the provider will not send for, an attachment over the limit.
              </span>
            </li>
            <li className="flex items-start gap-3">
              <Pill>not sent</Pill>
              <span className="flex-1 leading-relaxed">
                No transport is configured at all, so nothing left the machine. Set{" "}
                <span className="font-mono text-body">RESEND_API_KEY</span> or{" "}
                <span className="font-mono text-body">SMTP_HOST</span> and send it again from here.
              </span>
            </li>
          </ul>
          <p className="mt-4 text-xs leading-relaxed text-muted">
            Nothing re-sends itself. A retry loop while the mail server is misconfigured only
            multiplies the noise — the office decides what to send again, and to whom.
          </p>
        </section>
      </div>

      {/* ---------------- the log ---------------- */}
      <Panel
        title="Every attempt"
        description="Newest first. Each row can be sent again, with the address filled in from the attempt itself."
      >
        {attempts.length === 0 ? (
          <Empty>
            Nothing has been attempted yet. The first sale writes the first row here.
          </Empty>
        ) : (
          <ul className="space-y-1.5">
            {attempts.map((m) => (
              <Attempt key={m.id} entry={m} />
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}

const KIND_LABEL: Record<string, string> = {
  booking: "with the sale",
  resend: "sent again by hand",
  test: "a test",
};

function Attempt({ entry }: { entry: MailLogEntry }) {
  const when = new Date(entry.at);
  const codes = entry.codes.split(",").map((c) => c.trim()).filter(Boolean);
  // A row with one code is one person: send exactly that back. A row with the
  // whole party is the sale, so the reference goes in instead — the form resolves
  // it the same way the gate does.
  const target = codes.length === 1 ? codes[0] : entry.reference;

  return (
    <li
      data-mail={entry.id}
      data-mail-status={entry.status}
      className="rounded-xl bg-panel-2 px-4 py-3"
    >
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        {entry.status === "sent" ? (
          <Pill tone="ok">sent</Pill>
        ) : entry.status === "failed" ? (
          <Pill tone="stop">refused</Pill>
        ) : (
          <Pill>not sent</Pill>
        )}
        <span className="font-mono text-xs font-semibold text-strong">
          {entry.codes || entry.reference}
        </span>
        {codes.length > 1 && (
          <span className="text-[11px] text-muted">
            {codes.length} tickets · <span className="font-mono">{entry.reference}</span>
          </span>
        )}
        {codes.length === 1 && entry.reference && (
          <span className="text-[11px] text-muted">· {entry.reference}</span>
        )}
        <span className="ml-auto text-[11px] text-muted">
          {when.toLocaleString("en-GB", {
            day: "numeric",
            month: "short",
            hour: "2-digit",
            minute: "2-digit",
          })}
        </span>
      </div>

      <p className="mt-1 text-xs leading-relaxed text-muted">
        to <span className="text-body">{entry.to}</span> · {KIND_LABEL[entry.kind] ?? entry.kind}
        {entry.provider ? ` via ${entry.provider}` : ""}
      </p>

      {entry.error && (
        <p className="mt-1 text-xs leading-relaxed text-gold" data-mail-error>
          {entry.error}
        </p>
      )}

      <details className="mt-1">
        <summary className="inline-flex cursor-pointer list-none items-center gap-1.5 rounded-md py-1 text-[11px] text-muted underline-offset-4 hover:text-strong">
          Send {codes.length === 1 ? "this ticket" : "this sale"} again
        </summary>
        <form action={emailTicketAction} className="mt-2 flex flex-wrap items-center gap-2">
          <input type="hidden" name="code" value={target} />
          <input
            name="to"
            type="email"
            required
            defaultValue={entry.to}
            aria-label={`Send ${target} to`}
            className={`${inputClass} !mt-0 !w-auto min-w-[14rem] flex-1 !py-2 !text-xs`}
          />
          <SubmitButton
            pending="Sending…"
            className={`${buttonClass("secondary")} !px-3 !py-1.5 !text-xs`}
            icon={<Send className="h-3.5 w-3.5" />}
          >
            Send
          </SubmitButton>
        </form>
        <p className="mt-1 text-[11px] text-muted">
          Goes to {target} — {codes.length === 1 ? "that one ticket" : "every ticket on the sale"}.
        </p>
      </details>
    </li>
  );
}
