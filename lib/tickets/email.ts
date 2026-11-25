import { readFile } from "node:fs/promises";
import sharp from "sharp";
import path from "node:path";
import nodemailer, { type Transporter } from "nodemailer";
import { signTicket, ticketUrl, ticketImageUrl } from "./sign";
import { getTemplateForEvent } from "./templates";
import { composeTicket, detectWhiteSquare } from "./detect";
import type { Ticket } from "../bookings";
import { getMailTemplate } from "./mail-settings";
import { errorMessage } from "../errors";
import { listAllEvents } from "../events";

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

/** "Saturday, 9 January 2027" — the mail should not look like a timestamp. */
function longDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

/** The event photograph as an absolute URL the mail client can fetch. */
function coverImageUrl(image: string): string {
  if (!image) return "";
  if (/^https?:\/\//i.test(image)) return image;
  const base = (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");
  return `${base}${image.startsWith("/") ? "" : "/"}${image}`;
}

/** "LKR 3,000" — a receipt should not depend on a locale the reader may not have. */
function lkr(n: number): string {
  return `LKR ${n.toLocaleString("en-LK")}`;
}

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
  subject: "Your ticket · {{event}} · {{reference}}",
  heading: "{{event}}",
  body:
    "{{name}}, your reservation is confirmed.\n\n" +
    "Please check that everything below is in order, and show the QR code at the " +
    "gate. It is scanned once, for one entry.\n\n" +
    "Have a wonderful time.",
  footer:
    "St. Thomas' College Matale · Animo et Fide · Est. 1873\n" +
    "Questions? Reply to this email and the store will help.",
};

export function renderTemplate(text: string, values: Record<string, string>): string {
  return text.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, key: string) => values[key] ?? "");
}

/* ------------------------------------------------------------------ *
 *  Rendering the ticket image for an email.
 * ------------------------------------------------------------------ */

/**
 * The QR on its own, drawn straight from the ticket's URL.
 *
 * This used to be cropped out of the finished artwork, which looked clever and
 * was wrong: the crop follows whatever the admin's design happens to hold (a
 * card, a frame, a watermark), so the "entry code" in the mail could arrive
 * half-cut. Drawing it from the payload gives a clean, centred code every time,
 * and it is the same data the artwork carries — so the gate accepts either.
 *
 * 600 px with a two-module margin: sharp at the 220 px the mail shows it, with
 * the quiet zone a scanner needs, and small enough to travel inline.
 */
async function qrImage(payload: string): Promise<Buffer | null> {
  try {
    const { default: QRCode } = await import("qrcode");
    return await QRCode.toBuffer(payload, {
      type: "png",
      width: 600,
      margin: 2,
      errorCorrectionLevel: "H",
      color: { dark: "#000000", light: "#ffffff" },
    });
  } catch {
    return null;
  }
}

export type TicketRender = {
  /** The full artwork with the QR pasted in — what gets attached. */
  image: Buffer;
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
      return { image, width, height };
    } catch {
      // fall through to the generated ticket
    }
  }
  return null;
}

/* ------------------------------------------------------------------ *
 *  Sending.
 * ------------------------------------------------------------------ */

export type BuiltMail = {
  subject: string;
  html: string;
  /** Plain-text fallback, so the mail is readable with images off. */
  text: string;
  /** The finished artwork with this booking's QR in it, if it could be drawn. */
  artwork: Buffer | null;
  /** The same QR, cropped, to travel inline as cid:ticket-qr. */
  qr: Buffer | null;
};

/**
 * Builds the exact message a booking produces, without sending it.
 *
 * Split out of `sendTicketEmail` so the admin's preview is the real thing
 * rather than a mock-up — "what you see is what the customer gets" is the only
 * way a preview is worth having.
 */
