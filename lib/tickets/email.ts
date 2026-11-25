import sharp from "sharp";
import nodemailer, { type Transporter } from "nodemailer";
import { signTicket, ticketUrl, ticketImageUrl } from "./sign";
import type { Ticket } from "../bookings";
import { getMailTemplate } from "./mail-settings";
import { errorMessage } from "../errors";
import { listAllEvents } from "../events";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { getSettings, absoluteLogoUrl } from "../settings";

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
/**
 * The uploaded logo, inline.
 *
 * It used to point at an absolute URL — `https://machan.me/uploads/brand/x.png`
 * — and that URL is exactly what broke: a mail client opens the message long
 * before the deploy that has that file, and an image the reader cannot fetch is
 * a broken-image icon. Inlining the bytes means the crest is *in* the message.
 *
 * Three parts on purpose: the circle is a solid white `bgcolor` (Outlook drops
 * CSS backgrounds), the size is a percentage of that circle so the admin's scale
 * setting carries into the mail, and the PNG is opaque white-flattened on upload
 * so it cannot turn into a black square in a client that ignores transparency.
 */
async function inlineLogo(): Promise<{ png: Buffer; scale: number } | null> {
  try {
    const { logo, logoScale } = await getSettings();
    const url = await absoluteLogoUrl();
    if (!logo || !url) return null;

    // Local path when we have one; the stored value is root-relative, so read it
    // straight off disk rather than over the network.
    const rel = logo.replace(/^\//, "").replace(/^uploads\//, "uploads/");
    const file = path.join(process.cwd(), "public", rel);
    const raw = await readFile(file);

    const meta = await sharp(raw).metadata();
    const png = await sharp(raw)
      // Small: it is shown at 72-96 px, and a heavy PNG is the difference
      // between a message that lands in an inbox and one that lands in spam.
      .resize({ width: 192, height: 192, fit: "inside", withoutEnlargement: true })
      .png({ compressionLevel: 9 })
      .toBuffer();
    const w = meta.width ?? 1;
    const h = meta.height ?? 1;
    // Shown inside a padded box, so a tall crest keeps its own aspect instead of
    // being stretched by the circle. `scale` is what the admin set by eye.
    return { png, scale: Math.min(0.98, Math.max(0.3, logoScale)) };
  } catch {
    // No logo uploaded, or a file that has gone missing: the wordmark badge
    // below is the fallback, so the mail never has a hole in it.
    return null;
  }
}

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

/* ------------------------------------------------------------------ *
 *  Sending.
 * ------------------------------------------------------------------ */

export type BuiltMail = {
  subject: string;
  html: string;
  /** Plain-text fallback, so the mail is readable with images off. */
  text: string;
  /**
   * One QR per ticket in the booking, keyed by `cid`, so a four-seat sale is one
   * message with four codes inside it rather than four messages.
   */
  codes: { cid: string; buffer: Buffer }[];
  /** The uploaded crest, inline, so the header never shows a broken image. */
  logo: Buffer | null;
};

/**
 * Builds the exact message a booking produces, without sending it.
 *
 * Split out of `sendTicketEmail` so the admin's preview is the real thing
 * rather than a mock-up — "what you see is what the customer gets" is the only
 * way a preview is worth having.
 */
export async function buildBookingMail(
  /** Every ticket from one sale, first seat first. Never empty. */
  tickets: Ticket[],
  overrides: Partial<MailTemplate> = {}
): Promise<BuiltMail> {
  const ticket = tickets[0];
  const of = tickets.length || ticket.of;
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

  // One message per sale now, so the subject says how many people it covers
  // ("4 tickets") instead of which one of four it is.
  const subject =
    renderTemplate(mail.subject, values) + (of > 1 ? ` (${of} tickets)` : "");
  const body = renderTemplate(mail.body, values);
  const heading = renderTemplate(mail.heading, values);
  const footer = renderTemplate(mail.footer, values);

  // No attached artwork any more.
  //
  // It used to compose the whole designed ticket — sharp, a 1440 px PNG, ~54 KB
  // — once per seat, and because the mail was sent before the response, a
  // four-seat booking sat on "Reserving…" for seconds. The artwork is already
  // reachable from the ticket page and the receipt, and this message carries the
  // one thing the gate actually scans: the code below. Dropping it makes the
  // mail build in milliseconds and stops a heavy design from landing in spam.
  //
  // One code per ticket, all inside the same message. Drawn from each ticket's
  // own payload, never cropped from the artwork — see qrImage().
  const logo = await inlineLogo();
  const logoPng = logo?.png ?? null;

  const perSeat: string[] = [];
  for (const t of ticket.tiers) {
    for (let n = 0; n < t.qty; n++) perSeat.push(t.id);
  }
  // The buyer's word for it, not the stored id: "pavilion" is "VIP Pavilion" on
  // the site and on the price list, and the code label has to match them.
  const tierName = (id: string) =>
    ticket.tiers.find((t) => t.id === id)?.name ?? tierFor(id);
  const codes: { cid: string; buffer: Buffer }[] = [];
  const codesHtml: { name: string; tier: string; src: string; url: string }[] = [];
  for (const [i, t] of tickets.entries()) {
    const codeUrl = ticketUrl(t.token, signTicket(t.token));
    const buffer = await qrImage(codeUrl);
    const cid = `ticket-qr-${i + 1}`;
    if (buffer) codes.push({ cid, buffer });
    codesHtml.push({
      // "1" for a single-seat sale, "Ticket 2" for a multi-seat one: numbering a
      // one-ticket booking would only raise the question of where the rest are.
      name: tickets.length > 1 ? `Ticket ${i + 1}` : "",
      // Seat i belongs to the i-th unit sold, in the same order createBooking
      // assigned them: "2 × Grandstand, 1 × Stand" is grandstand, grandstand,
      // stand. A single-tier sale needs no label at all.
      tier: ticket.tiers.length === 1 ? "" : tierName(perSeat[i] ?? ""),
      src: buffer ? `cid:${cid}` : ticketImageUrl(t.token, signTicket(t.token)),
      url: codeUrl,
    });
  }

  const html = ticketHtml({
    heading,
    body,
    footer,
    url,
    // Every code travels *inside* the mail (cid:), so they render even when the
    // reader's client blocks remote images — which is exactly the image the
    // customer has to show at the gate, and exactly the image that was blank in
    // the broken preview.
    codes: codesHtml,
    // The detail row under the message. These are the facts a person checks at
    // the gate, so they are not left to the editable wording.
    event: ticket.eventTitle,
    reference: ticket.reference,
    // Every seat in the sale, in one message.
    seats: String(seats),
    seatsText: seatsText || `${seats} seat${seats === 1 ? "" : "s"}`,
    of,
    totalSeats: seats,
    date: longDate(ticket.eventDate),
    venue: `${ticket.venue}, ${ticket.city}`,
    coverSrc: coverImageUrl(ticket.image),
    paid: lkr(ticket.total),
    logo: logoPng ? "cid:brand-logo" : "",
    logoScale: logoPng ? logo!.scale : 1,
  });

  return {
    subject,
    html,
    text: [
      body,
      "",
      `Reference: ${ticket.reference}`,
      `Seats: ${values.seats}`,
      `Paid: ${lkr(ticket.total)}`,
      ...codesHtml.map((c, i) =>
        `${tickets.length > 1 ? `Ticket ${i + 1}: ` : "Ticket: "}${c.url}`
      ),
    ].join("\n"),
    codes,
    logo: logoPng,
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
 * Sends one booking's tickets.
 *
 * One message, not one per seat. A four-seat sale used to produce four emails,
 * which is four things to find in an inbox and — because the booking waited for
 * SMTP — several seconds of "Reserving…" at the checkout. The message carries
 * every code instead, so the buyer forwards nothing and the gate still sees one
 * admission per code.
 *
 * `tickets` is the whole sale in seq order; a single seat is a list of one.
 */
export async function sendTicketEmails(
  tickets: Ticket[],
  overrides: Partial<MailTemplate> = {}
): Promise<MailResult> {
  if (!tickets.length) return { sent: false, reason: "failed", error: "No tickets to send." };
  return sendTicketEmail(tickets, overrides);
}

/** The whole sale in one message. Kept as one function so mail can be retried. */
export async function sendTicketEmail(
  tickets: Ticket[],
  overrides: Partial<MailTemplate> = {}
): Promise<MailResult> {
  const built = await buildBookingMail(tickets, overrides);
  const { subject, html, text: body, codes, logo } = built;
  const ticket = tickets[0];
  const attachments = [
    // Every code inline, so they render even when the client blocks remote
    // images — which is exactly the image the customer has to show at the gate.
    ...codes.map((c) => ({
      filename: `${c.cid}.png`,
      content: c.buffer,
      inline: true,
      contentId: c.cid,
    })),
    // The crest, inline for the same reason: a remote URL is a broken image
    // whenever the host has moved on without the file.
    ...(logo
      ? [
          {
            filename: "brand-logo.png",
            content: logo,
            inline: true,
            contentId: "brand-logo",
          },
        ]
      : []),
  ];

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
          attachments: attachments.map((a) => ({
            filename: a.filename,
            content: a.content.toString("base64"),
            inline: a.inline,
            contentId: a.contentId,
          })),
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
        attachments: attachments.map((a) => ({
          filename: a.filename,
          content: a.content,
          cid: a.contentId,
        })),
      });
      return { sent: true, provider: "smtp", id: info.messageId ?? "" };
    } catch (err) {
      return { sent: false, reason: "failed", error: errorMessage(err) };
    }
  }

  console.log(
    `[tickets] email not configured — would have sent ${ticket.reference} (${tickets.length} ticket${
      tickets.length === 1 ? "" : "s"
    }) to ${ticket.email}`
  );
  return { sent: false, reason: "not-configured" };
}

