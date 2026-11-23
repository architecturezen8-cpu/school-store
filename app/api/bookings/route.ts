import { NextResponse } from "next/server";
import { z } from "zod";
import { createBooking } from "@/lib/bookings";
import { hasDatabase } from "@/lib/db";

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
    return NextResponse.json({ booking }, { status: 201 });
  } catch (err) {
    const message = (err as Error).message;
    const status = /sold out|Unknown/i.test(message) ? 409 : 500;
    console.error("[api/bookings] failed:", message);
    return NextResponse.json({ error: message }, { status });
  }
}
