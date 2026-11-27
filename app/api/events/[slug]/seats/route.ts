import { NextResponse } from "next/server";
import { hasDatabase } from "@/lib/db";
import { seatsForEvent } from "@/lib/stock";
import { errorMessage } from "@/lib/errors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/events/:slug/seats — how many seats each ticket type has left.
 *
 * The event page is cached for a minute, so the booking modal asks this before it
 * draws its steppers: a tier with two seats left must not offer eight. Public on
 * purpose — the numbers are already printed on the event page, and this is the
 * same information, a minute fresher.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  if (!hasDatabase()) {
    return NextResponse.json({ error: "No database." }, { status: 503 });
  }
  try {
    const tiers = await seatsForEvent(slug);
    return NextResponse.json(
      {
        event: slug,
        tiers: tiers.map((t) => ({
          id: t.id,
          name: t.name,
          price: t.price,
          capacity: t.capacity,
          sold: t.sold,
          left: t.left,
        })),
      },
      { headers: { "cache-control": "no-store" } }
    );
  } catch (err) {
    return NextResponse.json(
      { error: errorMessage(err) },
      { status: 500, headers: { "cache-control": "no-store" } }
    );
  }
}
