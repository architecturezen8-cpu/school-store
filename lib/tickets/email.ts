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
import { absoluteLogoUrl } from "../settings";

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
  overrides: Partial<MailTemplate> = {},
  of = ticket.of
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

  // "Ticket 2 of 4" belongs in the subject: someone with four people's tickets in
  // an inbox needs to know which one this is before opening it.
  const ticketNumber = of > 1 ? ` (${ticket.seq} of ${of})` : "";
  const subject = renderTemplate(mail.subject, values) + ticketNumber;
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
    // One ticket admits one person, so this is 1. The sale as a whole is what has
    // several seats, and that is `seatsText`.
    seats: "1",
    seatsText: seatsText || `${seats} seat${seats === 1 ? "" : "s"}`,
    seq: ticket.seq,
    of,
    totalSeats: seats,
    date: longDate(ticket.eventDate),
    venue: `${ticket.venue}, ${ticket.city}`,
    coverSrc: coverImageUrl(ticket.image),
    paid: lkr(ticket.total),
    logo: await absoluteLogoUrl(),
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
    seq: 1,
    of: 1,
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

/**
 * A booking of four seats is four emails — one ticket each.
 *
 * Every ticket is a separate person with a separate QR, so bundling them into one
 * message left the second, third and fourth holder with nothing they could show
 * at the gate that had not already been scanned. Sending them one at a time is
 * also what the customer expects: forward the email to the person it is for.
 *
 * Deliberately sequential rather than `Promise.all`: a school sending forty
 * tickets should not open forty SMTP connections at once, and one failure should
 * not abort the rest.
 */
export async function sendTicketEmails(
  tickets: Ticket[],
  overrides: Partial<MailTemplate> = {}
): Promise<MailResult> {
  let sent = 0;
  let lastError = "";
  let reason: "not-configured" | "failed" = "failed";
  let provider: "resend" | "smtp" = "smtp";
  let lastId = "";

  for (const ticket of tickets) {
    const result = await sendTicketEmail(ticket, overrides, tickets.length);
    if (result.sent) {
      sent++;
      provider = result.provider;
      lastId = result.id;
    } else {
      reason = result.reason;
      if (result.error) lastError = result.error;
    }
  }

  if (sent === tickets.length && sent > 0) return { sent: true, provider, id: lastId };
  if (sent > 0) {
    // Partial: say so rather than pretending. The booking stands; the ones that
    // went are in the customer's inbox and the rest can be resent.
    return {
      sent: false,
      reason: "failed",
      error: `${sent} of ${tickets.length} tickets were sent. ${lastError}`.trim(),
    };
  }
  return { sent: false, reason, error: lastError || undefined };
}

