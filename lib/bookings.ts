import { z } from "zod";
import { transaction } from "./db";

/* ------------------------------------------------------------------ *
 *  Ticket bookings — the seat count and the price are decided here,
 *  never by the browser.
 * ------------------------------------------------------------------ */

export const bookingSchema = z.object({
  event: z.string().min(1).max(120),
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(200),
  phone: z.string().trim().max(40).optional().default(""),
  tiers: z
    .array(z.object({ id: z.string().min(1), qty: z.number().int().min(1).max(8) }))
    .min(1)
    .max(10),
});

export type BookingInput = z.infer<typeof bookingSchema>;

export type Booking = {
  reference: string;
  event: string;
  total: number;
  tiers: { id: string; name: string; price: number; qty: number }[];
};

const MAX_PER_TIER = 8;

function reference() {
  const stamp = Date.now().toString(36).toUpperCase().slice(-6);
  const rand = Math.random().toString(36).toUpperCase().slice(2, 5);
  return `BM-${stamp}${rand}`;
}

export async function createBooking(input: BookingInput): Promise<Booking> {
  const parsed = bookingSchema.parse(input);

  return transaction(async (c) => {
    const ids = parsed.tiers.map((t) => t.id);
    const { rows: tiers } = await c.query<{
      id: string;
      event: string;
      name: string;
      price: number;
      capacity: number | null;
      sold: number;
    }>(
      `select id, event, name, price, capacity, sold
         from ticket_tiers
        where id = any($1) and event = $2
        for update`,
      [ids, parsed.event]
    );

    if (tiers.length !== ids.length) throw new Error("Unknown ticket tier for this event.");

    let total = 0;
    for (const wanted of parsed.tiers) {
      const tier = tiers.find((t) => t.id === wanted.id)!;
      const remaining = tier.capacity === null ? Infinity : tier.capacity - tier.sold;
      if (wanted.qty > remaining) {
        throw new Error(`${tier.name} is sold out for that quantity.`);
      }
      total += Number(tier.price) * wanted.qty;
    }

    const ref = reference();
    const { rows } = await c.query<{ id: string }>(
      `insert into bookings (reference, event, name, email, phone, total)
       values ($1, $2, $3, $4, $5, $6) returning id`,
      [ref, parsed.event, parsed.name, parsed.email, parsed.phone, total]
    );

    for (const wanted of parsed.tiers) {
      await c.query("insert into booking_items (booking, tier, qty) values ($1, $2, $3)", [
        rows[0].id,
        wanted.id,
        Math.min(wanted.qty, MAX_PER_TIER),
      ]);
      await c.query("update ticket_tiers set sold = sold + $2 where id = $1", [
        wanted.id,
        Math.min(wanted.qty, MAX_PER_TIER),
      ]);
    }

    return {
      reference: ref,
      event: parsed.event,
      total,
      tiers: parsed.tiers.map((w) => {
        const t = tiers.find((x) => x.id === w.id)!;
        return { id: t.id, name: t.name, price: Number(t.price), qty: w.qty };
      }),
    };
  });
}
