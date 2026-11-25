import { NextResponse } from "next/server";
import { readFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { isAdmin } from "@/lib/admin/auth";
import { listBookings, getTicketByToken, ticketsForBooking } from "@/lib/bookings";
import { databaseDown } from "@/lib/db";
import { buildBookingMail, sampleTicket } from "@/lib/tickets/email";
import { listAllEvents } from "@/lib/events";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /admin/mail/preview[?reference=BM-ABC123]
 *
 * The email, rendered by the same function that sends it.
 *
 * The admin preview used to be a hand-built mock-up that drifted from the real
 * message the moment either changed. This returns `buildBookingMail().html`
 * instead, with one substitution: every inline code (`cid:ticket-qr-N`) becomes
 * a `data:` URI, because `<img src="cid:…">` renders as nothing outside a mail
 * client — which is exactly why the preview arrived with empty images.
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

  // The whole sale, not one seat: the message the customer receives carries every
  // code, so a preview showing a single one would be a preview of a different
  // email.
  const sale = full
    ? await ticketsForBooking(full.reference).catch(() => [])
    : [];
  const mail = await buildBookingMail(sale.length ? sale : [preview]);

  // Every code in the message is inline (`cid:ticket-qr-N`), which renders as
  // nothing outside a mail client. Swap each one for the same PNG as a data:
  // URI, taken from the buffer that was actually attached, so the frame shows
  // the real codes and never a broken-image icon.
  const dataUris = new Map<string, string>(
    mail.codes.map((c) => [c.cid, `data:image/png;base64,${c.buffer.toString("base64")}`])
  );
  if (mail.logo) {
    dataUris.set("brand-logo", `data:image/png;base64,${mail.logo.toString("base64")}`);
  }

  let html = mail.html.replace(/src="cid:([^"]+)"/g, (whole, cid: string) => {
    const uri = dataUris.get(cid);
    return uri ? `src="${uri}"` : whole;
  });

  // The hero wash uses the event photograph as a CSS background, and the photo
  // lives at an absolute URL. In an inbox that is fine; in this frame it is a
  // request the preview cannot make, so the wash would show as flat navy and the
  // admin would think the design was not applied. Rewrite it to the artwork the
  // preview already has in hand.
  const heroSrc = await heroPreviewDataUri(preview.event);
  if (heroSrc) {
    html = html.replace(
      /background-image:url\('[^']*'\)/g,
      `background-image:url('${heroSrc}')`
    );
  }

  // The attached ticket is not part of the HTML — a mail client shows it as a
  // file under the message. The frame has no such area, so append the same PNG
  // at the end, labelled, which is what the admin needs to check: that the design
  // arrived with the code in it.
  if (mail.artwork) {
    const dataUri = `data:image/png;base64,${mail.artwork.toString("base64")}`;
    html = html.replace(
      "</table>\n</body>",
      `</table>
       <div style="max-width:600px;margin:0 auto;padding:18px 12px 0">
         <div style="color:#8b9ab5;font-size:10px;letter-spacing:3px;text-transform:uppercase;padding-bottom:10px;text-align:center">Also attached as a file</div>
         <img src="${dataUri}" alt="The attached ticket" style="display:block;width:100%;height:auto;border:1px solid #1d2740">
       </div>
      </body>`
    );
  }

  html = html
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

/**
 * The event's hero photograph as a `data:` URI, for the preview frame.
 *
 * Read from disk rather than fetched: the stored value is a public path, and a
 * round trip to our own server to render a picture we can open directly is the
 * kind of thing that works on a laptop and falls over in a container with no
 * outbound network.
 */
async function heroPreviewDataUri(eventSlug: string): Promise<string> {
  try {
    const events = await listAllEvents();
    const event = events.find((e) => e.slug === eventSlug);
    const src = event?.heroImage || event?.image || "";
    if (!src) return "";
    if (/^https?:\/\//i.test(src)) return src;

    const raw = await readFile(path.join(process.cwd(), "public", src.replace(/^\//, "")));
    const small = await sharp(raw)
      .resize({ width: 900, withoutEnlargement: true })
      .jpeg({ quality: 70 })
      .toBuffer();
    return `data:image/jpeg;base64,${small.toString("base64")}`;
  } catch {
    return "";
  }
}
