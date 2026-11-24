import { readFile } from "node:fs/promises";
import sharp from "sharp";
import path from "node:path";
import nodemailer, { type Transporter } from "nodemailer";
import { signTicket, ticketUrl, ticketImageUrl } from "./sign";
import { getTemplateForEvent } from "./templates";
import { composeTicket, detectWhiteSquare } from "./detect";
import type { Ticket } from "../bookings";
import { getMailTemplate } from "./mail-settings";

/**
 * Delivering the ticket by email.
 *
 * Two transports, picked by whichever environment variables are present:
 *
 *   RESEND_API_KEY=re_…            → Resend's HTTP API
 *   SMTP_HOST / SMTP_PORT / SMTP_USER / SMTP_PASS  → any SMTP server
 *
 * Neither configured means the mail is logged and skipped, so local
 * development and the test suite never need real credentials.
 */

export type MailResult =
  | { sent: true; provider: "resend" | "smtp"; id: string }
  | { sent: false; reason: "not-configured" | "failed"; error?: string };

function fromAddress(): string {
  return (
    process.env.MAIL_FROM ??
    "The Thomian Store <onboarding@resend.dev>"
  );
}

/* ------------------------------------------------------------------ *
 *  The message, which the admin can customise.
 * ------------------------------------------------------------------ */

export type MailTemplate = {
  subject: string;
  /** Text with {{name}}, {{event}}, {{reference}}, {{seats}} placeholders. */
  body: string;
  /** Headline shown above the artwork in the HTML mail. */
  heading: string;
  /** Small print under the ticket image. */
  footer: string;
};

export const DEFAULT_MAIL_TEMPLATE: MailTemplate = {
  subject: "Your ticket · {{event}} ({{reference}})",
  heading: "You're going to {{event}}",
  body:
    "Hello {{name}},\n\n" +
    "Your booking is confirmed. Your ticket is attached to this email — show the QR code at the gate.\n\n" +
    "Booking reference: {{reference}}\n" +
    "Seats: {{seats}}\n\n" +
    "Please keep this email. The QR code can be scanned once at the gate.",
  footer:
    "St. Thomas' College Matale · Animo et Fide · Est. 1873\nQuestions? Reply to this email.",
};

export function renderTemplate(text: string, values: Record<string, string>): string {
  return text.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, key: string) => values[key] ?? "");
}

/* ------------------------------------------------------------------ *
 *  Rendering the ticket image for an email.
 * ------------------------------------------------------------------ */

/**
 * Just the QR, cropped out of the ticket artwork.
 *
 * The artwork is shown at 552 px wide in the mail, so a QR that is 18% of a
 * 1440 px design lands on the screen about 100 px across — large enough for a
 * camera only if the reader zooms. A crop of the same QR, shown at 220 px, is
 * what people actually scan; the full artwork stays below it for the design.
 */
async function qrCloseUp(
  ticketImage: Buffer,
  square: { x: number; y: number; size: number }
): Promise<Buffer | null> {
  try {
    return await sharp(ticketImage)
      .extract({
        left: Math.max(0, square.x),
        top: Math.max(0, square.y),
        width: square.size,
        height: square.size,
      })
      .png()
      .toBuffer();
  } catch {
    return null;
  }
}

export type TicketRender = {
  /** The full artwork with the QR pasted in — what gets attached. */
  image: Buffer;
  /** The same QR, cropped, for the top of the mail. Null if it could not be cut. */
  qr: Buffer | null;
  width: number;
  height: number;
};

