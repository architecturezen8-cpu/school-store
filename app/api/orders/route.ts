import { NextResponse } from "next/server";
import { z } from "zod";
import { createOrder, createOrderSchema } from "@/lib/orders";
import { hasDatabase } from "@/lib/db";
import { errorMessage } from "@/lib/errors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** POST /api/orders — place an order. Prices are resolved server-side. */
export async function POST(req: Request) {
  if (!hasDatabase()) {
    return NextResponse.json(
      { error: "The store database is not configured yet, so orders cannot be placed." },
      { status: 503 }
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const parsed = createOrderSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Please check the form.", issues: z.treeifyError(parsed.error) },
      { status: 400 }
    );
  }

  try {
    const order = await createOrder(parsed.data);
    return NextResponse.json({ order }, { status: 201 });
  } catch (err) {
    const message = errorMessage(err);
    const status = /Unknown product/.test(message) ? 400 : 500;
    console.error("[api/orders] failed:", message);
    return NextResponse.json({ error: message }, { status });
  }
}