export async function buildTicketMail(
  ticket: Ticket,
  overrides: Partial<MailTemplate> = {}
): Promise<BuiltMail> {
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
  // Drawn from the payload, not cropped from the artwork — see qrImage().
  const qr = await qrImage(url);

  const html = ticketHtml({
    heading,
    body,
    footer,
    url,
    // The close-up travels *inside* the mail (cid:), so it renders even when the
    // reader's client blocks remote images — which is exactly the image the
    // customer has to show at the gate.
    qrSrc: qr ? "cid:ticket-qr" : imageUrl,
    artworkSrc: imageUrl,
    hasImage: true,
    // The detail row under the message. These are the facts a person checks at
    // the gate, so they are not left to the editable wording.
    event: ticket.eventTitle,
    reference: ticket.reference,
    seats: String(seats),
    seatsText: seatsText || `${seats} seat${seats === 1 ? "" : "s"}`,
    date: longDate(ticket.eventDate),
    venue: `${ticket.venue}, ${ticket.city}`,
    coverSrc: coverImageUrl(ticket.image),
    paid: lkr(ticket.total),
  });

  return {
    subject,
    html,
    text: [body, "", `Reference: ${ticket.reference}`, `Seats: ${values.seats}`, `Paid: ${lkr(ticket.total)}`, `Ticket: ${url}`].join("\n"),
    artwork: image,
    qr,
  };
}

/**
 * A stand-in booking, for testing the mail before anyone has bought a ticket.
 *
 * A brand-new store has no bookings, and the test send used to refuse with
 * "Sell one ticket first". That is the wrong way round: the test is what an
 * admin does *before* the first sale, to check the ticket is not landing in
 * spam. So when there is no real booking to borrow, this borrows the shape of a
 * real one instead — a real event (title, date, venue, artwork, tier prices from
 * the database), a clearly-marked sample reference, and a fresh random token so
 * the QR is genuine and unique.
 *
 * Deliberately not stored: a fake row in `bookings` would turn up in the gate
 * scanner, in the takings and in the sales list, and there is no honest way to
 * delete it again. The only thing a sample costs is that the QR does not open a
 * live ticket, and the message says so.
 */
export async function sampleTicket(): Promise<Ticket> {
  // Admin-shaped rows, because the sample has to work on an empty store too —
  // unpublished events included.
  const events = await listAllEvents().catch(() => []);
  const event = events.find((e) => e.tiers.length > 0) ?? events[0];

  const tiers = (event?.tiers ?? []).slice(0, 1).map((t) => ({
    id: t.id,
    name: t.name,
    price: t.price,
    qty: 2,
  }));
  const total = tiers.reduce((n, t) => n + t.price * t.qty, 0) || 3000;

  return {
    reference: "BM-SAMPLE",
    token: Buffer.from(
      Array.from({ length: 16 }, () => Math.floor(Math.random() * 256))
    ).toString("base64url"),
    event: event?.slug ?? "",
    eventTitle: event?.title ?? "The Big Match",
    eventDate: event?.startsAt ?? "2027-01-09T10:00:00.000Z",
    venue: event?.venue ?? "College Grounds",
    city: event?.city ?? "Matale",
    doors: event?.doors ?? "Gates open 8:00 AM",
    image: event?.image ?? "",
    name: "Sample Ticket",
    email: "",
    total,
    tiers,
    admittedAt: null,
    admittedBy: "",
  };
}

