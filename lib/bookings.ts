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
  /**
   * Opaque secret inside the first ticket's QR. Kept because the confirmation
   * screen shows one QR straight away; `tickets` is the real list.
   */
  token: string;
  /** One per seat, in the order they will be emailed. */
  tickets: { seq: number; token: string; tier: string }[];
};

/** One admission ticket, as the ticket page and the gate scanner see it. */
export type Ticket = {
  reference: string;
  /**
   * Which person this is: 1-based, out of `of`. A booking of four seats is four
   * tickets, and the gate needs to say "ticket 2 of 4" rather than "already
   * used" — the second person is not a repeat, they are somebody else carrying
   * the same sale.
   */
  seq: number;
  of: number;
  /** Null when the booking was made before tickets were split per person. */
  token: string;
  event: string;
  eventTitle: string;
  eventDate: string;
  venue: string;
  city: string;
  doors: string;
  /** The card photo — what the ticket page and the storefront grid show. */
  image: string;
  /** The event's hero photograph, for the mail header wash. */
  heroImage: string;
  name: string;
  email: string;
  total: number;
  tiers: { id: string; name: string; price: number; qty: number }[];
  admittedAt: string | null;
  admittedBy: string;
  /** Set when the admin has stopped this one ticket — the gate refuses it. */
  blockedAt: string | null;
  blockedBy: string;
  /**
   * This ticket's own reference, printed on the bill and typed at the gate:
   * `BM-ABC12345-03`. The sale's reference is shared by everybody in the party,
   * so it cannot name one person; this can.
   */
  code: string;
  /** The ticket type this particular person holds, e.g. "Grandstand Seat". */
  tierName: string;
};

/**
 * The code for one ticket.
 *
 * Derived from the sale's reference and the seat number, not stored: the
 * reference is already unique and the seat number already exists, so a third
 * identifier would be a third thing that can disagree with the other two.
 * `-03` is zero-padded so the codes line up in a list and sort as numbers.
 */
export function ticketCode(reference: string, seq: number): string {
  return `${reference}-${String(seq).padStart(2, "0")}`;
}

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
    const { rows } = await c.query<{ id: string }>(
      `insert into bookings (reference, event, name, email, phone, total)
       values ($1, $2, $3, $4, $5, $6) returning id`,
      [ref, parsed.event, parsed.name, parsed.email, parsed.phone, total]
    );
    const bookingId = rows[0].id;

    for (const wanted of parsed.tiers) {
      const qty = Math.min(wanted.qty, MAX_PER_TIER);
      await c.query("insert into booking_items (booking, tier, qty) values ($1, $2, $3)", [
        bookingId,
        wanted.id,
        qty,
      ]);
      await c.query("update ticket_tiers set sold = sold + $2 where id = $1", [wanted.id, qty]);
    }

    /**
     * One ticket per seat, not one per booking.
     *
     * Four seats is four people through the gate, and each needs a code the gate
     * can admit once. A single QR on a four-seat booking admitted the first
     * person and turned the other three away.
     *
     * The tier is spread across the seats in the order it was bought, so "2 ×
     * Grandstand, 1 × Stand" becomes three tickets: grandstand, grandstand,
     * stand. That is what the gate and the PDF both show.
     */
    const perSeat: string[] = [];
    for (const wanted of parsed.tiers) {
      const t = tiers.find((x) => x.id === wanted.id)!;
      const qty = Math.min(wanted.qty, MAX_PER_TIER);
      for (let i = 0; i < qty; i++) perSeat.push(t.id);
    }

    const tickets: Booking["tickets"] = [];
    for (let i = 0; i < perSeat.length; i++) {
      const token = ticketToken();
      await c.query(
        `insert into booking_tickets (booking, seq, token, tier) values ($1, $2, $3, $4)`,
        [bookingId, i + 1, token, perSeat[i]]
      );
      tickets.push({ seq: i + 1, token, tier: perSeat[i] });
    }

    // The legacy column points at ticket #1 so anything still reading it —
    // including the confirmation screen's single QR — keeps working.
    await c.query("update bookings set ticket_token = $2 where id = $1", [
      bookingId,
      tickets[0]?.token ?? null,
    ]);

    return {
      reference: ref,
      event: parsed.event,
      total,
      token: tickets[0]?.token ?? "",
      tickets,
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
  booking_admitted_at: string | null;
  booking_admitted_by: string;
  title: string;
  starts_at: string;
  venue: string;
  city: string;
  doors: string;
  image: string;
  /** The event's hero photograph, preferred over the card photo in a mail. */
  hero_image: string;
};