export async function sendTicketEmail(
  ticket: Ticket,
  overrides: Partial<MailTemplate> = {},
  /** How many tickets this booking has, so the message can say "2 of 4". */
  of = ticket.of
): Promise<MailResult> {
  const built = await buildTicketMail(ticket, overrides, of);
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
  logo,
  seq,
  of,
  totalSeats,
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
  /** One ticket admits one person, so this is "1". */
  seats: string;
  /** What the whole booking bought, e.g. "Grandstand Seat × 2, Stand × 1". */
  seatsText: string;
  /** Which ticket this is, 1-based. */
  seq: number;
  /** How many tickets the booking has. */
  of: number;
  /** Seats on the whole booking. */
  totalSeats: number;
  /** Already formatted, e.g. "Saturday, 9 January 2027". */
  date: string;
  venue: string;
  /** Absolute URL of the event photograph, or "" for a plain navy cover. */
  coverSrc: string;
  /** e.g. "LKR 3,000" — the amount actually charged. */
  paid: string;
  /** Absolute URL of the school logo, or "" to fall back to the crest wordmark. */
  logo: string;
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
  /**
   * The identity block: the school's logo in a white circle, then the name.
   *
   * The circle is not decoration. A crest is usually a dark badge with thin
   * lines, and set straight on the navy hero it disappears; on white it reads at
   * any size, which is why the site puts it in one too. The white is a solid
   * `bgcolor` as well as a CSS background, because Outlook drops the latter.
   *
   * No logo uploaded yet? The white circle keeps its shape and shows the same
   * wordmark the site uses, so the mail never has a hole in it.
   */
  const badge = `
         <table role="presentation" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin:0 auto">
           <tr><td width="72" height="72" align="center" valign="middle" bgcolor="#ffffff"
                   style="width:72px;height:72px;background:#ffffff;border-radius:36px">
             ${
               logo
                 ? `<img src="${escapeHtml(
                     logo
                   )}" alt="College crest" width="72" height="72"
                     style="display:block;width:72px;height:72px;border-radius:36px;object-fit:cover">`
                 : `<div style="width:72px;height:72px;line-height:72px;color:#0a1224;font-family:Georgia,'Times New Roman',serif;font-size:20px;letter-spacing:2px">STC</div>`
             }
           </td></tr>
         </table>`;

  /**
   * "Ticket 2 of 4" — the one thing this email has to say that the booking
   * confirmation did not. Four seats means four emails, and a person holding two
   * of them needs to know which one is theirs without scanning both at the gate.
   */
  const ticketLine =
    of > 1
      ? `<div style="padding-top:14px;color:#0a1224;font-size:9px;letter-spacing:3px;text-transform:uppercase">
           Ticket ${seq} of ${of}
         </div>`
      : "";

  const hero = `
   <tr><td bgcolor="#0a1224" valign="top" style="background:#0a1224">
     <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse">
       <tr><td align="center" style="padding:30px 30px 26px">

         ${badge}

         <div style="color:#ffffff;font-size:22px;letter-spacing:4px;text-transform:uppercase;font-family:Georgia,'Times New Roman',serif;padding-top:16px;line-height:1.3">St. Thomas&rsquo; College</div>
         <div style="color:#ffd444;font-size:9px;letter-spacing:7px;text-transform:uppercase;padding-top:7px">Matale &middot; Sri Lanka</div>
       </td></tr>
     </table>
   </td></tr>

   <!-- the event, as the gold tile the site would give it -->
   <tr><td style="background:#0a1224;padding:0 16px">
     <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;background:#ffd444">
       <tr><td style="padding:22px 24px 20px">
         <div style="color:#5c4a00;font-size:9px;letter-spacing:3px;text-transform:uppercase">${escapeHtml(
           date
         )}</div>
         <div style="color:#0a1224;font-size:26px;line-height:1.2;font-family:Georgia,'Times New Roman',serif;padding-top:8px">${escapeHtml(
           heading
         )}</div>
         ${ticketLine}
       </td></tr>
     </table>
   </td></tr>

   <!-- the message, in a soft dark tile -->
   <tr><td style="background:#0a1224;padding:12px 16px 0">
     <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;background:#121a30">
       <tr><td style="padding:22px 24px;color:#e4eaf5;font-size:14px;line-height:1.75">${paragraphs}</td></tr>
     </table>
   </td></tr>`;

  return `<!doctype html>
<html lang="en"><body style="margin:0;padding:0;background:#04060d;color:#111;font-family:Arial,Helvetica,sans-serif">
<div style="display:none;max-height:0;overflow:hidden;opacity:0">Your ${escapeHtml(
    event
  )} ticket${of > 1 ? ` ${seq} of ${of}` : ""} &middot; ${escapeHtml(reference)}</div>
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
         ${cell("Ticket", of > 1 ? `${seq} of ${of}` : "1", "one person", true, 20)}
         ${cell("Reference", reference, "booking", false, 16)}
         ${cell("Paid", paid, "payment done", false, 17)}
       </tr>
     </table>
     <div style="padding-top:14px;font-family:'Courier New',Courier,monospace;font-size:11px;letter-spacing:1.2px;color:#93a3c0">
       <span style="color:#ffd444">&#9646;</span> PAYMENT&nbsp;DONE &middot; ${escapeHtml(
         paid.toUpperCase()
       )} &middot; REF ${escapeHtml(reference.toUpperCase())}
     </div>
     ${
       // The sale bought several seats; this email is one of them. Say which,
       // and say what the whole booking holds, so nobody is surprised at the gate.
       totalSeats > 1
         ? `<div style="padding-top:10px;color:#93a3c0;font-size:12px;line-height:1.6">
              This is one of <strong style="color:#ffffff">${totalSeats} tickets</strong> on booking ${escapeHtml(
                reference
              )} — <span style="color:#c3cde0">${escapeHtml(seatsText)}</span>. Each is emailed separately and each admits one person.
            </div>`
         : ""
     }
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
