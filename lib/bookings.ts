import { randomBytes } from "node:crypto";
import { z } from "zod";
import { query, transaction } from "./db";

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
  /** Opaque secret inside the QR; the reference alone is not enough to admit. */
  token: string;
};

/** One admission ticket, as the ticket page and the gate scanner see it. */
export type Ticket = {
  reference: string;
  token: string;
  event: string;
  eventTitle: string;
  eventDate: string;
  venue: string;
  city: string;
  doors: string;
  image: string;
  name: string;
  email: string;
  total: number;
  tiers: { id: string; name: string; price: number; qty: number }[];
  admittedAt: string | null;
  admittedBy: string;
};

const MAX_PER_TIER = 8;

function reference() {
  const stamp = Date.now().toString(36).toUpperCase().slice(-6);
  const rand = Math.random().toString(36).toUpperCase().slice(2, 5);
  return `BM-${stamp}${rand}`;
}

/** 128 bits of randomness — impossible to guess a neighbouring ticket. */
function ticketToken() {
  return randomBytes(16).toString("base64url");
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
    const token = ticketToken();
    const { rows } = await c.query<{ id: string }>(
      `insert into bookings (reference, event, name, email, phone, total, ticket_token)
       values ($1, $2, $3, $4, $5, $6, $7) returning id`,
      [ref, parsed.event, parsed.name, parsed.email, parsed.phone, total, token]
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
      token,
      tiers: parsed.tiers.map((w) => {
        const t = tiers.find((x) => x.id === w.id)!;
        return { id: t.id, name: t.name, price: Number(t.price), qty: w.qty };
      }),
    };
  });
}

/* ------------------------------------------------------------------ *
 *  Reading a ticket, and admitting it at the gate.
 * ------------------------------------------------------------------ */

type TicketRow = {
  reference: string;
  ticket_token: string;
  event: string;
  name: string;
  email: string;
  total: number;
  admitted_at: string | null;
  admitted_by: string;
  title: string;
  starts_at: string;
  venue: string;
  city: string;
  doors: string;
  image: string;
};

const ticketSelect = `
  select b.id, b.reference, b.ticket_token, b.event, b.name, b.email, b.total,
         b.admitted_at, b.admitted_by,
         e.title, e.starts_at, e.venue, e.city, e.doors, e.image
    from bookings b
    join events e on e.slug = b.event`;

async function tiersFor(bookingIds: string[]): Promise<Map<string, Ticket["tiers"]>> {
  const out = new Map<string, Ticket["tiers"]>();
  if (!bookingIds.length) return out;
  const rows = await query<{
    booking: string;
    id: string;
    name: string;
    price: number;
    qty: number;
  }>(
    `select bi.booking, t.id, t.name, t.price, bi.qty
       from booking_items bi
       join ticket_tiers t on t.id = bi.tier
      where bi.booking = any($1)`,
    [bookingIds]
  );
  for (const r of rows) {
    const list = out.get(r.booking) ?? [];
    list.push({ id: r.id, name: r.name, price: Number(r.price), qty: Number(r.qty) });
    out.set(r.booking, list);
  }
  return out;
}

function toTicket(row: TicketRow, tiers: Ticket["tiers"]): Ticket {
  return {
    reference: row.reference,
    token: row.ticket_token,
    event: row.event,
    eventTitle: row.title,
    eventDate: row.starts_at,
    venue: row.venue,
    city: row.city,
    doors: row.doors,
    image: row.image,
    name: row.name,
    email: row.email,
    total: Number(row.total),
    tiers,
    admittedAt: row.admitted_at,
    admittedBy: row.admitted_by,
  };
}

/** Looks a ticket up by its opaque token. null when it does not exist. */
export async function getTicketByToken(token: string): Promise<Ticket | null> {
  const rows = await query<TicketRow & { id: string }>(
    `${ticketSelect} where b.ticket_token = $1`,
    [token]
  );
  const row = rows[0];
  if (!row) return null;
  const tiers = (await tiersFor([row.id])).get(row.id) ?? [];
  return toTicket(row, tiers);
}

/**
 * Look a ticket up by the reference printed on it.
 *
 * The reference is not a secret, so this is only for staff: it is how a ticket
 * with a creased or unreadable QR gets admitted at the gate by typing the code
 * off the card. Anyone else must present the signed QR.
 */
