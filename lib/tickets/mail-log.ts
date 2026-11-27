import { databaseDown, hasDatabase, query } from "../db";
import { errorMessage } from "../errors";

/**
 * What happened to every ticket email.
 *
 * The shop could already tell you that a sale existed, and could not tell you
 * that its email had arrived. That gap is the whole reason this file exists: an
 * email is the only thing standing between a payment and a person getting in,
 * and "the parent says nothing came" used to be unanswerable — there was no row
 * anywhere that said the mail server had refused, or that no transport had been
 * configured at all.
 *
 * So each attempt is written down. It is deliberately a *log*, not an outbox:
 * nothing is retried automatically, because a retry that runs while the mail
 * server is misconfigured just doubles the noise. The admin reads the page, sees
 * what failed, and sends that one ticket again by hand.
 */

export type MailLogKind = "booking" | "resend" | "test";
export type MailLogStatus = "sent" | "failed" | "skipped";

export type MailLogEntry = {
  id: string;
  at: string;
  reference: string;
  codes: string;
  to: string;
  subject: string;
  kind: MailLogKind;
  status: MailLogStatus;
  provider: string;
  messageId: string;
  error: string;
};

export type MailLogSummary = {
  total: number;
  sent: number;
  failed: number;
  skipped: number;
  /** The one number that has to be looked at: what did not leave, recently. */
  problems: number;
  lastAt: string | null;
};

/**
 * Writes one row.
 *
 * Never throws, and never waits on anything the caller cares about: a log is
 * worth less than the mail it describes, so a database hiccup here must not turn
 * a successful send into a failed one, nor a failed send into an exception that
 * reaches the checkout. The one thing it does do is print to the server log, so
 * there is still a trail when even the log could not be written.
 */
export async function recordMailAttempt(entry: {
  reference: string;
  codes: string;
  to: string;
  subject: string;
  kind: MailLogKind;
  status: MailLogStatus;
  provider?: string;
  messageId?: string;
  error?: string;
}): Promise<void> {
  if (!hasDatabase() || databaseDown()) return;
  try {
    await query(
      `insert into email_log
         (booking_reference, ticket_codes, to_email, subject, kind, status, provider, message_id, error)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        entry.reference,
        entry.codes,
        entry.to,
        entry.subject.slice(0, 300),
        entry.kind,
        entry.status,
        entry.provider ?? "",
        entry.messageId ?? "",
        (entry.error ?? "").slice(0, 600),
      ]
    );
  } catch (err) {
    console.error("[mail] could not record the attempt:", errorMessage(err));
  }
}

/** The columns, once: both readers below show the same rows. */
const COLUMNS = `id, created_at as at, booking_reference as reference,
                 ticket_codes as codes, to_email as to, subject, kind, status,
                 provider, message_id, error`;

type Row = {
  id: string;
  at: string;
  reference: string;
  codes: string;
  to: string;
  subject: string;
  kind: MailLogKind;
  status: MailLogStatus;
  provider: string;
  message_id: string;
  error: string;
};

const toEntry = (r: Row): MailLogEntry => ({
  id: r.id,
  at: r.at,
  reference: r.reference,
  codes: r.codes,
  to: r.to,
  subject: r.subject,
  kind: r.kind,
  status: r.status,
  provider: r.provider,
  messageId: r.message_id,
  error: r.error,
});

/** Newest first. */
export async function listMailLog(limit = 100): Promise<MailLogEntry[]> {
  const rows = await query<Row>(
    `select ${COLUMNS} from email_log order by created_at desc limit $1`,
    [limit]
  );
  return rows.map(toEntry);
}

/**
 * The same question the log answers, for one sale.
 *
 * A parent who rings about their own booking should not have to be found in a
 * list of two hundred other people's addresses, so the booking page shows this
 * sale's attempts under the resend button.
 */
export async function mailLogForReference(reference: string): Promise<MailLogEntry[]> {
  const rows = await query<Row>(
    `select ${COLUMNS} from email_log
      where upper(booking_reference) = upper($1)
      order by created_at desc limit 20`,
    [reference]
  );
  return rows.map(toEntry);
}

/**
 * The last thing that happened to each sale's email, for a list of sales.
 *
 * The bookings list is where the office notices a parent is still waiting, so it
 * carries one word per row — emailed, not sent, or no mail set up at all. One
 * query for the whole page, and an empty answer is not an error: a sale with no
 * row has simply never been mailed (or the table predates it).
 */
export async function mailStatusByReference(
  refs: string[]
): Promise<Map<string, MailLogEntry>> {
  const out = new Map<string, MailLogEntry>();
  const wanted = refs.map((r) => r.toUpperCase()).filter(Boolean);
  if (!wanted.length || !hasDatabase() || databaseDown()) return out;
  try {
    const rows = await query<Row>(
      `select distinct on (upper(booking_reference)) ${COLUMNS}
         from email_log
        where upper(booking_reference) = any($1::text[])
        order by upper(booking_reference), created_at desc`,
      [wanted]
    );
    for (const r of rows) out.set(r.reference.toUpperCase(), toEntry(r));
  } catch (err) {
    console.warn("[mail] could not read the per-sale status:", errorMessage(err));
  }
  return out;
}

export async function mailLogSummary(): Promise<MailLogSummary> {
  const rows = await query<{
    total: number;
    sent: number;
    failed: number;
    skipped: number;
    problems: number;
    last_at: string | null;
  }>(
    `select count(*)::int                                              as total,
            count(*) filter (where status = 'sent')::int               as sent,
            count(*) filter (where status = 'failed')::int             as failed,
            count(*) filter (where status = 'skipped')::int            as skipped,
            -- What has to be looked at today: anything that did not leave in
            -- the last seven days. Older failures are history, not a problem.
            count(*) filter (where status <> 'sent'
                               and created_at > now() - interval '7 days')::int as problems,
            max(created_at)                                            as last_at
       from email_log`
  );
  const r = rows[0];
  return {
    total: r?.total ?? 0,
    sent: r?.sent ?? 0,
    failed: r?.failed ?? 0,
    skipped: r?.skipped ?? 0,
    problems: r?.problems ?? 0,
    lastAt: r?.last_at ?? null,
  };
}
