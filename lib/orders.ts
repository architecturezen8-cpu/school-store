import { z } from "zod";
import { query, transaction } from "./db";
import { comboKey } from "./stock-core";

/* ------------------------------------------------------------------ *
 *  Orders — create, track, and read for the "Track my order" modal.
 * ------------------------------------------------------------------ */

export const cartLineSchema = z.object({
  slug: z.string().min(1).max(120),
  qty: z.number().int().min(1).max(99),
  variant: z.string().max(80).optional().default(""),
  /** Which shelf cell this line came from — the pair stock is counted by. */
  colour: z.string().max(60).optional().default(""),
  size: z.string().max(60).optional().default(""),
});

export const createOrderSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(200),
  phone: z.string().trim().max(40).optional().default(""),
  note: z.string().trim().max(500).optional().default(""),
  items: z.array(cartLineSchema).min(1).max(40),
});

export type CreateOrderInput = z.infer<typeof createOrderSchema>;

export type OrderItem = {
  slug: string;
  name: string;
  price: number;
  qty: number;
  variant: string;
  colour: string;
  size: string;
};
export type Order = {
  reference: string;
  email: string;
  name: string;
  status: string;
  subtotal: number;
  delivery: number;
  total: number;
  createdAt: string;
  items: OrderItem[];
};

/** Free island-wide delivery above LKR 5,000 (same rule the UI advertises). */
export const FREE_DELIVERY_OVER = 5000;
export const DELIVERY_FEE = 400;

export function deliveryFor(subtotal: number) {
  return subtotal >= FREE_DELIVERY_OVER || subtotal === 0 ? 0 : DELIVERY_FEE;
}

/**
 * Prices always come from the database, never from the client: the request only
 * says *what* and *how many*. Unknown or inactive slugs reject the whole order.
 */
