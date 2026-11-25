import { ticketsForBooking } from "@/lib/bookings";
import { verifyTicketSignature } from "@/lib/tickets/sign";
import { buildTicketReceipt, receiptFilename } from "@/lib/tickets/receipt";
import { getSettings } from "@/lib/settings";
import { safeDecode } from "@/lib/safe-decode";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/tickets/<token>/receipt?s=<signature>
 *
 * The receipt for the whole booking, as a PDF. Keyed by one ticket's token
 * because that is what the customer has — the QR in their hand — but the document
 * covers every ticket on the sale, which is what a receipt is: proof of what was
 * paid, not proof of one seat.
 *
 * Signed like the ticket image, so a token alone is not enough to download
 * somebody else's receipt.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const signature = new URL(_req.url).searchParams.get("s") ?? "";
  const decoded = safeDecode(token);

  if (!signature || !verifyTicketSignature(decoded, signature)) {
    return NextResponse.json({ error: "Invalid ticket signature." }, { status: 403 });
  }

  // The token identifies one ticket; its reference finds the whole booking.
  const { getTicketByToken } = await import("@/lib/bookings");
  const one = await getTicketByToken(decoded);
  if (!one) return NextResponse.json({ error: "Ticket not found." }, { status: 404 });

  const tickets = await ticketsForBooking(one.reference);
  if (!tickets.length) {
    return NextResponse.json({ error: "Nothing to receipt." }, { status: 404 });
  }

  const { logo } = await getSettings();
  const pdf = await buildTicketReceipt(tickets, { logoFile: logo || undefined });

  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "content-type": "application/pdf",
      "content-length": String(pdf.length),
      // A receipt is a keepsake; letting it be cached is fine and makes the
      // button feel instant the second time. Private, because it names a buyer.
      "cache-control": "private, max-age=300",
      "content-disposition": `attachment; filename="${receiptFilename(one.reference)}"`,
    },
  });
}