async function ticketImage(ticket: Ticket, signature: string): Promise<TicketRender | null> {
  const template = await getTemplateForEvent(ticket.event);
  const payload = ticketUrl(ticket.token, signature);

  if (template) {
    const file = path.join(process.cwd(), "public", template.file.replace(/^\//, ""));
    try {
      const design = await readFile(file);
      const square = {
        x: template.qrX,
        y: template.qrY,
        size: template.qrSize,
        confidence: 1,
      };
      const { image, width, height } = await composeTicket({
        design,
        qrPayload: payload,
        square,
        format: "png",
      });
      return { image, qr: await qrCloseUp(image, square), width, height };
    } catch {
      // fall through to the generated ticket
    }
  }
  return null;
}

/* ------------------------------------------------------------------ *
 *  Sending.
 * ------------------------------------------------------------------ */

export async function sendTicketEmail(
  ticket: Ticket,
  overrides: Partial<MailTemplate> = {}
): Promise<MailResult> {
  // Whatever the admin saved wins; anything they left blank falls back to the
  // shipped default, so a half-filled editor can never send an empty email.
  const saved = await getMailTemplate().catch(() => DEFAULT_MAIL_TEMPLATE);
  const mail: MailTemplate = {
    ...DEFAULT_MAIL_TEMPLATE,
    ...stripEmpty(saved),
    ...stripEmpty(overrides),
  };
  const signature = signTicket(ticket.token);
  const url = ticketUrl(ticket.token, signature);
  const imageUrl = ticketImageUrl(ticket.token, signature);
  const seats = ticket.tiers.reduce((n, t) => n + t.qty, 0);
  const seatsText = ticket.tiers.map((t) => `${t.name} × ${t.qty}`).join(", ");

  const values = {
    name: ticket.name,
    event: ticket.eventTitle,
    reference: ticket.reference,
    seats: seatsText || String(seats),
    total: String(ticket.total),
    venue: `${ticket.venue}, ${ticket.city}`,
    date: new Date(ticket.eventDate).toDateString(),
  };

  const subject = renderTemplate(mail.subject, values);
  const body = renderTemplate(mail.body, values);
  const heading = renderTemplate(mail.heading, values);
  const footer = renderTemplate(mail.footer, values);

  const render = await ticketImage(ticket, signature);
  const image = render?.image ?? null;

  const html = ticketHtml({
    heading,
    body,
    footer,
    url,
    // The close-up travels *inside* the mail (cid:), so it renders even when the
    // reader's client blocks remote images — which is exactly the image the
    // customer has to show at the gate.
    qrSrc: render?.qr ? "cid:ticket-qr" : imageUrl,
    artworkSrc: imageUrl,
    hasImage: true,
  });

  // Resend: one POST, no SMTP. Preferred when the key is set.
  const resendKey = process.env.RESEND_API_KEY;
  if (resendKey) {
    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          authorization: `Bearer ${resendKey}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          from: fromAddress(),
          to: [ticket.email],
          subject,
          html,
          text: body,
          attachments: [
            ...(image
              ? [
                  {
                    filename: `${ticket.reference}.png`,
                    content: image.toString("base64"),
                  },
                ]
              : []),
            ...(render?.qr
              ? [
                  {
                    filename: "ticket-qr.png",
                    content: render.qr.toString("base64"),
                    inline: true,
                    contentId: "ticket-qr",
                  },
                ]
              : []),
          ],
        }),
      });

      if (!res.ok) {
        const detail = await res.text();
        return { sent: false, reason: "failed", error: `Resend ${res.status}: ${detail.slice(0, 300)}` };
      }
      const json = (await res.json()) as { id?: string };
      return { sent: true, provider: "resend", id: json.id ?? "" };
    } catch (err) {
      return { sent: false, reason: "failed", error: (err as Error).message };
    }
  }

  // SMTP: Gmail, the school's own mail server, anything.
  if (process.env.SMTP_HOST) {
    const transport: Transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT ?? 587),
      secure: process.env.SMTP_SECURE === "1",
      auth:
        process.env.SMTP_USER && process.env.SMTP_PASS
          ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
          : undefined,
    });

    try {
      const info = await transport.sendMail({
        from: fromAddress(),
        to: ticket.email,
        subject,
        text: body,
        html,
        attachments: [
          ...(image ? [{ filename: `${ticket.reference}.png`, content: image }] : []),
          ...(render?.qr
            ? [
                {
                  filename: "ticket-qr.png",
                  content: render.qr,
                  cid: "ticket-qr",
                },
              ]
            : []),
        ],
      });
      return { sent: true, provider: "smtp", id: info.messageId ?? "" };
    } catch (err) {
      return { sent: false, reason: "failed", error: (err as Error).message };
    }
  }

  console.log(
    `[tickets] email not configured — would have sent ${ticket.reference} to ${ticket.email}`
  );
  return { sent: false, reason: "not-configured" };
}

/** Ignores empty strings so a blank admin field keeps the default. */
function stripEmpty<T extends object>(obj: T): Partial<T> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (typeof v === "string" && v.trim() === "") continue;
    if (v !== undefined && v !== null) out[k] = v;
  }
  return out as Partial<T>;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!
  );
}

/**
 * A table-based layout with inline styles: email clients still ignore most of
 * what a modern stylesheet does, so this is deliberately old-fashioned.
 */
export function ticketHtml({
  heading,
  body,
  footer,
  url,
  qrSrc,
  artworkSrc,
  hasImage,
}: {
  heading: string;
  body: string;
  footer: string;
  url: string;
  qrSrc: string;
  artworkSrc: string;
  hasImage: boolean;
}): string {
  const paragraphs = body
    .split(/\n{2,}/)
    .map((p) => `<p style="margin:0 0 16px;line-height:1.6">${escapeHtml(p).replace(/\n/g, "<br>")}</p>`)
    .join("");

  return `<!doctype html>
<html><body style="margin:0;padding:0;background:#f4f4f5;font-family:Arial,Helvetica,sans-serif;color:#111">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:24px 12px">
 <tr><td align="center">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border-radius:14px;overflow:hidden">
   <tr><td style="background:#0a1224;border-top:6px solid #ffd444;padding:24px">
     <div style="color:#ffd444;font-size:12px;letter-spacing:3px;text-transform:uppercase">Admission ticket</div>
     <h1 style="margin:10px 0 0;color:#ffffff;font-size:24px">${escapeHtml(heading)}</h1>
   </td></tr>
   ${
     hasImage
       ? `<tr><td align="center" style="padding:24px 24px 0">
       <img src="${escapeHtml(qrSrc)}" alt="Your ticket QR code" width="220" height="220" style="width:220px;height:220px;display:block;border:1px solid #e5e7eb;border-radius:10px;background:#ffffff">
       <div style="font-size:12px;color:#6b7280;padding-top:10px">Show this at the gate</div>
     </td></tr>
     <tr><td style="padding:18px 24px 0"><img src="${escapeHtml(artworkSrc)}" alt="Your ticket" width="552" style="width:100%;max-width:552px;border-radius:10px;border:1px solid #e5e7eb;display:block"></td></tr>`
       : ""
   }
   <tr><td style="padding:0 24px 8px;font-size:15px;color:#333">${paragraphs}</td></tr>
   <tr><td style="padding:0 24px 24px">
     <a href="${escapeHtml(url)}" style="display:inline-block;background:#0a1224;color:#ffffff;text-decoration:none;padding:12px 22px;border-radius:10px;font-size:14px">View your ticket</a>
   </td></tr>
   <tr><td style="background:#f9fafb;border-top:1px solid #e5e7eb;padding:18px 24px;color:#6b7280;font-size:12px;line-height:1.6">${escapeHtml(footer).replace(/\n/g, "<br>")}</td></tr>
  </table>
 </td></tr>
</table>
</body></html>`;
}
