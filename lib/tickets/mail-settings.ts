import { query } from "../db";
import { DEFAULT_MAIL_TEMPLATE, type MailTemplate } from "./email";

/**
 * The wording of the ticket email, as the admin leaves it.
 *
 * One row, id = 1. A blank field means "use the default", so clearing the box
 * restores the shipped message instead of leaving the customer with an empty
 * email. The defaults themselves live in email.ts, next to the HTML they feed.
 */

const COLUMNS = "subject, heading, body, footer";

export async function getMailTemplate(): Promise<MailTemplate> {
  const rows = await query<{
    subject: string | null;
    heading: string | null;
    body: string | null;
    footer: string | null;
  }>(`select ${COLUMNS} from mail_templates where id = 1`);

  const row = rows[0];
  if (!row) return DEFAULT_MAIL_TEMPLATE;

  return {
    subject: row.subject?.trim() ? row.subject : DEFAULT_MAIL_TEMPLATE.subject,
    heading: row.heading?.trim() ? row.heading : DEFAULT_MAIL_TEMPLATE.heading,
    body: row.body?.trim() ? row.body : DEFAULT_MAIL_TEMPLATE.body,
    footer: row.footer?.trim() ? row.footer : DEFAULT_MAIL_TEMPLATE.footer,
  };
}

export async function saveMailTemplate(next: MailTemplate): Promise<void> {
  await query(
    `insert into mail_templates (id, subject, heading, body, footer)
     values (1, $1, $2, $3, $4)
     on conflict (id) do update
       set subject = excluded.subject,
           heading = excluded.heading,
           body = excluded.body,
           footer = excluded.footer,
           updated_at = now()`,
    [next.subject, next.heading, next.body, next.footer]
  );
}

/** Whichever fields the admin left blank, replaced with the shipped default. */
export function withDefaults(partial: Partial<MailTemplate>): MailTemplate {
  return {
    subject: partial.subject?.trim() ? partial.subject : DEFAULT_MAIL_TEMPLATE.subject,
    heading: partial.heading?.trim() ? partial.heading : DEFAULT_MAIL_TEMPLATE.heading,
    body: partial.body?.trim() ? partial.body : DEFAULT_MAIL_TEMPLATE.body,
    footer: partial.footer?.trim() ? partial.footer : DEFAULT_MAIL_TEMPLATE.footer,
  };
}