export async function createOrder(input: CreateOrderInput): Promise<Order> {
  const parsed = createOrderSchema.parse(input);
  const slugs = [...new Set(parsed.items.map((i) => i.slug))];

  return transaction(async (c) => {
    const { rows: products } = await c.query<{
      slug: string;
      name: string;
      price: number;
    }>("select slug, name, price from products where slug = any($1) and active", [slugs]);

    const bySlug = new Map(products.map((p) => [p.slug, p]));
    const missing = slugs.filter((s) => !bySlug.has(s));
    if (missing.length) throw new Error(`Unknown product: ${missing.join(", ")}`);

    /**
     * The shelf, locked for the rest of the transaction.
     *
     * Two parents can have the last medium navy shirt in their bags at the same
     * time. Reading the stock without a lock and decrementing it later is how a
     * shop sells the same shirt twice; `for update` makes the second checkout wait
     * and then fail honestly.
     */
    const { rows: shelves } = await c.query<{ slug: string; colour: string; size: string; qty: number }>(
      // `order by` is not cosmetic: two carts holding the same two shirts in a
      // different order otherwise lock the rows in a different order and
      // deadlock. One agreed order and the second checkout simply waits.
      `select slug, colour, size, qty
         from product_stock
        where slug = any($1)
        order by slug, colour, size
          for update`,
      [slugs]
    );
    const shelf = new Map<string, Map<string, number>>();
    for (const r of shelves) {
      const cells = shelf.get(r.slug) ?? new Map<string, number>();
      cells.set(comboKey(r.colour, r.size), Number(r.qty));
      shelf.set(r.slug, cells);
    }

    const lines: OrderItem[] = parsed.items.map((i) => {
      const p = bySlug.get(i.slug)!;
      const colour = (i.colour ?? "").trim();
      const size = (i.size ?? "").trim();
      const cells = shelf.get(p.slug);
      // No rows at all: this product is not stock-counted, so nothing to check.
      if (cells) {
        const left = cells.get(comboKey(colour, size)) ?? 0;
        const label = [colour, size].filter(Boolean).join(" / ");
        if (left < i.qty) {
          throw new Error(
            left === 0
              ? `${p.name}${label ? ` (${label})` : ""} has just sold out.`
              : `Only ${left} of ${p.name}${label ? ` (${label})` : ""} left — please reduce the quantity.`
          );
        }
      }
      return {
        slug: p.slug,
        name: p.name,
        price: Number(p.price),
        qty: i.qty,
        variant: i.variant ?? [colour, size].filter(Boolean).join(" / "),
        colour,
        size,
      };
    });

    const subtotal = lines.reduce((sum, l) => sum + l.price * l.qty, 0);
    const delivery = deliveryFor(subtotal);

    const { rows } = await c.query<{ id: string; reference: string; created_at: string }>(
      `insert into orders (name, email, phone, note, subtotal, delivery, total)
       values ($1, $2, $3, $4, $5, $6, $7)
       returning id, reference, created_at`,
      [parsed.name, parsed.email, parsed.phone, parsed.note, subtotal, delivery, subtotal + delivery]
    );
    const order = rows[0];

    for (const l of lines) {
      await c.query(
        `insert into order_items (order_id, slug, name, price, qty, variant, colour, size)
         values ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [order.id, l.slug, l.name, l.price, l.qty, l.variant, l.colour, l.size]
      );
      if (shelf.has(l.slug)) {
        /*
          Decrement only if there is still enough on the shelf.
          
          `greatest(0, qty - n)` was the old shape: it never went negative, but
          it also silently sold stock that was not there and left the sheet
          claiming a shirt had been sold that never existed. The `qty >= $4`
          guard makes the row itself the referee — the update either takes the
          stock or matches nothing — so a burst of checkouts cannot oversell
          even if the read above were stale. The transaction rolls back on the
          throw, so no order row survives either.
        */
        const { rows: taken } = await c.query<{ qty: number }>(
          `update product_stock
              set qty = qty - $4, updated_at = now()
            where slug = $1 and colour = $2 and size = $3 and qty >= $4
            returning qty`,
          [l.slug, l.colour, l.size, l.qty]
        );
        if (!taken.length) {
          const label = [l.colour, l.size].filter(Boolean).join(" / ");
          throw new Error(
            `${l.name}${label ? ` (${label})` : ""} has just sold out. Nothing was charged — please adjust the bag and try again.`
          );
        }
      }
    }
    await c.query(
      "insert into order_events (order_id, status, message) values ($1, 'pending', $2)",
      [order.id, "Order received"]
    );

    return {
      reference: order.reference,
      email: parsed.email,
      name: parsed.name,
      status: "pending",
      subtotal,
      delivery,
      total: subtotal + delivery,
      createdAt: order.created_at,
      items: lines,
    };
  });
}

/** A reference + email pair is required — knowing one reference is not enough. */
export async function trackOrder(reference: string, email: string): Promise<Order | null> {
  const rows = await query<{
    id: string;
    reference: string;
    email: string;
    name: string;
    status: string;
    subtotal: number;
    delivery: number;
    total: number;
    created_at: string;
  }>(
    `select id, reference, email, name, status, subtotal, delivery, total, created_at
       from orders
      where reference = $1 and lower(email) = lower($2)`,
    [reference.trim(), email.trim()]
  );
  const o = rows[0];
  if (!o) return null;

  const items = await query<OrderItem>(
    `select slug, name, price, qty, variant,
            coalesce(colour, '') as colour, coalesce(size, '') as size
       from order_items where order_id = $1 order by id`,
    [o.id]
  );

  return {
    reference: o.reference,
    email: o.email,
    name: o.name,
    status: o.status,
    subtotal: Number(o.subtotal),
    delivery: Number(o.delivery),
    total: Number(o.total),
    createdAt: o.created_at,
    items: items.map((i) => ({ ...i, price: Number(i.price), qty: Number(i.qty) })),
  };
}

/** Status timeline for the tracking view. */
export async function orderTimeline(reference: string) {
  return query<{ status: string; message: string; created_at: string }>(
    `select e.status, e.message, e.created_at
       from order_events e join orders o on o.id = e.order_id
      where o.reference = $1 order by e.created_at`,
    [reference]
  );
}
