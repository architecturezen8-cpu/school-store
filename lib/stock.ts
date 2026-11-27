import { query, transaction } from "./db";
import { LOW_STOCK, comboKey, combosFor, type StockCell } from "./stock-core";
import { errorMessage } from "./errors";

/**
 * Stock, server side.
 *
 * Reading is one query for the whole catalogue and is grouped in memory: the
 * shop lists products in the dozens, not the thousands, and one extra round trip
 * per product on a category page would be the difference between a fast page and
 * a slow one.
 *
 * Writing is per product, because that is the unit the admin edits: the whole
 * shelf of a hoodie, colour by colour, in one transaction.
 */

export type Result = { ok: true } | { ok: false; error: string };

/** Every shelf cell in the shop, keyed by product slug. */
export async function readStock(slugs?: string[]): Promise<Map<string, StockCell[]>> {
  const rows = await query<{ slug: string; colour: string; size: string; qty: number }>(
    slugs && slugs.length
      ? `select slug, colour, size, qty from product_stock where slug = any($1) order by colour, size`
      : "select slug, colour, size, qty from product_stock order by slug, colour, size",
    slugs && slugs.length ? [slugs] : []
  );
  const bySlug = new Map<string, StockCell[]>();
  for (const r of rows) {
    const list = bySlug.get(r.slug) ?? [];
    list.push({ colour: r.colour, size: r.size, qty: Number(r.qty) });
    bySlug.set(r.slug, list);
  }
  return bySlug;
}

/** The editor's `"colour|size" → number` view of one product. */
export async function stockDraftFor(slug: string): Promise<Record<string, number>> {
  const rows = await query<{ colour: string; size: string; qty: number }>(
    "select colour, size, qty from product_stock where slug = $1",
    [slug]
  );
  const map: Record<string, number> = {};
  for (const r of rows) map[comboKey(r.colour, r.size)] = Number(r.qty);
  return map;
}

/**
 * Replaces a product's whole shelf.
 *
 * `values` is what the form sent: keys are `"colour|size"`, and an empty string
 * (or a key that was never sent) is not a number. If *nothing* was filled in the
 * product is not stock-counted any more and its rows are removed — which is the
 * only way an admin can go back to "we just sell them".
 *
 * The combination list comes from the product's own colours and sizes, not from
 * the form, so a hidden field cannot invent a shelf cell that the shop will never
 * ask about.
 */
export async function saveProductStock(
  slug: string,
  colours: string[],
  sizes: string[],
  values: Record<string, unknown>
): Promise<Result> {
  const combos = combosFor(colours, sizes);
  const has = Object.values(values).some((v) => String(v ?? "").trim() !== "");

  try {
    await transaction(async (c) => {
      if (!has) {
        await c.query("delete from product_stock where slug = $1", [slug]);
        return;
      }
      for (const cell of combos) {
        const raw = String(values[comboKey(cell.colour, cell.size)] ?? "").trim();
        const qty = raw === "" ? 0 : Math.round(Number(raw));
        if (!Number.isFinite(qty) || qty < 0) {
          throw new Error(`“${raw}” is not a number of items.`);
        }
        await c.query(
          `insert into product_stock (slug, colour, size, qty)
           values ($1, $2, $3, $4)
           on conflict (slug, colour, size)
           do update set qty = excluded.qty, updated_at = now()`,
          [slug, cell.colour, cell.size, qty]
        );
      }
      // A colour or size the admin removed from the product takes its shelf cell
      // with it — a row nobody can reach is a row that will be reordered forever.
      const keep = combos.map((c) => [c.colour, c.size]);
      await c.query(
        `delete from product_stock s
          where s.slug = $1
            and not exists (
              select 1 from unnest($2::text[], $3::text[]) as k(colour, size)
               where k.colour = s.colour and k.size = s.size
            )`,
        [slug, keep.map((k) => k[0]), keep.map((k) => k[1])]
      );
    });
    return { ok: true };
  } catch (err) {
    return { ok: false, error: errorMessage(err) };
  }
}

/* ------------------------------------------------------------------ *\
 *  Tickets
\* ------------------------------------------------------------------ */

export type TierStock = {
  id: string;
  event: string;
  eventTitle: string;
  name: string;
  price: number;
  capacity: number | null;
  sold: number;
  left: number | null;
};

export async function listTierStock(): Promise<TierStock[]> {
  try {
    const rows = await query<{
      id: string;
      event: string;
      event_title: string;
      name: string;
      price: number;
      capacity: number | null;
      sold: number;
    }>(
      `select t.id, t.event, e.title as event_title, t.name, t.price, t.capacity, t.sold
         from ticket_tiers t join events e on e.slug = t.event
        order by e.title, t.position, t.name`
    );
    return rows.map((r) => {
      const capacity = r.capacity === null ? null : Number(r.capacity);
      const sold = Number(r.sold);
      return {
        id: r.id,
        event: r.event,
        eventTitle: r.event_title,
        name: r.name,
        price: Number(r.price),
        capacity,
        sold,
        left: capacity === null ? null : Math.max(0, capacity - sold),
      };
    });
  } catch (err) {
    console.warn("[stock] ticket tiers unavailable:", errorMessage(err));
    return [];
  }
}

