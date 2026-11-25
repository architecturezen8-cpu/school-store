import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { readFile } from "node:fs/promises";
import path from "node:path";
import type { Ticket } from "../bookings";
import { ticketUrl, signTicket } from "./sign";

/**
 * The receipt — a PDF the buyer can keep, print or forward to the bursar.
 *
 * A ticket is a bearer document: it gets scanned, creased and thrown away. A
 * receipt is the proof of payment, and a school selling tickets in Sri Lanka
 * needs one that can be printed for a claim. So the ticket page and the
 * confirmation screen both offer this.
 *
 * Drawn rather than screenshotted, for two reasons: a PDF of a PNG of a web page
 * is a 2 MB apology, and the numbers on it have to be re-computable from the
 * booking rather than whatever the browser last rendered.
 *
 * The layout is deliberately plain — this is a document, not a poster:
 *
 *   · the crest, then the school, then "Receipt"
 *   · the booking: reference, buyer, date, event, venue
 *   · one line per ticket type with quantity and amount, then the total
 *   · each ticket's reference and code, so the gate can match the paper to the QR
 *   · a footer that says what the document is and where it came from
 */

const PAGE = { width: 595, height: 842 }; // A4 at 72 dpi
const MARGIN = 48;
const INK = rgb(0.06, 0.09, 0.16);
const MUTED = rgb(0.42, 0.47, 0.56);
const LINE = rgb(0.85, 0.87, 0.9);
const GOLD = rgb(1, 0.83, 0.27);

/** "LKR 3,000" — same formatting as the site, so the two agree to the rupee. */
function lkr(n: number): string {
  return `LKR ${n.toLocaleString("en-LK")}`;
}

function longDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export async function buildTicketReceipt(
  tickets: Ticket[],
  options: { logoFile?: string } = {}
): Promise<Uint8Array> {
  if (!tickets.length) throw new Error("No tickets to receipt.");
  const first = tickets[0];

  const pdf = await PDFDocument.create();
  const page = pdf.addPage([PAGE.width, PAGE.height]);
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const serif = await pdf.embedFont(StandardFonts.TimesRoman);

  pdf.setTitle(`Receipt ${first.reference} — St. Thomas' College Matale`);
  pdf.setAuthor("The Thomian Store");
  pdf.setSubject(`${first.eventTitle} — ${longDate(first.eventDate)}`);

  let y = PAGE.height - MARGIN;

  /* ---------- header: crest, school, document name ---------- */
  let textLeft = MARGIN;

  if (options.logoFile) {
    try {
      const bytes = await readFile(
        path.join(process.cwd(), "public", options.logoFile.replace(/^\//, ""))
      );
      const image = await pdf.embedPng(bytes).catch(() => pdf.embedJpg(bytes));
      const box = 46;
      page.drawImage(image, {
        x: MARGIN,
        y: y - box,
        width: box,
        height: box,
      });
      // A hairline circle is enough to echo the white badge the site uses,
      // without trying to draw a filled circle in a black-and-white document.
      page.drawCircle({ x: MARGIN + box / 2, y: y - box / 2, size: box / 2, borderColor: LINE, borderWidth: 0.8 });
      textLeft = MARGIN + box + 14;
    } catch {
      // A logo that will not embed must not cost the customer their receipt.
    }
  }

  page.drawText("ST. THOMAS' COLLEGE", {
    x: textLeft,
    y: y - 15,
    size: 13,
    font: bold,
    color: INK,
  });
  page.drawText("Matale, Sri Lanka", {
    x: textLeft,
    y: y - 29,
    size: 8.5,
    font: regular,
    color: MUTED,
  });
  page.drawText("Animo et Fide · Est. 1873", {
    x: textLeft,
    y: y - 41,
    size: 8,
    font: regular,
    color: MUTED,
  });

  page.drawText("RECEIPT", {
    x: PAGE.width - MARGIN - bold.widthOfTextAtSize("RECEIPT", 18),
    y: y - 16,
    size: 18,
    font: bold,
    color: INK,
  });
  const paidLabel = "PAID IN FULL";
  page.drawText(paidLabel, {
    x: PAGE.width - MARGIN - bold.widthOfTextAtSize(paidLabel, 7.5),
    y: y - 30,
    size: 7.5,
    font: bold,
    color: MUTED,
  });

  y -= 66;
  page.drawRectangle({ x: MARGIN, y: y, width: PAGE.width - MARGIN * 2, height: 2.5, color: GOLD });
  y -= 26;

  /* ---------- the two-column facts ---------- */
  const fact = (label: string, value: string, x: number, width: number) => {
    page.drawText(label.toUpperCase(), { x, y, size: 7, font: bold, color: MUTED });
    page.drawText(value, { x, y: y - 13, size: 10.5, font: regular, color: INK, maxWidth: width });
  };

  fact("Booking reference", first.reference, MARGIN, 240);
  fact("Issued", new Date().toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }), PAGE.width - MARGIN - 180, 180);

  y -= 40;
  fact("Name", first.name, MARGIN, 240);
  fact("Email", first.email || "—", PAGE.width - MARGIN - 180, 180);

  y -= 40;
  page.drawText("EVENT", { x: MARGIN, y, size: 7, font: bold, color: MUTED });
  y -= 16;
  page.drawText(first.eventTitle, { x: MARGIN, y, size: 15, font: serif, color: INK });
  y -= 14;
  page.drawText(`${longDate(first.eventDate)} · ${first.venue}, ${first.city}`, {
    x: MARGIN,
    y,
    size: 9,
    font: regular,
    color: MUTED,
  });

  /* ---------- the money: one row per ticket type ---------- */
  y -= 34;
  const right = PAGE.width - MARGIN;
  const colQty = right - 210;
  const colAmount = right;

  const header = (label: string, x: number, align: "left" | "right" = "left") => {
    const w = bold.widthOfTextAtSize(label, 7);
    page.drawText(label, { x: align === "right" ? x - w : x, y, size: 7, font: bold, color: MUTED });
  };
  header("TICKETS", MARGIN);
  header("QTY", colQty + 40, "right");
  header("AMOUNT", colAmount, "right");

  y -= 8;
  page.drawLine({ start: { x: MARGIN, y }, end: { x: right, y }, thickness: 0.7, color: LINE });
  y -= 18;

  for (const t of first.tiers) {
    page.drawText(t.name, { x: MARGIN, y, size: 10, font: regular, color: INK, maxWidth: colQty - MARGIN - 50 });
    const qty = String(t.qty);
    page.drawText(qty, {
      x: colQty + 40 - regular.widthOfTextAtSize(qty, 10),
      y,
      size: 10,
      font: regular,
      color: INK,
    });
    const amount = lkr(t.price * t.qty);
    page.drawText(amount, {
      x: colAmount - regular.widthOfTextAtSize(amount, 10),
      y,
      size: 10,
      font: regular,
      color: INK,
    });
    // The unit price, quietly, because "2 × LKR 1,500" is the sum people check.
    page.drawText(`${lkr(t.price)} each`, { x: MARGIN, y: y - 12, size: 7.5, font: regular, color: MUTED });
    y -= 28;
  }

  y -= 4;
  page.drawLine({ start: { x: colQty - 20, y }, end: { x: right, y }, thickness: 0.7, color: LINE });
  y -= 20;

  const totalLabel = "TOTAL PAID";
  page.drawText(totalLabel, { x: colQty - 20, y, size: 8, font: bold, color: MUTED });
  const total = lkr(first.total);
  page.drawText(total, {
    x: colAmount - bold.widthOfTextAtSize(total, 16),
    y: y - 4,
    size: 16,
    font: bold,
    color: INK,
  });

  /* ---------- the tickets on this booking ---------- */
  y -= 48;
  page.drawText(
    tickets.length > 1
      ? `ADMISSION — ${tickets.length} TICKETS, ONE PERSON EACH`
      : "ADMISSION — ONE TICKET, ONE PERSON",
    { x: MARGIN, y, size: 7, font: bold, color: MUTED }
  );
  y -= 18;

  for (const t of tickets) {
    // A tinted bar per ticket, so four of them read as four things rather than
    // one paragraph of codes.
    page.drawRectangle({
      x: MARGIN,
      y: y - 5,
      width: PAGE.width - MARGIN * 2,
      height: 20,
      color: rgb(0.96, 0.97, 0.98),
    });
    page.drawText(`Ticket ${t.seq} of ${t.of}`, { x: MARGIN + 8, y: y + 1, size: 9, font: bold, color: INK });
    page.drawText(`Code ${t.token.slice(0, 10)}…`, {
      x: MARGIN + 110,
      y: y + 1,
      size: 8,
      font: regular,
      color: MUTED,
    });
    const status = t.admittedAt ? "Admitted" : "Valid";
    page.drawText(status, {
      x: right - 8 - bold.widthOfTextAtSize(status, 8),
      y: y + 1,
      size: 8,
      font: bold,
      color: t.admittedAt ? MUTED : INK,
    });
    y -= 26;
  }

  /* ---------- footer ---------- */
  const footerY = MARGIN + 46;
  page.drawLine({
    start: { x: MARGIN, y: footerY + 10 },
    end: { x: right, y: footerY + 10 },
    thickness: 0.7,
    color: LINE,
  });
  page.drawText(
    "This is a receipt for tickets bought at The Thomian Store. Each ticket above admits one person, once.",
    { x: MARGIN, y: footerY, size: 7.5, font: regular, color: MUTED, maxWidth: PAGE.width - MARGIN * 2 }
  );
  page.drawText(
    `Ticket links: ${ticketUrl(first.token, signTicket(first.token))}`,
    { x: MARGIN, y: footerY - 11, size: 6.5, font: regular, color: MUTED, maxWidth: PAGE.width - MARGIN * 2 }
  );

  return pdf.save();
}

/** The filename a browser will offer — "receipt-BM-ABC123.pdf". */
export function receiptFilename(reference: string): string {
  return `receipt-${reference.replace(/[^A-Za-z0-9-]/g, "")}.pdf`;
}
