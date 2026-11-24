import { NextResponse } from "next/server";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { getTicketByToken } from "@/lib/bookings";
import { getTemplateForEvent } from "@/lib/tickets/templates";
import { composeTicket, detectWhiteSquare } from "@/lib/tickets/detect";
import { qrPayload, verifyTicketSignature } from "@/lib/tickets/sign";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/tickets/<token>/image?s=<signature>
 *
 * Renders this booking's ticket: the admin's uploaded design with the booking's
 * QR pasted into the white square. The email embeds this URL, and the ticket
 * page shows it, so artwork changes apply to tickets already sold.
 *
 * Unsigned requests are refused — the signature is what stops someone walking
 * the token space to harvest other people's tickets.
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const signature = new URL(req.url).searchParams.get("s") ?? "";

  if (!signature || !verifyTicketSignature(decodeURIComponent(token), signature)) {
    return NextResponse.json({ error: "Invalid ticket signature." }, { status: 403 });
  }

  const ticket = await getTicketByToken(decodeURIComponent(token));
  if (!ticket) {
    return NextResponse.json({ error: "Ticket not found." }, { status: 404 });
  }

  const template = await getTemplateForEvent(ticket.event);

  // No artwork uploaded yet: fall back to a plain generated ticket so the
  // customer still receives something scannable.
  if (!template) {
    // Same white square as the artwork path, so the QR still gets pasted in
    // rather than a ticket being emailed without a scannable code.
    const design = Buffer.from(fallbackTicketSvg(ticket));
    const square = await detectWhiteSquare(design);
    if (!square) {
      return NextResponse.json({ error: "Could not build a ticket image." }, { status: 500 });
    }
    const { image } = await composeTicket({
      design,
      qrPayload: qrPayload(ticket.token, signature),
      square,
    });
    return new NextResponse(new Uint8Array(image), {
      headers: {
        "content-type": "image/png",
        "content-length": String(image.length),
        "cache-control": "private, max-age=60",
      },
    });
  }

  const file = path.join(
    process.cwd(),
    "public",
    template.file.replace(/^\//, "")
  );

  let design: Buffer;
  try {
    design = await readFile(file);
  } catch {
    return NextResponse.json(
      { error: "The ticket design file is missing. Re-upload it from the admin panel." },
      { status: 500 }
    );
  }

  // Prefer the square recorded at upload time, but re-detect if the file was
  // replaced: the recorded coordinates would be wrong and the QR would land in
  // the middle of the artwork.
  let square = {
    x: template.qrX,
    y: template.qrY,
    size: template.qrSize,
    confidence: 1,
  };

  if (template.width === 0 || template.height === 0) {
    const found = await detectWhiteSquare(design);
    if (!found) {
      return NextResponse.json(
        { error: "No white square found in the ticket design." },
        { status: 500 }
      );
    }
    square = found;
  }

  const { image } = await composeTicket({
    design,
    qrPayload: qrPayload(ticket.token, signature),
    square,
    format: template.file.endsWith(".png") ? "png" : "jpeg",
  });

  return new NextResponse(new Uint8Array(image), {
    headers: {
      "content-type": template.file.endsWith(".png") ? "image/png" : "image/jpeg",
      "content-length": String(image.length),
      // A customer's ticket should not be cached by a shared proxy; it is a
      // bearer document while the signature is in the URL.
      "cache-control": "private, max-age=300",
    },
  });
}

/** A simple ticket when no design has been uploaded yet. */
function fallbackTicketSvg(ticket: {
  reference: string;
  name: string;
  eventTitle: string;
  eventDate: string;
  venue: string;
  city: string;
}): string {
  const esc = (s: string) =>
    s.replace(/[&<>"']/g, (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!
    );
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="640" viewBox="0 0 1200 640">
  <rect width="1200" height="640" fill="#0a1224"/>
  <rect y="0" width="1200" height="8" fill="#ffd444"/>
  <text x="60" y="120" fill="#ffd444" font-size="54" font-family="sans-serif" font-weight="bold">${esc(ticket.eventTitle)}</text>
  <text x="60" y="176" fill="#ffffff" font-size="26" font-family="sans-serif">${esc(ticket.venue)}, ${esc(ticket.city)}</text>
  <text x="60" y="220" fill="#7c8db5" font-size="22" font-family="sans-serif">${esc(new Date(ticket.eventDate).toDateString())}</text>
  <text x="60" y="420" fill="#ffffff" font-size="38" font-family="sans-serif">${esc(ticket.name)}</text>
  <text x="60" y="580" fill="#ffd444" font-size="28" font-family="sans-serif">${esc(ticket.reference)}</text>
  <rect x="820" y="340" width="300" height="300" fill="#ffffff"/>
</svg>`;
}
