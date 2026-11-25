import { NextResponse } from "next/server";
import QRCode from "qrcode";
import { isAdmin } from "@/lib/admin/auth";
import { listBookings, getTicketByToken } from "@/lib/bookings";
import { databaseDown } from "@/lib/db";
import { buildTicketMail, sampleTicket } from "@/lib/tickets/email";
import { ticketUrl, signTicket } from "@/lib/tickets/sign";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /admin/mail/preview[?reference=BM-ABC123]
 *
 * The email, rendered by the same function that sends it.
 *
 * The admin preview used to be a hand-built mock-up that drifted from the real
 * message the moment either changed. This returns `buildTicketMail().html`
 * instead, with one substitution: the inline QR (`cid:ticket-qr`) becomes the
 * public artwork URL, because a `<img src="cid:…">` renders as nothing outside
 * a mail client.
 *
 * The response is the document itself, not a file — the frame in
 * /admin/mail just points at this URL, so "refresh" means "refresh the mail".
 */
export async function GET(req: Request) {
  // A frame with no ticket behind it is not a server error: 404 is what a
  // browser understands, and what keeps "the document is missing" distinct from
  // "the server broke".
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Sign in first." }, { status: 404 });
  }

  const reference = new URL(req.url).searchParams.get("reference") ?? "";

  // A frame that 500s shows the admin a broken image and says nothing; a frame
  // that explains itself is the whole point of a preview.
  const ticket = databaseDown()
    ? null
    : reference
      ? (await listBookings(500).catch(() => [])).find(
          (b) => b.reference === reference.trim().toUpperCase()
        )
      : (await listBookings(1).catch(() => []))[0];

  const full = ticket ? await getTicketByToken(ticket.token) : null;
  // No sale yet: preview a sample rather than an empty frame, so the first thing
  // an admin does on a fresh store still shows them the real message. A database
  // that is down is a different matter and is reported as such.
  const preview = full ?? (databaseDown() ? null : await sampleTicket());
  if (!preview) {
    return new NextResponse(
      `<!doctype html><meta charset="utf-8"><body style="margin:0;display:grid;place-items:center;min-height:100vh;background:#04060d;color:#8b9ab5;font:14px Arial,sans-serif">
         <p>No booking to preview — the database is not answering, so there is nothing to read.</p>
       </body>`,
      { headers: { "content-type": "text/html; charset=utf-8" } }
    );
  }

  const mail = await buildTicketMail(preview);
  // Drawn here rather than fetched from /api/tickets/<token>/qr: that route
  // looks the ticket up in the database, which is right for a real booking and
  // impossible for a sample. A data: URI is the same image either way, needs no
  // round trip, and cannot arrive in the frame as a broken 404.
  const signature = signTicket(preview.token);
  const qrPng = await QRCode.toBuffer(ticketUrl(preview.token, signature), {
    type: "png",
    width: 600,
    margin: 2,
    errorCorrectionLevel: "H",
    color: { dark: "#000000", light: "#ffffff" },
  });
  const qrUrl = `data:image/png;base64,${qrPng.toString("base64")}`;

  /**
   * The ticket artwork, handled from the buffer that is actually attached.
   *
   * The mail points this <img> at /api/tickets/<token>/image, which looks the
   * booking up in the database. That is right for a customer's mail and wrong
   * here twice over: a sample has no booking row (so the route 404s and the frame
   * shows a broken-image icon), and a real booking costs an extra round trip to
   * the server to render a picture we already have in hand.
   *
   * `mail.artwork` is that picture — the exact PNG attached to the message. So:
   * inline it when it exists, and remove the row entirely when it does not, so
   * the preview never shows a gap.
   */
  const artworkTag =
    /<tr><td align="center" style="background:#0a1224;padding:26px 24px 0">\s*<img src="[^"]*" alt="Your ticket"[\s\S]*?<\/td><\/tr>/;
  // The mail itself has no <title> or <main> (mail clients do not use either),
  // so the standalone document gets them — it is a page here, and a page
  // without a title is an accessibility failure.
  const artworkData = mail.artwork
    ? `data:image/png;base64,${mail.artwork.toString("base64")}`
    : "";

  const html = mail.html
    .replace(/src="cid:ticket-qr"/g, `src="${qrUrl}"`)
    .replace(artworkTag, (block) =>
      artworkData ? block.replace(/src="[^"]*"/, `src="${artworkData}"`) : ""
    )
    .replace(
      "<html lang=\"en\">",
      `<html lang="en"><head><meta charset="utf-8"><title>Ticket email · ${preview.reference}</title></head>`
    )
    // The mail is a table in a <body>; the page wraps it in <main> so the
    // document has one top-level landmark, without touching the message.
    .replace("<body", "<body")
    .replace(
      '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#04060d;padding:28px 12px">',
      '<main><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#04060d;padding:28px 12px">'
    )
    .replace("</table>\n</body>", "</table></main>\n</body>");

  return new NextResponse(html, {
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store",
      "x-robots-tag": "noindex",
    },
  });
}