/**
 * A tier id, made readable, when the sale itself does not know the name.
 *
 * Only a fallback: the normal path asks the booking, which carries the real
 * label ("VIP Pavilion"). This is for a ticket whose tier id no longer matches
 * anything — a tier renamed after the sale — so the label degrades to "Pavilion"
 * rather than disappearing.
 */
function tierFor(id: string): string {
  return id
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
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
  codes,
  event,
  reference,
  seats,
  seatsText,
  date,
  venue,
  coverSrc,
  paid,
  logo,
  logoScale,
  of,
  totalSeats,
}: {
  heading: string;
  body: string;
  footer: string;
  url: string;
  /**
   * Every code in the sale, each with its own `cid:`. A four-seat booking is one
   * message with four codes, so the buyer forwards nothing and the gate still
   * sees four separate admissions.
   */
  codes: { name: string; tier: string; src: string; url: string }[];
  /** Event name, shown in the cover and repeated in the details row. */
  event: string;
  reference: string;
  /** How many people the booking admits. */
  seats: string;
  /** What the whole booking bought, e.g. "Grandstand Seat × 2, Stand × 1". */
  seatsText: string;
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
  /** `cid:brand-logo`, or "" to fall back to the crest wordmark. */
  logo: string;
  /** How much of the white circle the logo fills, 0.3-1. */
  logoScale: number;
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
  // 96 px of white, with the mark inset by the admin's scale. The image is not
  // the circle: a crest that fills its own canvas would be cropped by a round
  // mask, so it sits inside a padded white box and the circle is the box.
  const circle = 96;
  const inner = Math.round(circle * (logo ? logoScale : 0.62));

  const badge = `
         <table role="presentation" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin:0 auto">
           <tr><td width="${circle}" height="${circle}" align="center" valign="middle" bgcolor="#ffffff"
                   style="width:${circle}px;height:${circle}px;background:#ffffff;border-radius:${
                     circle / 2
                   }px">
             ${
               logo
                 ? `<img src="${escapeHtml(
                     logo
                   )}" alt="College crest" width="${inner}" height="${inner}"
                     style="display:block;margin:0 auto;width:${inner}px;height:${inner}px;object-fit:contain">`
                 : `<div style="width:${circle}px;height:${circle}px;line-height:${circle}px;color:#0a1224;font-family:Georgia,'Times New Roman',serif;font-size:24px;letter-spacing:2px">STC</div>`
             }
           </td></tr>
         </table>`;

  /**
   * The codes, laid out for a mail client.
   *
   * Tables, not flexbox: Outlook renders neither grid nor flex, and the one
   * thing this email cannot afford to get wrong is the layout of the codes.
   * Two per row on a wide screen, one per row on a phone — the 240 px cells
   * stack because the table is width="100%" with fixed cell widths and the
   * client wraps them.
   *
   * Each code is a white, padded square so it scans off a screen even in a
   * client that recolours backgrounds, with the number under it so the buyer
   * knows which one to hand to whom.
   */
  const codeCell = (c: (typeof codes)[number]) => `
        <td width="${codes.length > 1 ? "50%" : "100%"}" align="center" valign="top" style="padding:0 6px 18px">
          ${
            c.name
              ? `<div style="color:#ffd444;font-size:9px;font-weight:bold;letter-spacing:2.5px;text-transform:uppercase;padding-bottom:8px">${escapeHtml(
                  c.name
                )}${c.tier ? ` &middot; ${escapeHtml(c.tier)}` : ""}</div>`
              : ""
          }
          <a href="${escapeHtml(c.url)}" style="text-decoration:none">
            <img src="${escapeHtml(c.src)}" alt="Your ticket QR code" width="220" height="220"
                 style="display:block;width:220px;height:220px;margin:0 auto;background:#ffffff;border:8px solid #ffffff">
          </a>
        </td>`;

  const codeRows: string[] = [];
  for (let i = 0; i < codes.length; i += 2) {
    const pair = codes.slice(i, i + 2);
    codeRows.push(
      `<tr>${pair.map(codeCell).join("")}${
        pair.length === 1 && codes.length > 1
          ? '<td width="50%">&nbsp;</td>'
          : ""
      }</tr>`
    );
  }
  // Nothing rendered at all would leave a hole where the ticket should be; the
  // fallback says where to go rather than showing a broken image.
  const codeGrid = codes.length
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;max-width:472px;margin:0 auto">${codeRows.join(
        ""
      )}</table>`
    : `<div style="color:#8b9ab5;font-size:12px">Open your ticket to see the entry code.</div>`;

  /**
   * How many people this one message admits. It used to say "ticket 2 of 4",
   * when four seats meant four separate emails; now the whole sale arrives
   * together, so the band says so once, at the top.
   */
  const ticketLine =
    of > 1
      ? `<div style="padding-top:14px;color:#0a1224;font-size:9px;letter-spacing:3px;text-transform:uppercase">
           ${of} tickets &middot; ${escapeHtml(seatsText)}
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
  )} ticket${of > 1 ? `s (${of})` : ""} &middot; ${escapeHtml(reference)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#04060d;padding:28px 12px">
 <tr><td align="center">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#0a1224;border-collapse:collapse">

   ${hero}

   <!-- the codes: one per seat, side by side on a wide screen -->
   <tr><td align="center" style="background:#0a1224;padding:30px 24px 0">
     <div style="color:#9fb0cc;font-size:10px;letter-spacing:3px;text-transform:uppercase;padding-bottom:6px">${
       codes.length > 1 ? "Your entry codes" : "Your entry code"
     }</div>
     <div style="color:#8b9ab5;font-size:12px;line-height:1.6;padding-bottom:16px">${
       codes.length > 1
         ? `One code per person &mdash; each is scanned once, for one entry`
         : `Show this at the gate &mdash; one scan, one entry`
     }</div>
     ${codeGrid}
   </td></tr>

   <!-- reference / seats / paid -->
   <tr><td style="background:#0a1224;padding:28px 24px 0">
     <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#060a16;border-top:1px solid #2a3450;border-bottom:1px solid #2a3450;border-collapse:collapse">
       <tr>
         ${cell(of > 1 ? "Tickets" : "Ticket", String(of), of > 1 ? "one each" : "one person", true, 20)}
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
       // Every seat is on this message, so say plainly that each code is its own
       // admission — the thing a buyer needs to know before the gate.
       totalSeats > 1
         ? `<div style="padding-top:10px;color:#93a3c0;font-size:12px;line-height:1.6">
              All <strong style="color:#ffffff">${totalSeats} tickets</strong> for booking ${escapeHtml(
                reference
              )} are in this email — <span style="color:#c3cde0">${escapeHtml(
                seatsText
              )}</span>. Each code admits one person, once.
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
