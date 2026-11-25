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
 *   · one line per ticket type with quantity and amount
 *   · how many tickets were bought, then the total paid
 *   · a footer that says what the document is and where it came from
 *
 * The receipt deliberately has no list of codes. A code per head belongs on the
 * ticket the person carries; on the proof of payment it is sixteen lines of
 * noise that push the total onto a page of its own.
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
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const serif = await pdf.embedFont(StandardFonts.TimesRoman);

  // A receipt is one page. It used to flow because it listed every seat; with
  // the count and the total instead, there is nothing here that can run off the
  // paper, so the page is fixed and a stray second page cannot appear.
  const page = pdf.addPage([PAGE.width, PAGE.height]);

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
  header("ITEMS", MARGIN);
  header("QTY", colQty + 40, "right");
  header("AMOUNT", colAmount, "right");

  y -= 8;
  page.drawLine({ start: { x: MARGIN, y }, end: { x: right, y }, thickness: 0.7, color: LINE });
  y -= 18;

  // The items are the tiers the sale was made from. If a booking somehow carries
  // none — an event whose tiers were rebuilt after the sale — the bill still has
  // to show what was bought, so it falls back to one line for the whole sale
  // rather than a table with a header and no rows.
  const items = first.tiers.length
    ? first.tiers
    : [
        {
          name: "Tickets",
          price: Math.round(first.total / Math.max(1, tickets.length)),
          qty: tickets.length,
        },
      ];

  for (const t of items) {
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
    y -= 26;
  }

  /* ---------- how many tickets, then the total ---------- */
  // The order the buyer asked for, twice: the items first, then how many
  // tickets were bought and what they paid — under the items, not above them,
  // and not as a page of one-line-per-seat rows.
  //
  // A per-seat list used to sit here (16 rows of "Ticket 4 of 16 · Code …").
  // It was the wrong document: this is proof of payment, the school's books do
  // not need a code per head, and sixteen rows pushed the whole thing onto a
  // second page where the thing the bursar looks for — the total — was on page
  // one and the tail was on page two. The count is what matters here; the codes
  // live on the tickets themselves.
  const totalQty = items.reduce((n, t) => n + t.qty, 0);

  y -= 2;
  page.drawLine({ start: { x: MARGIN, y }, end: { x: right, y }, thickness: 0.7, color: LINE });
  y -= 20;

  // How many tickets, right-aligned with the money so the block reads as one
  // column of figures rather than a label stranded in the middle of the page.
  page.drawText("TICKETS", { x: MARGIN, y, size: 8, font: bold, color: MUTED });
  const qtyLabel = String(totalQty);
  page.drawText(qtyLabel, {
    x: colAmount - bold.widthOfTextAtSize(qtyLabel, 12),
    y: y - 2,
    size: 12,
    font: bold,
    color: INK,
  });
  page.drawText(
    totalQty === 1 ? "one person, admitted once" : "one person each, admitted once",
    { x: MARGIN, y: y - 12, size: 7.5, font: regular, color: MUTED }
  );

  y -= 30;
  page.drawLine({ start: { x: MARGIN, y }, end: { x: right, y }, thickness: 0.7, color: LINE });
  y -= 22;

  const totalLabel = "TOTAL PAID";
  page.drawText(totalLabel, { x: MARGIN, y, size: 8, font: bold, color: MUTED });
  const total = lkr(first.total);
  page.drawText(total, {
    x: colAmount - bold.widthOfTextAtSize(total, 16),
    y: y - 4,
    size: 16,
    font: bold,
    color: INK,
  });

  /* ---------- footer ---------- */
  const footerY = MARGIN + 46;
  page.drawLine({
    start: { x: MARGIN, y: footerY + 10 },
    end: { x: right, y: footerY + 10 },
    thickness: 0.7,
    color: LINE,
  });
  page.drawText(
    "This is a receipt for tickets bought at The Thomian Store. Every ticket in this booking admits one person, once.",
    { x: MARGIN, y: footerY, size: 7.5, font: regular, color: MUTED, maxWidth: PAGE.width - MARGIN * 2 }
  );
  page.drawText(
    `Ticket links: ${ticketUrl(first.token, signTicket(first.token))}`,
    { x: MARGIN, y: footerY - 11, size: 6.5, font: regular, color: MUTED, maxWidth: PAGE.width - MARGIN * 2 }
  );

  /* ---------- page numbers ---------- */
  // Only when there is more than one page: "Page 1 of 1" on a one-page receipt
  // is noise.
  const pages = pdf.getPages();
  if (pages.length > 1) {
    pages.forEach((p, i) => {
      const label = `Page ${i + 1} of ${pages.length}`;
      p.drawText(label, {
        x: PAGE.width - MARGIN - regular.widthOfTextAtSize(label, 7),
        y: MARGIN + 14,
        size: 7,
        font: regular,
        color: MUTED,
      });
      // A hairline so the folio reads as a folio, not as stray text.
      p.drawLine({
        start: { x: MARGIN, y: MARGIN + 26 },
        end: { x: PAGE.width - MARGIN, y: MARGIN + 26 },
        thickness: 0.5,
        color: LINE,
      });
      // The reference on every page, so a page that gets separated still says
      // which receipt it belongs to.
      p.drawText(`Receipt ${first.reference}`, {
        x: MARGIN,
        y: MARGIN + 14,
        size: 7,
        font: regular,
        color: MUTED,
      });
    });
  }

  return pdf.save();
}

/** The filename a browser will offer — "receipt-BM-ABC123.pdf". */
export function receiptFilename(reference: string): string {
  return `receipt-${reference.replace(/[^A-Za-z0-9-]/g, "")}.pdf`;
}
