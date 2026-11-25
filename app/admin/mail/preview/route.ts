import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin/auth";
import { listBookings, getTicketByToken } from "@/lib/bookings";
import { databaseDown } from "@/lib/db";
import { buildTicketMail } from "@/lib/tickets/email";
import { signTicket } from "@/lib/tickets/sign";

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
  if (!full) {
    return new NextResponse(
      `<!doctype html><meta charset="utf-8"><body style="margin:0;display:grid;place-items:center;min-height:100vh;background:#04060d;color:#8b9ab5;font:14px Arial,sans-serif">
         <p>No booking to preview — ${
           databaseDown()
             ? "the database is not answering, so there is nothing to read."
             : "sell one ticket and this fills in."
         }</p>
       </body>`,
      { headers: { "content-type": "text/html; charset=utf-8" } }
    );
  }

  const mail = await buildTicketMail(full);
  const qrUrl = `${new URL(req.url).origin}/api/tickets/${encodeURIComponent(
    full.token
  )}/qr?s=${encodeURIComponent(signTicket(full.token))}`;
  // The mail itself has no <title> or <main> (mail clients do not use either),
  // so the standalone document gets them — it is a page here, and a page
  // without a title is an accessibility failure.
  const html = mail.html
    .replace(/src="cid:ticket-qr"/g, `src="${qrUrl}"`)
    .replace(
      "<html lang=\"en\">",
      `<html lang="en"><head><meta charset="utf-8"><title>Ticket email · ${full.reference}</title></head>`
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
