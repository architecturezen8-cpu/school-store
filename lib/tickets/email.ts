import sharp from "sharp";
import nodemailer, { type Transporter } from "nodemailer";
import { signTicket, ticketUrl } from "./sign";
import type { Ticket } from "../bookings";
import { getMailTemplate } from "./mail-settings";
import { errorMessage } from "../errors";
import { listAllEvents } from "../events";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { getSettings, absoluteLogoUrl } from "../settings";
import { getTemplateForEvent } from "./templates";
import { composeTicket, detectWhiteSquare } from "./detect";
import { fallbackTicketSvg } from "./fallback";
import { buildTicketReceipt, receiptFilename } from "./receipt";
import { qrPayload } from "./sign";

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

/**
 * The logo as it travels in a mail: a small square, the mark centred in it.
 *
 * 192 px is displayed at 96, so it stays sharp on a retina screen without
 * carrying a heavy image into every message.
 */
const LOGO_MAIL_BOX = 192;

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
/**
 * The school's uploaded ticket design, once per person, each with that person's
 * code pasted into its white square.
 *
 * One attachment per seat, not one per sale. A single file for a ten-seat
 * booking would give nine of the ten people nothing to show at the gate —
 * forwarding a picture by hand is exactly the thing nobody does.
 *
 * Each file is named after its place in the sale, so an inbox with ten
 * attachments shows which is which without opening them.
 *
 * Sequential rather than `Promise.all`: sharp is CPU-bound, and ten compositing
 * jobs at once on a small school server thrash rather than help. This runs after
 * the response is sent, so it is no longer on the checkout's critical path.
 */