/**
 * Reading a ticket, from either place it now lives.
 *
 * A ticket is a row in `booking_tickets` — that is where the gate looks and what
 * "ticket 2 of 4" means. The legacy `bookings.ticket_token` is still selectable
 * so the single QR printed in emails sent before the split keeps working: it
 * resolves to that booking's ticket #1, which the migration inserted with the
 * same token.
 */
const ticketSelect = `
  select b.id, b.reference, b.ticket_token, b.event, b.name, b.email, b.total,
         b.admitted_at as booking_admitted_at, b.admitted_by as booking_admitted_by,
         e.title, e.starts_at, e.venue, e.city, e.doors,
         -- The card photo first, then the hero, then nothing. An event created
         -- in the admin with only a hero photograph has an empty card image,
         -- and the email header then had no picture at all.
         coalesce(nullif(e.image, ''), nullif(e.hero_image, ''), '') as image,
         coalesce(nullif(e.hero_image, ''), nullif(e.image, ''), '') as hero_image
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

function toTicket(
  row: TicketRow,
  tiers: Ticket["tiers"],
  seat: {
    seq: number;
    of: number;
    token: string;
    /** The ticket's own type, where it is known. */
    tierName?: string;
    admittedAt: string | null;
    admittedBy: string;
    blockedAt?: string | null;
    blockedBy?: string;
  }
): Ticket {
  return {
    reference: row.reference,
    seq: seat.seq,
    of: seat.of,
    token: seat.token,
    event: row.event,
    eventTitle: row.title,
    eventDate: row.starts_at,
    venue: row.venue,
    city: row.city,
    doors: row.doors,
    image: row.image,
    heroImage: row.hero_image || row.image,
    name: row.name,
    email: row.email,
    total: Number(row.total),
    tiers,
    admittedAt: seat.admittedAt,
    admittedBy: seat.admittedBy,
    blockedAt: seat.blockedAt ?? null,
    blockedBy: seat.blockedBy ?? "",
    code: ticketCode(row.reference, seat.seq),
    tierName: seat.tierName ?? "",
  };
}

/** The seats a booking produced, in order. */
type Seat = {
  seq: number;
  token: string;
  /** The type this one ticket was bought as — a party can mix them. */
  tier: string;
  admitted_at: string | null;
  admitted_by: string;
  blocked_at: string | null;
  blocked_by: string;
};

async function seatsFor(bookingId: string): Promise<Seat[]> {
  return query<Seat>(
    `select seq, token, tier, admitted_at, admitted_by, blocked_at, blocked_by
       from booking_tickets
      where booking = $1
      order by seq`,
    [bookingId]
  );
}

/**
 * Build a Ticket for one seat of a booking.
 *
 * With no matching seat it falls back to the legacy token on the booking itself,
 * which is ticket #1 in everything but name. That fallback is what keeps an email
 * sent before the split working.
 */
async function ticketForSeat(
  row: TicketRow & { id: string },
  token: string
): Promise<Ticket | null> {
  const seats = await seatsFor(row.id);
  const tiers = (await tiersFor([row.id])).get(row.id) ?? [];
  const index = seats.findIndex((x) => x.token === token);

  if (index !== -1) {
    const seat = seats[index];
    return toTicket(row, tiers, {
      seq: seat.seq,
      of: seats.length,
      token: seat.token,
      tierName: tiers.find((t) => t.id === seat.tier)?.name ?? "",
      admittedAt: seat.admitted_at,
      admittedBy: seat.admitted_by,
      blockedAt: seat.blocked_at,
      blockedBy: seat.blocked_by,
    });
  }

  if (row.ticket_token === token) {
    return toTicket(row, tiers, {
      seq: 1,
      of: Math.max(1, seats.length),
      token,
      tierName: tiers[0]?.name ?? "",
      admittedAt: row.booking_admitted_at,
      admittedBy: row.booking_admitted_by,
    });
  }
  return null;
}

/**
 * Looks a ticket up by its opaque token — any seat, not just the first.
 *
 * The token may be a seat's own token or the legacy token on the booking, so this
 * asks both. One query per lookup is the cost of not having to guess which kind
 * of token arrived; the gate does one lookup per scan, not per visitor.
 */
export async function getTicketByToken(token: string): Promise<Ticket | null> {
  const bySeat = await query<TicketRow & { id: string }>(
    `${ticketSelect} join booking_tickets bt on bt.booking = b.id where bt.token = $1`,
    [token]
  );
  if (bySeat[0]) return ticketForSeat(bySeat[0], token);

  const byBooking = await query<TicketRow & { id: string }>(
    `${ticketSelect} where b.ticket_token = $1`,
    [token]
  );
  if (!byBooking[0]) return null;
  return ticketForSeat(byBooking[0], token);
}

/** Every ticket on a booking, in order — what the email sends and the PDF prints. */
export async function ticketsForBooking(reference: string): Promise<Ticket[]> {
  const rows = await query<TicketRow & { id: string }>(
    `${ticketSelect} where upper(b.reference) = upper($1)`,
    [reference.trim()]
  );
  const row = rows[0];
  if (!row) return [];

  const seats = await seatsFor(row.id);
  const tiers = (await tiersFor([row.id])).get(row.id) ?? [];
  if (!seats.length) {
    // A booking made before the split: it is one ticket, and its token is the one
    // already in the customer's inbox.
    return row.ticket_token
      ? [
          toTicket(row, tiers, {
            seq: 1,
            of: 1,
            token: row.ticket_token,
            tierName: tiers[0]?.name ?? "",
            admittedAt: row.booking_admitted_at,
            admittedBy: row.booking_admitted_by,
          }),
        ]
      : [];
  }
  return seats.map((seat) =>
    toTicket(row, tiers, {
      seq: seat.seq,
      of: seats.length,
      token: seat.token,
      tierName: tiers.find((t) => t.id === seat.tier)?.name ?? "",
      admittedAt: seat.admitted_at,
      admittedBy: seat.admitted_by,
      blockedAt: seat.blocked_at,
      blockedBy: seat.blocked_by,
    })
  );
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
  // The next person entitled to enter, not always the same seat: the first
  // ticket that is neither used nor blocked. If every one is blocked the gate
  // gets a blocked ticket back and says so, which is the honest answer.
  const all = await ticketsForBooking(reference);
  return (
    all.find((t) => !t.admittedAt && !t.blockedAt) ??
    all.find((t) => !t.admittedAt) ??
    all[0] ??
    null
  );
}

/** Either the token from the QR, or the reference a volunteer types in. */
export async function findTicketForGate(scan: string): Promise<Ticket | null> {
  return (await getTicketByToken(scan)) ?? (await getTicketByReference(scan));
}

export type AdmitResult =
  | { status: "admitted"; ticket: Ticket }
  | { status: "already"; ticket: Ticket }
  /** The admin stopped this one ticket. Reported, not admitted. */
  | { status: "blocked"; ticket: Ticket }
  | { status: "not-found" };

/**
 * Marks one ticket — one person — as admitted.
 *
 * A second scan of the *same* ticket is reported rather than silently
 * overwriting the first: the gate needs to know whether this is the first person
 * through on that code. But a second *person* on the same booking is not a
 * repeat, which is why the guard is per seat rather than per booking.
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

  // A blocked ticket is a decision the admin already made. Checked before the
  // update so a blocked code cannot be admitted by a second scanner racing the
  // first, and reported as its own answer so the volunteer at the door is told
  // to stop the person rather than that the code is a repeat.
  if (before.blockedAt) return { status: "blocked", ticket: before };

  const admitted = await query<{ id: string; booking: string }>(
    `update booking_tickets
        set admitted_at = now(), admitted_by = $2
      where token = $1 and admitted_at is null
      returning id, booking`,
    [token, by.slice(0, 80)]
  );

  /**
   * Whether *this scan* admitted somebody is answered by the UPDATE, not by
   * looking at the row afterwards.
   *
   * Reading the row after the fact cannot tell "I just admitted this" from "it
   * was already admitted" — both leave `admitted_at` set — and that is exactly the
   * distinction the gate exists to report. It looked right on the first scan and
   * wrong on the second, which is the worse of the two ways to get it wrong.
   */
  let justAdmitted = admitted.length > 0;

  /**
   * Legacy token: only for a token that is *not* on any seat.
   *
   * This caught a real bug. When the booking's old single token was inserted as
   * ticket #1's token, the seat update above already handles it; running this
   * fallback as well meant the second scan of ticket 1 matched
   * `bookings.ticket_token` — which the roll-up sets to ticket #1's token as
   * soon as everything is in — and reported a fresh admission on a repeat scan.
   * The gate would have waved through a duplicate at the door.
   */
  const bookingId = await query<{ id: string }>(
    "select id from bookings where upper(reference) = upper($1)",
    [before.reference]
  );
  const onSeat = bookingId[0]
    ? (await seatsFor(bookingId[0].id)).some((seat) => seat.token === token)
    : false;
  if (!justAdmitted && !onSeat) {
    const legacy = await query<{ reference: string }>(
      `update bookings set admitted_at = now(), admitted_by = $2
        where ticket_token = $1 and admitted_at is null
        returning reference`,
      [token, by.slice(0, 80)]
    );
    justAdmitted = legacy.length > 0;
  }

  // The booking's own admitted_at is a roll-up: the sale is "in" only when every
  // ticket on it has been used. The admin list shows that, and it is the honest
  // answer to "has this booking been admitted?" when four people are four scans.
  await syncBookingAdmission(before.reference);

  const after = await getTicketByToken(token);
  if (!after) return { status: "not-found" };
  return { status: justAdmitted ? "admitted" : "already", ticket: after };
}

/** Recompute the booking-level roll-up from its tickets. */
async function syncBookingAdmission(reference: string): Promise<void> {
  await query(
    `update bookings b
        set admitted_at = case when open.count = 0 then coalesce(b.admitted_at, now()) else null end,
            admitted_by = case when open.count = 0 then coalesce(nullif(b.admitted_by, ''), $2) else '' end
       from (select
               (select count(*) from booking_tickets bt
                 where bt.booking = b2.id and bt.admitted_at is null) as count,
               (select count(*) from booking_tickets bt where bt.booking = b2.id) as total,
               b2.id
               from bookings b2 where upper(b2.reference) = upper($1)) as open
      where b.id = open.id and open.total > 0`,
    [reference, "gate"]
  );
}

/* ------------------------------------------------------------------ *
 *  Stopping one ticket, and issuing one by hand.
 * ------------------------------------------------------------------ */

/**
 * Block one ticket.
 *
 * The whole point of a per-ticket code: when a QR is forwarded to somebody who
 * should not be in the hall, the sale's reference cannot name the ticket that
 * leaked — everybody in the party shares it. The token can, and it is what this
 * takes. Blocking is reversible and never touches the money: the sale still
 * exists, the bill still says what was paid, and the other seven people walk in.
 */
export async function blockTicket(
  token: string,
  by: string,
  note = ""
): Promise<{ ok: true; ticket: Ticket } | { ok: false; error: string }> {
  const rows = await query<{ booking: string }>(
    `update booking_tickets
        set blocked_at = now(), blocked_by = $2, blocked_note = $3
      where token = $1
      returning booking`,
    [token, by.slice(0, 80), note.slice(0, 300)]
  );
  if (!rows[0]) return { ok: false, error: "That ticket is not on any booking." };

  const ticket = await getTicketByToken(token);
  if (!ticket) return { ok: false, error: "That ticket is not on any booking." };
  return { ok: true, ticket };
}

/** Let a blocked ticket back in. */
export async function unblockTicket(
  token: string
): Promise<{ ok: true; ticket: Ticket } | { ok: false; error: string }> {
  const rows = await query<{ booking: string }>(
    `update booking_tickets
        set blocked_at = null, blocked_by = '', blocked_note = ''
      where token = $1
      returning booking`,
    [token]
  );
  if (!rows[0]) return { ok: false, error: "That ticket is not on any booking." };

  const ticket = await getTicketByToken(token);
  if (!ticket) return { ok: false, error: "That ticket is not on any booking." };
  return { ok: true, ticket };
}

/**
 * Remove one ticket from a booking.
 *
 * For the ticket that should never have existed — a double click, a seat typed
 * twice at the counter — not for a ticket that has been shared: that one is
 * blocked, because a deleted ticket leaves nothing behind to explain itself.
 *
 * The sale is untouched. `booking_items` keeps what was bought and `bookings.total`
 * keeps what was paid, so the bill and the takings still add up after a seat has
 * been taken off the list.
 */
export async function deleteTicket(
  token: string
): Promise<{ ok: true; reference: string } | { ok: false; error: string }> {
  const before = await getTicketByToken(token);
  if (!before) return { ok: false, error: "That ticket is not on any booking." };

  const rows = await query<{ booking: string }>(
    "delete from booking_tickets where token = $1 returning booking",
    [token]
  );
  if (!rows[0]) return { ok: false, error: "That ticket is not on any booking." };

  // Everybody already in? Recompute: removing the last open ticket can complete
  // the party, and removing an admitted one must not leave the sale marked "in".
  await syncBookingAdmission(before.reference);
  return { ok: true, reference: before.reference };
}

/** What the admin supplies when they issue a ticket at the counter. */
export type IssueTicketInput = {
  /** The ticket type decides the event; one select cannot disagree with itself. */
  tier: string;
  name: string;
  email?: string;
  /** Blank = the tier's own price. 0 = complimentary. */
  price?: number | null;
  note?: string;
  by?: string;
};

/**
 * A ticket the admin makes by hand: a comp for the headmaster, a sponsor's seat,
 * cash taken at the door.
 *
 * Deliberately the same shape as a sale — a booking with a reference, one item,
 * one ticket — so it is admitted by the same gate, prints the same bill, and
 * shows up in the same list. Anything else would be a second kind of ticket the
 * gate has to know about at eleven o'clock at night.
 */
export async function issueTicket(
  input: IssueTicketInput
): Promise<{ ok: true; booking: Booking } | { ok: false; error: string }> {
  const name = input.name.trim() || "Counter ticket";
  const email = (input.email ?? "").trim();

  return transaction(async (c) => {
    const { rows: tiers } = await c.query<{
      id: string;
      event: string;
      name: string;
      price: number;
    }>("select id, event, name, price from ticket_tiers where id = $1", [input.tier]);
    const tier = tiers[0];
    if (!tier) return { ok: false as const, error: "Pick a ticket type." };

    const price =
      input.price === null || input.price === undefined || Number.isNaN(input.price)
        ? Number(tier.price)
        : Math.max(0, Math.round(input.price));

    const ref = reference();
    const { rows: created } = await c.query<{ id: string }>(
      `insert into bookings (reference, event, name, email, total, channel, note)
       values ($1, $2, $3, $4, $5, 'counter', $6) returning id`,
      [ref, tier.event, name, email, price, (input.note ?? "").slice(0, 300)]
    );
    const bookingId = created[0].id;

    await c.query("insert into booking_items (booking, tier, qty) values ($1, $2, 1)", [
      bookingId,
      tier.id,
    ]);
    await c.query("update ticket_tiers set sold = sold + 1 where id = $1", [tier.id]);

    const token = ticketToken();
    await c.query(
      "insert into booking_tickets (booking, seq, token, tier) values ($1, 1, $2, $3)",
      [bookingId, token, tier.id]
    );
    await c.query("update bookings set ticket_token = $2 where id = $1", [bookingId, token]);

    return {
      ok: true as const,
      booking: {
        reference: ref,
        event: tier.event,
        total: price,
        token,
        tickets: [{ seq: 1, token, tier: tier.id }],
        tiers: [{ id: tier.id, name: tier.name, price, qty: 1 }],
      },
    };
  });
}

/** Undo an admission — a mis-scan at the gate should be fixable. */
export async function reopenTicket(token: string): Promise<boolean> {
  const rows = await query<{ booking: string }>(
    `update booking_tickets set admitted_at = null, admitted_by = ''
      where token = $1 returning booking`,
    [token]
  );

  const before = await getTicketByToken(token);
  if (!rows[0] && before) {
    await query(
      `update bookings set admitted_at = null, admitted_by = ''
        where ticket_token = $1`,
      [token]
    );
  }
  if (before) await syncBookingAdmission(before.reference);
  return Boolean(rows[0]) || Boolean(before);
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
  /** How many tickets on this booking have been scanned in. */
  admitted: number;
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
    admitted: number | string;
  }>(
    `select b.reference, b.ticket_token, b.event, e.title, e.starts_at, e.venue, e.city,
            b.name, b.email, b.total, b.status, b.created_at, b.admitted_at,
            coalesce(sum(bi.qty), 0) as seats,
            string_agg(t.name || ' × ' || bi.qty, ', ' order by t.name) as seats_text,
            -- How many people are already in. Separate from admitted_at, which is
            -- the all-in roll-up: "2 of 4 scanned" is the useful number mid-event.
            (select count(*) from booking_tickets bt
              where bt.booking = b.id and bt.admitted_at is not null) as admitted
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
    admitted: Number(r.admitted ?? 0),
    status: r.status,
    createdAt: r.created_at,
    admittedAt: r.admitted_at,
  }));
}
