import { NextResponse } from "next/server";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { getTicketByToken } from "@/lib/bookings";
import { getTemplateForEvent } from "@/lib/tickets/templates";
import { composeTicket, detectWhiteSquare } from "@/lib/tickets/detect";
import { fallbackTicketSvg } from "@/lib/tickets/fallback";
import { qrPayload, verifyTicketSignature } from "@/lib/tickets/sign";
import { safeDecode } from "@/lib/safe-decode";

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

  if (!signature || !verifyTicketSignature(safeDecode(token), signature)) {
    return NextResponse.json({ error: "Invalid ticket signature." }, { status: 403 });
  }

  const ticket = await getTicketByToken(safeDecode(token));
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
