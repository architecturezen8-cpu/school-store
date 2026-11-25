import { NextResponse } from "next/server";
import { z } from "zod";
import { admitTicket, findTicketForGate, reopenTicket } from "@/lib/bookings";
import { hasDatabase } from "@/lib/db";
import { isAdmin } from "@/lib/admin/auth";
import { parseTicketPayload, verifyTicketSignature } from "@/lib/tickets/sign";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * The gate.
 *
 *   POST /api/gate   { scan: "<what the QR held>", by: "Gate 2" }
 *   POST /api/gate   { token, reopen: true }   to undo a mis-scan
 *
 * Staff-only. A scan is admitted once; the second scan reports "already" with
 * the original time so the volunteer at the turnstile can see the difference
 * between an honest re-scan and a shared ticket.
 */

const bodySchema = z.union([
  z.object({
    scan: z.string().min(1).max(2000),
    by: z.string().trim().max(80).optional().default(""),
    reopen: z.literal(false).optional(),
  }),
  z.object({
    token: z.string().min(1).max(200),
    reopen: z.literal(true),
  }),
]);

export async function POST(req: Request) {
  if (!hasDatabase()) {
    return NextResponse.json({ error: "No database configured." }, { status: 503 });
  }
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Sign in as admin to scan at the gate." }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Bad request." }, { status: 400 });
  }

  /* ---------- undo ---------- */
  if ("reopen" in parsed.data && parsed.data.reopen) {
    const done = await reopenTicket(parsed.data.token);
    return NextResponse.json(
      done ? { status: "reopened" } : { error: "Ticket not found." },
      { status: done ? 200 : 404 }
    );
  }

  /* ---------- a scan ---------- */
  const input = parsed.data as { scan: string; by: string };
  const extracted = parseTicketPayload(input.scan);

  if (!extracted) {
    return NextResponse.json({ status: "invalid", message: "That is not a ticket QR code." });
  }

  const { token, signature } = extracted;

  // A signature that is present but wrong means the QR was forged or edited.
  // Nothing was found by hand here — this is a scan, so refuse before the
  // database is touched.
  if (signature && !verifyTicketSignature(token, signature)) {
    return NextResponse.json({
      status: "invalid",
      message: "This ticket is not genuine — the signature does not match.",
    });
  }

  // Without a signature this is staff typing a reference or token off a card,
  // which is allowed because only a signed-in admin can reach this endpoint.
  // Either way the ticket has to exist in the database.
  const ticket = await findTicketForGate(token);
  if (!ticket) {
    return NextResponse.json({ status: "invalid", message: "Ticket not found." });
  }

  const result = await admitTicket(ticket.token, input.by || "Gate");

  return NextResponse.json({
    status: result.status,
    ticket:
      "ticket" in result
        ? {
            token: result.ticket.token,
            reference: result.ticket.reference,
            name: result.ticket.name,
            event: result.ticket.eventTitle,
            eventDate: result.ticket.eventDate,
            venue: result.ticket.venue,
            city: result.ticket.city,
            seats: result.ticket.tiers.reduce((n, t) => n + t.qty, 0),
            tiers: result.ticket.tiers.map((t) => `${t.name} × ${t.qty}`),
            admittedAt: result.ticket.admittedAt,
            admittedBy: result.ticket.admittedBy,
            // Which person this is. The gate needs it in both directions: a
            // fresh "admitted" on ticket 2 of 4 is not a duplicate, and an
            // "already" on ticket 2 of 4 is one specific person who has been in.
            seq: result.ticket.seq,
            of: result.ticket.of,
            // This ticket's own reference. The sale's reference is shared by the
            // whole party, so it cannot say *which* code the door is looking at —
            // which is the one thing the volunteer has to write down when a
            // blocked ticket turns up.
            code: result.ticket.code,
            tierName: result.ticket.tierName,
          }
        : null,
  });
}
