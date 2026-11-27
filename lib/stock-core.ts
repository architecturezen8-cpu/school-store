import type { Product, ProductStock, StockCell } from "@/data/seed";

export type { ProductStock, StockCell };

/**
 * Stock, in the two places it needs to be understood: the database and the shop.
 *
 * This file is deliberately free of any database import — the quick view and the
 * product card are client components, and they have to be able to ask "how many
 * of this colour, in this size, are on the shelf?" without dragging Postgres
 * into the browser bundle.
 *
 * The vocabulary is small on purpose:
 *
 *   untracked  — no rows for the product: sell it, show nothing.
 *   tracked    — rows exist: a combination with no row is sold out (0).
 *   low        — at or below LOW_STOCK, and still sellable.
 */

/** The number under which the admin is told to reorder. */
export const LOW_STOCK = 5;

/** `colour|size` — the same key the editor's number boxes carry in a form. */
export function comboKey(colour: string, size: string): string {
  return `${colour}|${size}`;
}

export function splitKey(key: string): { colour: string; size: string } {
  const at = key.indexOf("|");
  if (at === -1) return { colour: key, size: "" };
  return { colour: key.slice(0, at), size: key.slice(at + 1) };
}

/**
 * Every shelf cell a product should have, given its colours and its size list.
 *
 * Both lists empty is a single cell — a scarf is still one thing on a shelf.
 * Only colours is one cell per colour, only sizes one per size, and both is the
 * grid a customer actually shops from.
 */
export function combosFor(colours: string[], sizes: string[]): StockCell[] {
  const clean = (list: string[]) => list.map((v) => v.trim()).filter(Boolean);
  const c = clean(colours);
  const s = clean(sizes);
  const cells: StockCell[] = [];
  if (c.length && s.length) {
    for (const colour of c) for (const size of s) cells.push({ colour, size, qty: 0 });
  } else if (c.length) {
    for (const colour of c) cells.push({ colour, size: "", qty: 0 });
  } else if (s.length) {
    for (const size of s) cells.push({ colour: "", size, qty: 0 });
  } else {
    cells.push({ colour: "", size: "", qty: 0 });
  }
  return cells;
}

/** The summary a `Product` carries. `cells` empty means "not counted". */
export function summarise(cells: StockCell[]): ProductStock | undefined {
  if (!cells.length) return undefined;
  const total = cells.reduce((sum, c) => sum + Math.max(0, Number(c.qty) || 0), 0);
  return {
    cells: cells.map((c) => ({ ...c, qty: Math.max(0, Number(c.qty) || 0) })),
    total,
    low: cells.some((c) => c.qty > 0 && c.qty <= LOW_STOCK),
    soldOut: total === 0,
  };
}

/**
 * How many are on the shelf for one choice.
 *
 * `null` is the important return: it means this product is not stock-counted, so
 * the caller must not print a number, refuse a sale, or grey anything out.
 */
export function stockFor(
  product: Pick<Product, "stock">,
  colour: string,
  size: string
): number | null {
  if (!product.stock) return null;
  const cell = product.stock.cells.find((c) => c.colour === colour && c.size === size);
  return cell ? Math.max(0, cell.qty) : 0;
}

/** The best a customer can do on this product, across every shelf cell. */
export function bestAvailable(product: Pick<Product, "stock">): number | null {
  if (!product.stock) return null;
  return Math.max(0, ...product.stock.cells.map((c) => c.qty));
}

export function isSoldOut(product: Pick<Product, "stock">): boolean {
  return product.stock?.soldOut === true;
}

/** "Only 3 left" / "Sold out" / nothing at all, for a shelf that is not counted. */
export function stockLabel(qty: number | null): string {
  if (qty === null) return "";
  if (qty <= 0) return "Sold out";
  if (qty <= LOW_STOCK) return `Only ${qty} left`;
  return "In stock";
}

/** A size/colour label as the bag and the order record spell it. */
export function variantLabel(colour: string | null, size: string | null): string {
  return [colour, size].filter(Boolean).join(" / ");
}

/* ------------------------------------------------------------------ *\
 *  Tickets
\* ------------------------------------------------------------------ */

/** Seats left in a tier; null means the tier has no cap. */
export function seatsLeft(tier: { capacity?: number | null; sold?: number }): number | null {
  if (tier.capacity === undefined || tier.capacity === null) return null;
  return Math.max(0, tier.capacity - (tier.sold ?? 0));
}

export function ticketsLeftLabel(tier: { capacity?: number | null; sold?: number }): string {
  const left = seatsLeft(tier);
  if (left === null) return "";
  if (left === 0) return "Sold out";
  if (left <= LOW_STOCK) return `Only ${left} left`;
  return `${left} left`;
}