export async function sendTicketEmail(
  ticket: Ticket,
  overrides: Partial<MailTemplate> = {}
): Promise<MailResult> {
  const built = await buildTicketMail(ticket, overrides);
  const { subject, html, text: body, artwork: image, qr } = built;

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
            ...(qr
              ? [
                  {
                    filename: "ticket-qr.png",
                    content: qr.toString("base64"),
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
      return { sent: false, reason: "failed", error: errorMessage(err) };
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
          ...(qr
            ? [
                {
                  filename: "ticket-qr.png",
                  content: qr,
                  cid: "ticket-qr",
                },
              ]
            : []),
        ],
      });
      return { sent: true, provider: "smtp", id: info.messageId ?? "" };
    } catch (err) {
      return { sent: false, reason: "failed", error: errorMessage(err) };
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
  event,
  reference,
  seats,
  seatsText,
  date,
  venue,
  coverSrc,
  paid,
}: {
  heading: string;
  body: string;
  footer: string;
  url: string;
  qrSrc: string;
  artworkSrc: string;
  hasImage: boolean;
  /** Event name, shown in the cover and repeated in the details row. */
  event: string;
  reference: string;
  /** How many people the booking admits, e.g. "3". */
  seats: string;
  /** What those seats are, e.g. "Grandstand Seat × 2, Stand × 1". */
  seatsText: string;
  /** Already formatted, e.g. "Saturday, 9 January 2027". */
  date: string;
  venue: string;
  /** Absolute URL of the event photograph, or "" for a plain navy cover. */
  coverSrc: string;
  /** e.g. "LKR 3,000" — the amount actually charged. */
  paid: string;
}): string {
  const paragraphs = body
    .split(/\n{2,}/)
    .map(
      (p) =>
        `<p style="margin:0 0 14px">${escapeHtml(p).replace(/\n/g, "<br>")}</p>`
    )
    .join("");

  /**
   * One cell of the three-across details row: a small label, a large value, and
   * a quiet line under it. Hairline dividers between cells, never boxes.
   */
  const cell = (
    label: string,
    value: string,
    note: string,
    first = false,
    size = 22
  ) => `
        <td width="33%" valign="top" align="center" style="padding:18px 7px;${
          first ? "" : "border-left:1px solid #2a3450;"
        }">
          <div style="color:#9fb0cc;font-size:9px;letter-spacing:2.5px;text-transform:uppercase">${escapeHtml(
            label
          )}</div>
          <div style="color:#ffffff;font-size:${size}px;line-height:1.25;padding-top:8px;font-family:Georgia,'Times New Roman',serif;word-break:break-word">${escapeHtml(
            value
          )}</div>
          <div style="color:#8b9ab5;font-size:11px;line-height:1.45;padding-top:6px">${escapeHtml(note)}</div>
        </td>`;

  /**
   * The cover. A table cell with a background image and a translucent navy
   * overlay, so the brand and the message sit *on* the photograph the way the
   * reference design does. Outlook (which ignores CSS backgrounds) keeps the
   * flat navy and still shows everything, because nothing relies on the photo
   * for contrast.
   */
  const hero = `
   <tr><td background="${escapeHtml(
     coverSrc
   )}" bgcolor="#0a1224" valign="top" style="background-color:#0a1224;${
    coverSrc ? `background-image:url('${escapeHtml(coverSrc)}');` : ""
  }background-size:cover;background-position:center top;">
     <!--[if mso]>
     <v:rect xmlns:v="urn:schemas-microsoft-com:vml" fill="true" stroke="false" style="width:600px;">
       <v:fill type="frame" src="${escapeHtml(coverSrc)}" color="#0a1224" />
       <v:textbox style="mso-fit-shape-to-text:true" inset="0">
     <![endif]-->
     <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;background:rgba(4,6,13,0.62)">
       <tr><td align="center" style="padding:34px 30px 30px">

         <!-- brand, set on the photograph -->
         <div style="color:#ffffff;font-size:10px;letter-spacing:5px;text-transform:uppercase;opacity:0.85">Est. 1873</div>
         <div style="color:#ffffff;font-size:24px;letter-spacing:4px;text-transform:uppercase;font-family:Georgia,'Times New Roman',serif;padding-top:8px;line-height:1.3">St. Thomas&rsquo; College</div>
         <div style="color:#ffd444;font-size:9px;letter-spacing:7px;text-transform:uppercase;padding-top:6px">Matale &middot; Sri Lanka</div>
         <div style="height:1px;width:46px;background:#ffd444;margin:18px auto"></div>

         <!-- the date, then the event, then what the admin wrote -->
         <div style="color:#ffd444;font-size:10px;letter-spacing:3px;text-transform:uppercase">${escapeHtml(
           date
         )}</div>
         <h1 style="margin:8px 0 0;color:#ffffff;font-size:26px;line-height:1.25;font-family:Georgia,'Times New Roman',serif;font-weight:normal">${escapeHtml(
           heading
         )}</h1>

         <div style="color:#e4eaf5;font-size:14px;line-height:1.7;padding-top:16px;max-width:400px">${paragraphs}</div>
       </td></tr>
     </table>
     <!--[if mso]>
       </v:textbox>
     </v:rect>
     <![endif]-->
   </td></tr>`;

  return `<!doctype html>
<html lang="en"><body style="margin:0;padding:0;background:#04060d;color:#111;font-family:Arial,Helvetica,sans-serif">
<div style="display:none;max-height:0;overflow:hidden;opacity:0">Your ${escapeHtml(
    event
  )} ticket &middot; ${escapeHtml(reference)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#04060d;padding:28px 12px">
 <tr><td align="center">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#0a1224;border-collapse:collapse">

   ${hero}

   ${
     hasImage
       ? `<!-- the ticket itself: the code, then the artwork the school uploaded -->
   <tr><td align="center" style="background:#0a1224;padding:30px 24px 0">
     <div style="color:#9fb0cc;font-size:10px;letter-spacing:3px;text-transform:uppercase;padding-bottom:14px">Your entry code</div>
     <img src="${escapeHtml(
       qrSrc
     )}" alt="Your ticket QR code" width="220" height="220" style="width:220px;height:220px;display:block;background:#ffffff;border:8px solid #ffffff">
     <div style="color:#9fb0cc;font-size:12px;line-height:1.6;padding-top:12px">Show this at the gate&nbsp;&mdash;&nbsp;one scan, one entry<br><span style="color:#8b9ab5">The full ticket is below and attached.</span></div>
   </td></tr>
   <tr><td align="center" style="background:#0a1224;padding:26px 24px 0">
     <img src="${escapeHtml(
       artworkSrc
     )}" alt="Your ticket" width="552" style="width:100%;max-width:552px;height:auto;display:block;border:1px solid #1d2740">
   </td></tr>`
       : ""
   }

   <!-- reference / seats / paid -->
   <tr><td style="background:#0a1224;padding:28px 24px 0">
     <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#060a16;border-top:1px solid #2a3450;border-bottom:1px solid #2a3450;border-collapse:collapse">
       <tr>
         ${cell("Reference", reference, "booking", true, 17)}
         ${cell("Seats", String(seats), seatsText, false, 26)}
         ${cell("Paid", paid, "payment done", false, 19)}
       </tr>
     </table>
     <div style="padding-top:14px;font-family:'Courier New',Courier,monospace;font-size:11px;letter-spacing:1.2px;color:#93a3c0">
       <span style="color:#ffd444">&#9646;</span> PAYMENT&nbsp;DONE &middot; ${escapeHtml(
         paid.toUpperCase()
       )} &middot; REF ${escapeHtml(reference.toUpperCase())}
     </div>
   </td></tr>

   <!-- one wide, solid button -->
   <tr><td style="background:#0a1224;padding:26px 0 0">
     <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse">
       <tr><td align="center" bgcolor="#ffd444" style="background:#ffd444">
         <a href="${escapeHtml(
           url
         )}" style="display:block;padding:20px 24px;color:#04060d;font-size:11px;font-weight:bold;letter-spacing:3.5px;text-transform:uppercase;text-decoration:none">View your ticket</a>
       </td></tr>
     </table>
   </td></tr>

   <!-- footer -->
   <tr><td style="background:#04060d;border-top:1px solid #1d2740;padding:24px;color:#8b9ab5;font-size:12px;line-height:1.75;text-align:center">${escapeHtml(
     footer
   ).replace(/\n/g, "<br>")}</td></tr>
  </table>

  <div style="max-width:600px;color:#8593ad;font-size:11px;padding-top:16px;text-align:center;line-height:1.6">
    You are receiving this because a ticket was booked with this email address.<br>
    The Thomian Store &middot; St. Thomas&rsquo; College Matale &middot; Matale, Sri Lanka
  </div>
 </td></tr>
</table>
</body></html>`;
}
