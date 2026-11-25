import { NextResponse } from "next/server";
import { z } from "zod";
import { createBooking, getTicketByToken } from "@/lib/bookings";
import { hasDatabase } from "@/lib/db";
import { sendTicketEmail } from "@/lib/tickets/email";
import { signTicket } from "@/lib/tickets/sign";
import { errorMessage } from "@/lib/errors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z.object({
  event: z.string().min(1).max(120),
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(200),
  phone: z.string().trim().max(40).optional().default(""),
  tiers: z
    .array(z.object({ id: z.string().min(1), qty: z.number().int().min(1).max(8) }))
    .min(1)
    .max(10),
});

/** POST /api/bookings — reserve event tickets. */
export async function POST(req: Request) {
  if (!hasDatabase()) {
    return NextResponse.json(
      { error: "Ticket bookings need the store database (not configured)." },
      { status: 503 }
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Please check the booking details." }, { status: 400 });
  }

  try {
    const booking = await createBooking(parsed.data);

    // The booking is committed at this point: a mail problem must never turn a
    // successful reservation into an error the customer sees, so the delivery
    // result is reported alongside it instead.
    let email: { sent: boolean; reason?: string } = { sent: false, reason: "failed" };
    try {
      const ticket = await getTicketByToken(booking.token);
      if (ticket) {
        const result = await sendTicketEmail(ticket);
        email = result.sent
          ? { sent: true }
          : { sent: false, reason: result.reason };
      }
    } catch (err) {
      console.error("[api/bookings] ticket email failed:", errorMessage(err));
      email = { sent: false, reason: "failed" };
    }

    // The signature is what makes the confirmation screen's QR the same ticket
    // that was emailed, so the customer can be admitted from either.
    return NextResponse.json(
      { booking: { ...booking, signature: signTicket(booking.token) }, email },
      { status: 201 }
    );
  } catch (err) {
    const message = errorMessage(err);
    const status = /sold out|Unknown/i.test(message) ? 409 : 500;
    console.error("[api/bookings] failed:", message);
    return NextResponse.json({ error: message }, { status });
  }
}