/**
 * Sets how many seats a tier has. A blank box means "no cap".
 *
 * The cap may be set below what is already sold — the office sometimes closes a
 * tier early — and the shop then simply reads it as sold out.
 */
export async function saveTierCapacity(id: string, raw: unknown): Promise<Result> {
  const text = String(raw ?? "").trim();
  let capacity: number | null = null;
  if (text !== "") {
    const n = Math.round(Number(text));
    if (!Number.isFinite(n) || n < 0) return { ok: false, error: `“${text}” is not a number of seats.` };
    capacity = n;
  }
  try {
    await query("update ticket_tiers set capacity = $2 where id = $1", [id, capacity]);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: errorMessage(err) };
  }
}

/* ------------------------------------------------------------------ *\
 *  The "running low" list
\* ------------------------------------------------------------------ */

export type LowItem = {
  kind: "product" | "ticket";
  /** Product slug or tier id. */
  id: string;
  name: string;
  /** The collection or the event, for context in a list. */
  group: string;
  detail: string;
  /** Everything left, all cells added up. 0 means nothing can be bought. */
  left: number;
  /**
   * The emptiest cell. This is the number worth acting on — a hoodie with 34 on
   * the shelf and none of them in grey is a problem, and "34 left" hides it.
   */
  worst: number;
};

/**
 * Everything at or under `LOW_STOCK`, for the banner at the top of the stocks
 * screen and the note on the overview.
 *
 * A failure here returns an empty list rather than throwing: this is a warning,
 * and a warning that takes the whole admin down is worse than no warning. The
 * admin's own schema banner still tells the office when the database is behind.
 */
export async function runningLow(): Promise<LowItem[]> {
  const items: LowItem[] = [];

  /**
   * One line per *product*, not per shelf cell.
   *
   * A hoodie in four colours and six sizes has twenty-four cells; three of them
   * empty used to be three lines in the banner, and twenty-two were twenty-two
   * lines. The office reorders a hoodie, not "Navy / XL", so the banner says how
   * many cells are gone and which one is worst.
   */
  try {
    const rows = await query<{
      slug: string;
      name: string;
      category: string;
      colour: string;
      size: string;
      qty: number;
    }>(
      `select s.slug, p.name, p.category, s.colour, s.size, s.qty
         from product_stock s join products p on p.slug = s.slug
        where p.active
        order by p.name, s.colour, s.size`
    );

    const bySlug = new Map<string, typeof rows>();
    for (const r of rows) {
      const list = bySlug.get(r.slug) ?? [];
      list.push(r);
      bySlug.set(r.slug, list);
    }

    for (const [slug, cells] of bySlug) {
      const out = cells.filter((c) => Number(c.qty) === 0);
      const low = cells.filter((c) => Number(c.qty) > 0 && Number(c.qty) <= LOW_STOCK);
      if (!out.length && !low.length) continue;

      const total = cells.reduce((sum, c) => sum + Number(c.qty), 0);
      const worst = [...cells].sort((a, b) => Number(a.qty) - Number(b.qty))[0];
      const label = [worst.colour, worst.size].filter(Boolean).join(" / ") || "the only one";
      const first = cells[0];

      const detail =
        out.length && low.length
          ? `${out.length} sold out · ${low.length} low`
          : out.length
            ? `${out.length} of ${cells.length} sold out`
            : `${low.length} low · ${label} has ${Number(worst.qty)}`;

      items.push({
        kind: "product",
        id: slug,
        name: first.name,
        group: first.category,
        detail,
        left: total,
        worst: Number(worst.qty),
      });
    }
  } catch (err) {
    console.warn("[stock] product stock unavailable:", errorMessage(err));
  }

  try {
    // `left` is a reserved word in SQL, so the computed column is named for what
    // it is: seats remaining.
    const rows = await query<{ id: string; name: string; title: string; seats_left: number }>(
      `select t.id, t.name, e.title, (t.capacity - t.sold)::int as seats_left
         from ticket_tiers t join events e on e.slug = t.event
        where t.capacity is not null and t.capacity - t.sold <= $1
        order by seats_left, e.title`,
      [LOW_STOCK]
    );
    for (const r of rows) {
      const seats = Math.max(0, Number(r.seats_left));
      items.push({
        kind: "ticket",
        id: r.id,
        name: r.name,
        group: r.title,
        detail: seats === 0 ? "no seats left" : "seats",
        left: seats,
        worst: seats,
      });
    }
  } catch (err) {
    console.warn("[stock] ticket stock unavailable:", errorMessage(err));
  }

  return items.sort((a, b) => a.worst - b.worst || a.left - b.left);
}