async function ticketArtworks(tickets: Ticket[]): Promise<{ filename: string; buffer: Buffer }[]> {
  const template = await getTemplateForEvent(tickets[0]?.event ?? "").catch(() => null);

  // No design uploaded (or its file is gone): fall back to the plain ticket the
  // image route draws. A sale with no ticket file in the mail is a queue at the
  // gate, and it used to be exactly what a fresh install produced.
  let design: Buffer;
  let square: { x: number; y: number; size: number; confidence: number };

  if (template) {
    try {
      design = await readFile(
        path.join(process.cwd(), "public", template.file.replace(/^\//, ""))
      );
    } catch {
      return [];
    }
    square = { x: template.qrX, y: template.qrY, size: template.qrSize, confidence: 1 };
  } else {
    design = Buffer.from(fallbackTicketSvg(tickets[0]));
    const detected = await detectWhiteSquare(design).catch(() => null);
    if (!detected) return [];
    square = detected;
  }

  const out: { filename: string; buffer: Buffer }[] = [];
  for (const t of tickets) {
    try {
      const { image } = await composeTicket({
        design,
        qrPayload: qrPayload(t.token, signTicket(t.token)),
        square,
        format: "png",
      });
      out.push({
        filename:
          tickets.length > 1
            ? `${t.reference}-ticket-${t.seq}.png`
            : `${t.reference}-ticket.png`,
        buffer: image,
      });
    } catch {
      // One unrenderable seat should not cost the buyer the other nine.
    }
  }
  return out;
}

async function inlineLogo(): Promise<{
  png: Buffer;
  /** The uploaded file as it arrived, for drawing the crest into the header. */
  raw: Buffer;
  scale: number;
  /** True when the mark is opaque edge to edge, so a square plate would show. */
  opaque: boolean;
} | null> {
  try {
    const { logo, logoScale } = await getSettings();
    const url = await absoluteLogoUrl();
    if (!logo || !url) return null;

    // The stored value is root-relative, so read it straight off disk rather
    // than over the network.
    const rel = logo.replace(/^\//, "");
    const file = path.join(process.cwd(), "public", rel);
    const raw = await readFile(file);

    const meta = await sharp(raw).metadata();
    // Does the image have any usable transparency? A crest saved as JPEG (or a
    // PNG that was flattened onto white) is a solid rectangle, and drawing it
    // "as is" inside a circle shows its corners.
    const opaque = !hasAlpha(meta);

    // Over the white circle, transparent pixels stay white — which is the whole
    // point of the circle. Outside it, over the navy hero, they would be white
    // too, so the image is given a matching transparent margin instead and the
    // circle is drawn behind it as its own element.
    //
    // GIF rather than PNG: Outlook and older Gmail render PNG alpha badly (they
    // composite it onto the message background), while binary transparency in
    // GIF is understood everywhere. The mask below makes the alpha binary, so a
    // soft anti-aliased edge does not turn into a grey fringe.
    const square = LOGO_MAIL_BOX;
    const base = sharp(raw).rotate().resize(square, square, {
      fit: "contain",
      background: { r: 255, g: 255, b: 255, alpha: 0 },
    });

    // Everything above "nearly opaque" becomes fully opaque, the rest fully
    // transparent. A crest has hard edges; a photograph would not survive this,
    // and a logo is not a photograph.
    const { data, info } = await base
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });

    for (let i = 3; i < data.length; i += 4) {
      data[i] = data[i] > 96 ? 255 : 0;
    }

    const png = await sharp(data, {
      raw: { width: info.width, height: info.height, channels: 4 },
    })
      .gif()
      .toBuffer();

    return {
      png,
      raw,
      scale: Math.min(0.98, Math.max(0.3, logoScale)),
      opaque,
    };
  } catch {
    // No logo uploaded, or a file that has gone missing: the wordmark badge
    // below is the fallback, so the mail never has a hole in it.
    return null;
  }
}

/** Whether the source image even has an alpha channel to preserve. */
function hasAlpha(meta: { hasAlpha?: boolean }): boolean {
  return Boolean(meta.hasAlpha);
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
 *  The header photograph, as bytes.
 * ------------------------------------------------------------------ */

/**
 * The banner the header draws: 600 px wide at 2x, and tall enough for the crest,
 * the school's name and a strip of photograph under them.
 */
const HERO_W = 1200;
const HERO_H = 620;

/**
 * The school's name and city, as a transparent PNG.
 *
 * A picture of two lines of type rather than type itself, because this is the
 * one place the mail cannot rely on the reader's fonts: the name is drawn into
 * the header photograph, and a mail client never renders SVG text. Rendered
 * once from a serif at 2343 px wide, so it stays sharp at 2x on a phone and can
 * be scaled down for the 600 px banner without going soft.
 */
const WORDMARK = ["public", "brand", "masthead.png"];

/**
 * The header: photograph, wash, crest and the school's name, baked into one
 * JPEG so the crest and the name sit *on* the photograph.
 *
 * Email has no way to put HTML text on top of an image. The old header tried:
 * a CSS `background-image` on the cell with the text over it. That is a
 * background the client may not fetch and a stack of CSS it may not honour —
 * Gmail strips backgrounds in plenty of contexts and every client blocks remote
 * images — so the inbox showed navy where the preview had a photograph. The fix
 * is not another layer of CSS; it is to stop layering. sharp composites the
 * crest and the name onto the washed photograph, and the mail carries the result
 * as one normal `<img>`.
 *
 * The wash is baked in at the same time, fully opaque navy at the bottom edge so
 * the banner joins the gold tile below it with no seam, and dark under the name
 * so the type reads at AA whatever the photograph is.
 *
 * Returns null when there is no photograph to bake, or when the wordmark is
 * missing — the caller then draws the HTML masthead instead, which is plainer
 * but never broken.
 */
async function heroBanner(
  image: string,
  crest: { raw: Buffer; scale: number; opaque: boolean } | null
): Promise<Buffer | null> {
  if (!image) return null;
  try {
    const raw = /^https?:\/\//i.test(image)
      ? await fetchBytes(image)
      : await readFile(path.join(process.cwd(), "public", image.replace(/^\//, "")));
    if (!raw) return null;
    const wordmarkRaw = await readFile(path.join(process.cwd(), ...WORDMARK));

    const wash = Buffer.from(
      `<svg xmlns="http://www.w3.org/2000/svg" width="${HERO_W}" height="${HERO_H}">
         <defs>
           <linearGradient id="w" x1="0" y1="0" x2="0" y2="1">
             <stop offset="0" stop-color="#0a1224" stop-opacity="1"/>
             <stop offset="0.22" stop-color="#0a1224" stop-opacity="0.90"/>
             <stop offset="0.50" stop-color="#0a1224" stop-opacity="0.82"/>
             <stop offset="0.70" stop-color="#0a1224" stop-opacity="0.60"/>
             <stop offset="0.88" stop-color="#0a1224" stop-opacity="0.82"/>
             <stop offset="1" stop-color="#0a1224" stop-opacity="1"/>
           </linearGradient>
         </defs>
         <rect width="${HERO_W}" height="${HERO_H}" fill="url(#w)"/>
       </svg>`
    );

    // The crest in its white circle, exactly as the HTML masthead draws it. No
    // crest uploaded? The circle is skipped rather than left empty.
    const cx = HERO_W / 2;
    const cy = 150;
    const radius = 88;
    const layers: { input: Buffer; top: number; left: number }[] = [
      { input: wash, top: 0, left: 0 },
    ];

    if (crest) {
      const inner = Math.round(radius * 2 * (crest.opaque ? 1 : crest.scale));
      const circle = Buffer.from(
        `<svg xmlns="http://www.w3.org/2000/svg" width="${HERO_W}" height="${HERO_H}">
           <circle cx="${cx}" cy="${cy}" r="${radius}" fill="#ffffff"/>
         </svg>`
      );
      const mark = await sharp(crest.raw)
        .rotate()
        .resize(inner, inner, {
          fit: "contain",
          background: { r: 255, g: 255, b: 255, alpha: 0 },
        })
        .png()
        .toBuffer();
      layers.push({ input: circle, top: 0, left: 0 });
      layers.push({
        input: mark,
        top: Math.round(cy - inner / 2),
        left: Math.round(cx - inner / 2),
      });
    }

    const wordmark = await sharp(wordmarkRaw).resize({ width: 720 }).png().toBuffer();
    const wm = await sharp(wordmark).metadata();
    layers.push({
      input: wordmark,
      top: 296,
      left: Math.round(cx - (wm.width ?? 720) / 2),
    });

    return await sharp(raw)
      .rotate()
      .resize(HERO_W, HERO_H, { fit: "cover", position: "attention" })
      .composite(layers)
      .flatten({ background: "#0a1224" })
      .jpeg({ quality: 76, mozjpeg: true })
      .toBuffer();
  } catch {
    // A photo that cannot be read, or a wordmark that has gone missing, is not a
    // reason to withhold a ticket: the HTML masthead takes over.
    return null;
  }
}

/** Fetches a remote photograph, but never hangs the checkout on it. */
async function fetchBytes(url: string): Promise<Buffer | null> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return null;
    return Buffer.from(await res.arrayBuffer());
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
   * The event photograph, washed into the navy and inline as `cid:hero-banner`.
   *
   * Inline rather than a remote URL because this is the header of the message:
   * a client that blocks remote images would otherwise show a flat navy band,
   * and the admin would have designed a header nobody ever saw. Null when the
   * event has no photograph, or the file could not be read.
   */
  hero: Buffer | null;
  /** The uploaded crest, inline, so the header never shows a broken image. */
  logo: Buffer | null;
  /**
   * The designed ticket with each booking's code in it, for attaching: one PNG
   * per person.
   *
   * A booking of ten seats gets ten files, because each person at the gate needs
   * their own code and forwarding one file to nine friends does not give them
   * one. Empty when no design has been uploaded — the ticket page still shows a
   * working code for every seat.
   */
  artworks: { filename: string; buffer: Buffer }[];
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

  const logo = await inlineLogo();
  const logoPng = logo?.png ?? null;

  // The designed ticket, one file per person, each with its own code pasted in.
  // This is what the buyer shows at the gate — there is no grid of codes in the
  // body any more, because a wall of QR squares is not a ticket and the artwork
  // already carries the code in the place the design put it.
  const artworks = await ticketArtworks(tickets);

  // The header photograph, inline. There is no QR in the body any more: the
  // design carries the code, and one code per person travels as one attached
  // ticket file. A wall of codes here was rejected twice and is not coming back.
  const hero = await heroBanner(ticket.heroImage || ticket.image, logo);

  const html = ticketHtml({
    heading,
    body,
    footer,
    url,
    // The header photograph travels *inside* the mail (cid:), so it shows even
    // when the reader's client blocks remote images.
    heroCid: hero ? "hero-banner" : "",
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
    // The hero photograph, not the card photo: the header is a wide banner,
    // and the event page already uses the hero for its own header. Only used by
    // the stale-CSS fallback below.
    coverSrc: hero ? "" : coverImageUrl(ticket.heroImage || ticket.image),
    paid: lkr(ticket.total),
    logo: logoPng ? "cid:brand-logo" : "",
    logoScale: logoPng ? logo!.scale : 1,
    logoOpaque: logo ? logo.opaque : false,
    ticketCount: tickets.length,
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
      ...tickets.map((t, i) =>
        `${tickets.length > 1 ? `Ticket ${i + 1}: ` : "Ticket: "}${ticketUrl(
          t.token,
          signTicket(t.token)
        )}`
      ),
    ].join("\n"),
    hero,
    logo: logoPng,
    artworks,
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
    heroImage: event?.heroImage || event?.image || "",
    name: "Sample Ticket",
    email: "",
    total,
    tiers,
    admittedAt: null,
    admittedBy: "",
    blockedAt: null,
    blockedBy: "",
    blockedUntil: null,
    blocked: false,
    code: "BM-BK7MQ-9WXT3",
    tierName: "Grandstand Seat",
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
  const { subject, html, text: body, hero, logo, artworks } = built;
  const ticket = tickets[0];

  // The bill travels with the tickets.
  //
  // It used to live only behind a button on the confirmation screen, which meant
  // the document a parent needs for a claim was one link away from somebody who
  // had closed that tab — and the admin's Resend sent tickets only. It is the
  // same PDF the button produces, drawn from the same rows, so the two can never
  // say different amounts.
  const receipt = await buildTicketReceipt(tickets, {
    logoFile: (await getSettings().catch(() => ({ logo: "" }))).logo || undefined,
  }).catch(() => null);

  const attachments = [
    // The header photograph, inline. It is part of the message, not a link to
    // one: the header is the thing the admin designed, and a client that blocks
    // remote images would otherwise show a flat navy band instead.
    ...(hero
      ? [
          {
            filename: "hero.jpg",
            content: hero,
            inline: true,
            contentId: "hero-banner",
          },
        ]
      : []),
    // The crest, inline for the same reason: a remote URL is a broken image
    // whenever the host has moved on without the file. Only when the HTML
    // masthead is drawing it — a baked header has the crest in its own pixels,
    // and a second copy would be one more file in the inbox for nothing.
    ...(logo && !hero
      ? [
          {
            filename: "brand-logo.png",
            content: logo,
            inline: true,
            contentId: "brand-logo",
          },
        ]
      : []),
    // The bill for the whole sale, one file: proof of what was paid, printable,
    // and the thing a school asks for when somebody claims at the office.
    ...(receipt
      ? [
          {
            filename: receiptFilename(ticket.reference),
            content: Buffer.from(receipt),
            inline: false,
            contentId: "",
          },
        ]
      : []),
    // The finished tickets, one file per person: the buyer opens the one they
    // need, prints it, or shows it on a screen that is not their mail app.
    ...artworks.map((a) => ({
      filename: a.filename,
      content: a.buffer,
      inline: false,
      contentId: "",
    })),
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
          // Only inline parts get a cid; the ticket file is a normal attachment.
          ...(a.contentId ? { cid: a.contentId } : {}),
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
  heroCid,
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
  logoOpaque,
  of,
  totalSeats,
  ticketCount,
}: {
  heading: string;
  body: string;
  footer: string;
  url: string;
  /**
   * `cid:hero-banner` when the header photograph is inline, or "". The header
   * draws a real `<img>` when it is set — see `heroBanner`.
   */
  heroCid: string;
  /** Event name, shown in the cover and repeated in the details row. */
  event: string;
  reference: string;
  /** How many people the booking admits. */
  seats: string;
  /** What the whole booking bought, e.g. "Grandstand Seat × 2, Stand × 1". */
  seatsText: string;
  /** How many tickets the booking has. */
  of: number;
  /** How many ticket files are attached — one per person. */
  ticketCount: number;
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
  /** True when the mark has no transparency, so it should fill the circle. */
  logoOpaque: boolean;
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
  // The circle is an element of its own, and the logo is a plain image on top.
  //
  // It used to be one <img> with `border-radius` doing the clipping, which is
  // what produced the white plate: a round mask over a square crest cuts the
  // corners and leaves the white padding showing as a square against the navy.
  // Drawing a solid white circle underneath and floating a transparent-cornered
  // logo above it means the white is exactly the circle and nothing else — the
  // same on the storefront, and the same for a transparent upload.
  const circle = 96;
  // An opaque crest fills the circle edge to edge; a transparent one is padded,
  // so it is scaled by what the admin set.
  const inner = logoOpaque
    ? circle
    : Math.round(circle * (logo ? logoScale : 0.62));

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
                     style="display:block;margin:0 auto;width:${inner}px;height:${inner}px">`
                 : `<div style="width:${circle}px;height:${circle}px;line-height:${circle}px;color:#0a1224;font-family:Georgia,'Times New Roman',serif;font-size:24px;letter-spacing:2px">STC</div>`
             }
           </td></tr>
         </table>`;

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

  /**
   * The header: the crest and the school on the navy, then the event's own
   * photograph as a real image underneath.
   *
   * The photograph used to be a CSS `background-image` with the masthead drawn
   * over it. That looked right in the admin preview, which is a browser, and
   * vanished in the inbox, which is not: Gmail and Outlook both drop CSS
   * backgrounds in plenty of contexts, and every client blocks remote images
   * until the reader allows them. So the photo is now a proper `<img>` fed from
   * a `cid:` — part of the message rather than something to fetch — and the
   * words sit on the navy above it, never on top of a picture that may not be
   * there.
   *
   * The wash is baked into the JPEG by `heroBanner`, with fully opaque navy at
   * its top and bottom edges, so the band joins the masthead and the gold tile
   * without a seam. Nothing depends on the photograph for contrast.
   */
  // The baked header: photograph, crest and the school's name in one image, which
  // is the only way email lets anything sit *on* a photograph. The alt text says
  // what the image says, because a reader with images off gets nothing else.
  const heroImg = heroCid
    ? `
   <tr><td align="center" style="background:#0a1224;padding:0;font-size:0;line-height:0">
     <img src="cid:${escapeHtml(
       heroCid
     )}" alt="St. Thomas&rsquo; College, Matale &mdash; ${escapeHtml(
        event
      )}" width="600" height="310" style="display:block;width:100%;max-width:600px;height:auto;border:0;outline:none;text-decoration:none">
   </td></tr>`
    : // Only reached when the photograph could not be read or the wordmark is
      // missing: keep the old CSS band so a client that *does* honour backgrounds
      // still gets a header, and everyone else gets the navy.
      coverSrc
      ? `
   <tr><td bgcolor="#0a1224" height="150" valign="top" style="background-color:#0a1224;background-image:url('${escapeHtml(
     coverSrc
   )}');background-size:cover;background-position:center;background-repeat:no-repeat;height:150px"></td></tr>`
      : "";

  // Fallback masthead, drawn in HTML: used when there is no photograph to bake,
  // and when the banner could not be composed. Never when the banner has already
  // carried the crest and the name.
  const masthead = heroCid
    ? ""
    : `
   <!-- the masthead: crest and name, on the navy -->
   <tr><td bgcolor="#0a1224" align="center" style="padding:32px 30px 26px">

     ${badge}

     <div style="color:#ffffff;font-size:22px;letter-spacing:4px;text-transform:uppercase;font-family:Georgia,'Times New Roman',serif;padding-top:16px;line-height:1.3">St. Thomas&rsquo; College</div>
     <div style="color:#ffd444;font-size:9px;letter-spacing:7px;text-transform:uppercase;padding-top:7px">Matale &middot; Sri Lanka</div>
   </td></tr>`;

  const hero = `
   ${masthead}

   ${heroImg}
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

   <!-- the tickets: attached, one per person -->
   <tr><td align="center" style="background:#0a1224;padding:30px 24px 0">
     <div style="color:#9fb0cc;font-size:10px;letter-spacing:3px;text-transform:uppercase;padding-bottom:8px">${
       ticketCount > 1 ? "Your tickets" : "Your ticket"
     }</div>
     <div style="max-width:430px;margin:0 auto;background:#121a30;border:1px solid #2a3450;padding:18px 20px">
       <div style="color:#e4eaf5;font-size:13px;line-height:1.7">
         ${
           ticketCount > 1
             ? `All <strong style="color:#ffd444">${ticketCount} tickets</strong> are attached to this email &mdash; one file per person.`
             : `Your ticket is attached to this email.`
         }
       </div>
       <div style="color:#8b9ab5;font-size:12px;line-height:1.6;padding-top:8px">
         Open the attachment for the QR code &mdash; it is scanned once, for one entry.
       </div>
     </div>
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
