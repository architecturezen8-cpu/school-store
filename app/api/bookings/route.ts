import { NextResponse, after } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createBooking, ticketsForBooking } from "@/lib/bookings";
import { hasDatabase } from "@/lib/db";
import { sendTicketEmails } from "@/lib/tickets/email";
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
    // successful reservation into an error the customer sees, so delivery is
    // reported alongside it rather than blocking it.
    //
    // Delivery no longer holds the response open. It used to send every ticket
    // before replying, so a four-seat sale sat on "Reserving…" for seconds while
    // SMTP finished — and the customer had already paid. The customer now gets
    // their reference and their codes the moment the seats are booked, and the
    // single email for the sale is delivered in the background.
    const tickets = await ticketsForBooking(booking.reference);
    /**
     * What the buyer is told, and only what is true.
     *
     * `sent` used to be set from "a transport exists", which is a promise about
     * the future, not a delivery — and when the mail server then refused, the
     * screen had already said "Emailed to …". The send happens after this
     * response, so nothing is claimed as sent: the answer says whether one is on
     * its way (`queued`) and the mail log on /admin/mail/log holds the truth.
     */
    const transport = Boolean(process.env.RESEND_API_KEY || process.env.SMTP_HOST);
    const email: {
      sent: boolean;
      queued: boolean;
      reason?: string;
      tickets?: number;
    } = {
      sent: false,
      queued: transport,
      reason: transport ? "queued" : "not-configured",
      tickets: tickets.length,
    };

    /**
     * The seats just sold are visible on the event page straight away.
     *
     * That page is generated once a minute; a buyer who books the last three
     * seats would otherwise leave "3 left" up behind them for a minute. Done
     * after the response, like the mail, because it is nobody's emergency.
     */
    after(() => {
      try {
        revalidatePath("/events/[slug]", "page");
        revalidatePath("/tickets");
      } catch (err) {
        console.error("[api/bookings] could not refresh the event page:", errorMessage(err));
      }
    });

    if (tickets.length && transport) {
      // `after()` runs once the response is on the wire. If it fails or is not
      // available, the admin's "Resend" on the booking is the fallback, so this
      // is never the only copy.
      after(async () => {
        try {
          const result = await sendTicketEmails(tickets);
          if (!result.sent) {
            console.error(
              "[api/bookings] ticket email:",
              result.reason,
              result.error ?? ""
            );
          }
        } catch (err) {
          console.error("[api/bookings] ticket email failed:", errorMessage(err));
        }
      });
    }

    // The signature is what makes the confirmation screen's QR the same ticket
    // that was emailed, so the customer can be admitted from either.
    // Every ticket gets its signature, so the confirmation screen can show all
    // of the QRs — the same codes that were emailed — rather than one and a
    // promise. `token`/`signature` at the top stay for anything reading a single
    // ticket from this response.
    return NextResponse.json(
      {
        booking: {
          ...booking,
          signature: signTicket(booking.token),
          tickets: booking.tickets.map((t) => ({
            ...t,
            signature: signTicket(t.token),
          })),
        },
        email,
      },
      { status: 201 }
    );
  } catch (err) {
    const message = errorMessage(err);
    // "Only 3 left — please reduce the quantity" is a refusal, not a fault: the
    // browser shows a 409's message as-is, where a 500 reads as "the shop broke".
    const status = /sold out|only \d+|Unknown/i.test(message) ? 409 : 500;
    console.error("[api/bookings] failed:", message);
    return NextResponse.json({ error: message }, { status });
  }
}