export async function getTicketByReference(
  reference: string
): Promise<Ticket | null> {
  const rows = await query<TicketRow & { id: string }>(
    `${ticketSelect} where upper(b.reference) = upper($1)`,
    [reference.trim()]
  );
  const row = rows[0];
  if (!row) return null;
  const tiers = (await tiersFor([row.id])).get(row.id) ?? [];
  return toTicket(row, tiers);
}

/** Either the token from the QR, or the reference a volunteer types in. */
export async function findTicketForGate(scan: string): Promise<Ticket | null> {
  return (await getTicketByToken(scan)) ?? (await getTicketByReference(scan));
}

export type AdmitResult =
  | { status: "admitted"; ticket: Ticket }
  | { status: "already"; ticket: Ticket }
  | { status: "not-found" };

/**
 * Marks a ticket as admitted. Idempotent in the sense that a second scan is
 * reported rather than silently overwriting the first — the gate needs to know
 * whether it is the first person through with this ticket.
 *
 * The guard lives in the UPDATE (`where admitted_at is null`), so two scanners
 * racing on the same QR cannot both report a fresh admission.
 */
export async function admitTicket(
  token: string,
  by: string
): Promise<AdmitResult> {
  const before = await getTicketByToken(token);
  if (!before) return { status: "not-found" };

  const rows = await query<{ admitted_at: string }>(
    `update bookings
        set admitted_at = now(), admitted_by = $2
      where ticket_token = $1 and admitted_at is null
      returning admitted_at`,
    [token, by.slice(0, 80)]
  );

  if (!rows[0]) {
    // Nothing updated: either it was already admitted, or the event is cancelled.
    const now = await getTicketByToken(token);
    return now ? { status: "already", ticket: now } : { status: "not-found" };
  }

  const ticket = await getTicketByToken(token);
  return ticket ? { status: "admitted", ticket } : { status: "not-found" };
}

/** Undo an admission — a mis-scan at the gate should be fixable. */
export async function reopenTicket(token: string): Promise<boolean> {
  const rows = await query<{ reference: string }>(
    `update bookings set admitted_at = null, admitted_by = ''
      where ticket_token = $1 returning reference`,
    [token]
  );
  return Boolean(rows[0]);
}

/** What a bookings table needs, without a query per row. */
export type BookingRow = {
  reference: string;
  token: string;
  event: string;
  eventTitle: string;
  eventDate: string;
  venue: string;
  city: string;
  name: string;
  email: string;
  total: number;
  seats: number;
  /** "Grandstand Seat × 2, Stand × 1" — ready to print. */
  seatsText: string;
  status: string;
  createdAt: string;
  admittedAt: string | null;
};

/**
 * Recent bookings for the admin panel.
 *
 * The tier breakdown is aggregated in SQL rather than looped per booking: the
 * bookings page lists hundreds of rows, and N+1 queries there would make the
 * panel feel broken.
 */
export async function listBookings(limit = 100): Promise<BookingRow[]> {
  const rows = await query<{
    reference: string;
    ticket_token: string;
    event: string;
    title: string;
    starts_at: string;
    venue: string;
    city: string;
    name: string;
    email: string;
    total: number;
    status: string;
    created_at: string;
    admitted_at: string | null;
    seats: number | string;
    seats_text: string | null;
  }>(
    `select b.reference, b.ticket_token, b.event, e.title, e.starts_at, e.venue, e.city,
            b.name, b.email, b.total, b.status, b.created_at, b.admitted_at,
            coalesce(sum(bi.qty), 0) as seats,
            string_agg(t.name || ' × ' || bi.qty, ', ' order by t.name) as seats_text
       from bookings b
       join events e on e.slug = b.event
       left join booking_items bi on bi.booking = b.id
       left join ticket_tiers t on t.id = bi.tier
      group by b.id, b.reference, b.ticket_token, b.event, e.title, e.starts_at,
               e.venue, e.city, b.name, b.email, b.total, b.status, b.created_at, b.admitted_at
      order by b.created_at desc
      limit $1`,
    [limit]
  );
  return rows.map((r) => ({
    reference: r.reference,
    token: r.ticket_token,
    event: r.event,
    eventTitle: r.title,
    eventDate: r.starts_at,
    venue: r.venue,
    city: r.city,
    name: r.name,
    email: r.email,
    total: Number(r.total),
    seats: Number(r.seats ?? 0),
    seatsText: r.seats_text ?? "",
    status: r.status,
    createdAt: r.created_at,
    admittedAt: r.admitted_at,
  }));
}
