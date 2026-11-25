import { NextResponse } from "next/server";
import { trackOrder, orderTimeline } from "@/lib/orders";
import { hasDatabase } from "@/lib/db";
import { errorMessage } from "@/lib/errors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/orders/STC-01042?email=you@example.com
 * Both the reference *and* the email are required — a reference alone must not
 * expose somebody else's order.
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ reference: string }> }
) {
  if (!hasDatabase()) {
    return NextResponse.json(
      { error: "Order tracking needs the store database (not configured)." },
      { status: 503 }
    );
  }

  const { reference } = await params;
  const email = new URL(req.url).searchParams.get("email") ?? "";
  if (!reference || !email.includes("@")) {
    return NextResponse.json({ error: "Order ID and email are both required." }, { status: 400 });
  }

  try {
    const order = await trackOrder(reference, email);
    if (!order) return NextResponse.json({ error: "No order matches that ID and email." }, { status: 404 });

    const timeline = await orderTimeline(order.reference);
    return NextResponse.json({ order: { ...order, timeline } });
  } catch (err) {
    console.error("[api/orders/:ref] failed:", errorMessage(err));
    return NextResponse.json({ error: "Could not look up that order." }, { status: 500 });
  }
}
