import { NextResponse } from "next/server";
import QRCode from "qrcode";
import { getTicketByToken } from "@/lib/bookings";
import { ticketUrl, verifyTicketSignature } from "@/lib/tickets/sign";
import { safeDecode } from "@/lib/safe-decode";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/tickets/<token>/qr?s=<signature>
 *
 * The booking's QR code on its own, drawn from the same URL that is printed on
 * the artwork — so the code the customer sees in the mail and the code pasted
 * into the admin's design are byte-for-byte the same ticket.
 *
 * The email carries this image inline (`cid:ticket-qr`); the admin's preview
 * points at this URL instead, because a `cid:` reference means nothing in a
 * browser.
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

  const png = await QRCode.toBuffer(ticketUrl(ticket.token, signature), {
    type: "png",
    width: 600,
    margin: 2,
    errorCorrectionLevel: "H",
    color: { dark: "#000000", light: "#ffffff" },
  });

  return new NextResponse(new Uint8Array(png), {
    headers: {
      "content-type": "image/png",
      "content-length": String(png.length),
      "cache-control": "private, max-age=300",
    },
  });
}
