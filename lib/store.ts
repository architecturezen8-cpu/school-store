import {
  categories as seedCategories,
  products as seedProducts,
  reviews as seedReviews,
  events as seedEvents,
  searchChips,
  homeCategorySlugs,
  lkr,
  type Category,
  type Product,
  type Tier,
  type CollegeEvent,
} from "@/data/seed";
import { asset } from "./assets";
import type { EventImage, EventLink, EventRule } from "@/data/seed";
import { hasDatabase, query } from "./db";
import { DEFAULT_FILTERS, listFilters, type ShopFilter } from "./catalog";
import { readStock } from "./stock";
import { summarise } from "./stock-core";
import { errorMessage } from "./errors";

/* ------------------------------------------------------------------ *
 *  Data access — one place where "database or seed" is decided.
 *
 *  Every reader below returns seed data when DATABASE_URL is missing or the
 *  query fails, so a database hiccup degrades to the static catalogue instead
 *  of a broken page. Writers live in lib/orders.ts and require the database.
 * ------------------------------------------------------------------ */

export type Review = (typeof seedReviews)[number];

export type { Category, Product, Tier, CollegeEvent };

type CategoryRow = {
  slug: string;
  title: string;
  description: string;
  image: string;
  blurb: string;
};
type ProductRow = {
  slug: string;
  name: string;
  price: number;
  image: string;
  tag: string | null;
  category: string;
  rating: string;
  reviews: number;
  description: string;
  details: string[];
  options: Product["options"] | null;
  gallery: string[];
  colours: string[];
  colour_swatches: unknown;
  is_featured: boolean;
  is_new: boolean;
};

// Asset URLs are stored root-relative; see lib/assets.ts for the base-path rule.

const toCategory = (r: CategoryRow): Category => ({
  slug: r.slug,
  title: r.title,
  desc: r.description,
  image: asset(r.image),
  count: r.blurb,
});

const toProduct = (r: ProductRow): Product => ({
  slug: r.slug,
  name: r.name,
  price: Number(r.price),
  image: asset(r.image),
  tag: r.tag ?? undefined,
  category: r.category,
  rating: Number(r.rating),
  reviews: Number(r.reviews),
  description: r.description,
  details: Array.isArray(r.details) ? r.details : [],
  options: r.options ?? undefined,
  gallery:
    Array.isArray(r.gallery) && r.gallery.length ? r.gallery.map(asset) : undefined,
  colours: Array.isArray(r.colours) && r.colours.length ? r.colours : undefined,
  colourSwatches:
    r.colour_swatches && typeof r.colour_swatches === "object" && !Array.isArray(r.colour_swatches)
      ? (r.colour_swatches as Record<string, string>)
      : undefined,
  isFeatured: r.is_featured,
  isNew: r.is_new,
});

/** Applies the base-path prefix to every image field of a seed record. */
function withAsset<T extends { image: string }>(item: T): T {
  const gallery = (item as { gallery?: unknown }).gallery;
  return {
    ...item,
    image: asset(item.image),
    // A product's gallery is a list of URLs; an event's is a list of
    // `{url, caption}`. Both need the same prefix, so handle both shapes here
    // rather than making every caller remember which one it holds.
    ...(Array.isArray(gallery)
      ? {
          gallery: gallery.map((g) =>
            typeof g === "string" ? asset(g) : { ...g, url: asset((g as { url: string }).url) }
          ),
        }
      : {}),
  };
}

/**
 * A build must never quietly fill itself in with demo data.
 *
 * At runtime the fallback is right: a shop whose database blinked should still
 * render something rather than a 500. During `next build` it is the opposite —
 * the pages are written to disk and deployed, so a fallback bakes the demo
 * catalogue into the live site and the build still exits 0. `npm run build`
 * sets STORE_STRICT=1 and this rethrows instead, which surfaces the real reason
 * (`column "tagline" does not exist`, `ETIMEDOUT …`) once, instead of the 128
 * identical lines a fallback prints on a 34-page build.
 */
const STRICT = process.env.STORE_STRICT === "1";

async function safe<T>(run: () => Promise<T>, fallback: T): Promise<T> {
  if (!hasDatabase()) return fallback;
  try {
    return await run();
  } catch (err) {
    if (STRICT) {
      console.error(
        `\n[store] BUILD STOPPED: the database could not answer, so the shop cannot be built from it.\n` +
          `[store] ${errorMessage(err)}\n` +
          `[store] Fix it with: npm run db:check   ·   npm run db:migrate   ·   npm run db:seed\n`
      );
      throw new Error(`The shop was built from the seed catalogue, not the database: ${errorMessage(err)}`);
    }
    console.error("[store] query failed, serving seed data:", errorMessage(err));
    return fallback;
  }
}

/* ---------- categories ------------------------------------------------------ */

/**
 * The "16 badges" under a category name was a sentence in the seed file, and it
 * was never true: the collection holds three. A count that the shop computes
 * cannot drift from the shelf, so the blurb became a line of copy instead and the
 * number comes from the products themselves.
 */
function withCounts(cats: Category[], products: { category: string }[]): Category[] {
  const tally = new Map<string, number>();
  for (const p of products) tally.set(p.category, (tally.get(p.category) ?? 0) + 1);
  return cats.map((c) => {
    const n = tally.get(c.slug) ?? 0;
    return { ...c, count: `${n} ${n === 1 ? "item" : "items"}` };
  });
}

export async function getCategories(): Promise<Category[]> {
  const fallback = withCounts(seedCategories.map(withAsset), seedProducts);
  return safe(async () => {
    const rows = await query<CategoryRow & { items: number }>(
      `select c.slug, c.title, c.description, c.image, c.blurb,
              (select count(*) from products p where p.category = c.slug and p.active)::int as items
         from categories c
        order by c.position, c.title`
    );
    if (!rows.length) return fallback;
    return rows.map((r) => ({
      ...toCategory(r),
      count: `${Number(r.items)} ${Number(r.items) === 1 ? "item" : "items"}`,
    }));
  }, fallback);
}

/* ---------- filters --------------------------------------------------------- */

/**
 * The chips the shop offers: colours and sizes, in the order the admin set.
 *
 * Only the visible ones — a filter the office has switched off is a filter the
 * shop does not print — and the caller narrows them further to the ones that
 * would actually find something in the collection on screen.
 */
export async function getShopFilters(): Promise<ShopFilter[]> {
  const fallback: ShopFilter[] = DEFAULT_FILTERS.map((f, i) => ({
    id: `${f.kind}-${i}`,
    kind: f.kind,
    label: f.label,
    swatch: f.swatch,
    position: i,
    isActive: true,
  }));
  return safe(async () => {
    const rows = await listFilters();
    const visible = rows.filter((f) => f.isActive);
    return visible.length ? visible : fallback;
  }, fallback);
}

export async function getHomeCategories(): Promise<Category[]> {
  const all = await getCategories();
  const byslug = new Map(all.map((c) => [c.slug, c]));
  const picked = homeCategorySlugs
    .map((slug) => byslug.get(slug))
    .filter((c): c is Category => Boolean(c));
  return picked.length
    ? picked
    : (seedCategories.slice(0, 4).map(withAsset) as Category[]);
}

/* ---------- products -------------------------------------------------------- */
const productColumns = `slug, name, price, image, tag, category, rating, reviews,
  description, details, options, gallery, colours, colour_swatches, is_featured, is_new`;

/**
 * Adds the shelf to products that are stock-counted.
 *
 * One query for the whole list, and products with no stock rows are left exactly
 * as they were — `stock` undefined means "not counted", which every storefront
 * surface treats as "always available, print no number".
 */
async function withStock(products: Product[]): Promise<Product[]> {
  if (!products.length) return products;
  try {
    const shelves = await readStock(products.map((p) => p.slug));
    if (!shelves.size) return products;
    return products.map((p) => {
      const cells = shelves.get(p.slug);
      const stock = cells ? summarise(cells) : undefined;
      return stock ? { ...p, stock } : p;
    });
  } catch (err) {
    console.warn("[store] stock unavailable, selling uncounted:", errorMessage(err));
    return products;
  }
}

export async function getProducts(): Promise<Product[]> {
  return safe(async () => {
    const rows = await query<ProductRow>(
      `select ${productColumns} from products where active order by created_at, name`
    );
    return withStock(rows.length ? rows.map(toProduct) : seedProducts.map(withAsset));
  }, seedProducts.map(withAsset));
}

export async function getProductsByCategory(slug: string): Promise<Product[]> {
  const all = await getProducts();
  return all.filter((p) => p.category === slug);
}

export async function getProduct(slug: string): Promise<Product | undefined> {
  return safe(async () => {
    const rows = await query<ProductRow>(
      `select ${productColumns} from products where slug = $1 and active`,
      [slug]
    );
    if (rows[0]) {
      const [product] = await withStock([toProduct(rows[0])]);
      return product;
    }
    const seed = seedProducts.find((p) => p.slug === slug);
    return seed ? withAsset(seed) : undefined;
  }, (() => {
    const seed = seedProducts.find((p) => p.slug === slug);
    return seed ? withAsset(seed) : undefined;
  })());
}

export async function getRelatedProducts(slug: string, limit = 4): Promise<Product[]> {
  const product = await getProduct(slug);
  if (!product) return [];
  const all = await getProductsByCategory(product.category);
  return all.filter((p) => p.slug !== slug).slice(0, limit);
}

export async function getFeaturedProducts(): Promise<Product[]> {
  const all = await getProducts();
  const featured = all.filter((p) => p.isFeatured);
  return (featured.length ? featured : all).slice(0, 4);
}

export function categoryName(cats: Category[], slug: string): string {
  return cats.find((c) => c.slug === slug)?.title ?? slug;
}

/* ---------- reviews --------------------------------------------------------- */
export async function getReviews(): Promise<Review[]> {
  return safe(async () => {
    const rows = await query<Review>(
      "select name, role, body as text, rating from reviews order by position, id"
    );
    return rows.length ? rows.map((r) => ({ ...r, rating: Number(r.rating) })) : seedReviews;
  }, seedReviews);
}

/* ---------- events ---------------------------------------------------------- */
type EventRow = {
  slug: string;
  title: string;
  subtitle: string;
  description: string;
  venue: string;
  city: string;
  starts_at: string;
  doors: string;
  image: string;
  tag: string | null;
  featured: boolean;
  /* the page content — see db/schema.sql */
  tagline: string | null;
  story: string | null;
  rules: unknown;
  gallery: unknown;
  links: unknown;
  hero_image: string | null;
  hero_kicker: string | null;
  ends_at: string | null;
  position: number | null;
};

/**
 * Postgres hands `jsonb` back as already-parsed values, so these only have to
 * guard against a column that is null, a string (a hand-edited row) or the
 * wrong shape — never against valid JSON text.
 */
function asRules(value: unknown): EventRule[] {
  const raw = typeof value === "string" ? safeJson(value) : value;
  if (!Array.isArray(raw)) return [];
  return raw
    .map((r) => ({ title: String(r?.title ?? "").trim(), body: String(r?.body ?? "").trim() }))
    .filter((r) => r.title || r.body);
}

function asGallery(value: unknown): EventImage[] {
  const raw = typeof value === "string" ? safeJson(value) : value;
  if (!Array.isArray(raw)) return [];
  return raw
    .map((g) => ({ url: String(g?.url ?? "").trim(), caption: String(g?.caption ?? "").trim() }))
    .filter((g) => g.url)
    .map((g) => (g.caption ? g : { url: g.url }));
}

function asLinks(value: unknown): EventLink[] {
  const raw = typeof value === "string" ? safeJson(value) : value;
  if (!Array.isArray(raw)) return [];
  return raw
    .map((l) => ({ label: String(l?.label ?? "").trim(), url: String(l?.url ?? "").trim() }))
    .filter((l) => l.label && l.url);
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return [];
  }
}
type TierRow = {
  id: string;
  event: string;
  name: string;
  price: number;
  perks: string[];
  note: string | null;
  capacity: number | null;
  sold: number;
};

export async function getEvents(): Promise<CollegeEvent[]> {
  return safe(async () => {
    const [rows, tiers] = await Promise.all([
      query<EventRow>(
        `select slug, title, subtitle, description, venue, city, starts_at, doors,
                image, tag, featured,
                tagline, story, rules, gallery, links,
                hero_image, hero_kicker, ends_at, position
           from events where published order by position, starts_at`
      ),
      query<TierRow>(
        `select id, event, name, price, perks, note, capacity, sold
           from ticket_tiers order by event, position`
      ),
    ]);
    if (!rows.length) return seedEvents.map(withAsset);

    const bySlug = new Map<string, Tier[]>();
    for (const t of tiers) {
      const list = bySlug.get(t.event) ?? [];
      list.push({
        id: t.id,
        name: t.name,
        price: Number(t.price),
        perks: Array.isArray(t.perks) ? t.perks : [],
        note: t.note ?? undefined,
        capacity: t.capacity === null ? null : Number(t.capacity),
        sold: Number(t.sold ?? 0),
      });
      bySlug.set(t.event, list);
    }

    return rows
      .map<CollegeEvent>((r) => ({
        slug: r.slug,
        title: r.title,
        subtitle: r.subtitle,
        description: r.description,
        venue: r.venue,
        city: r.city,
        date: new Date(r.starts_at),
        doors: r.doors,
        // The card photo falls back to the hero. They are separate columns — a
        // card is landscape and a hero can be anything — but an event with a
        // photograph and no *card* photograph used to render a blank tile, which
        // reads as "no image" rather than "same image". The admin's intent is
        // clear enough: they uploaded a picture of this event.
        image: asset(r.image || r.hero_image || ""),
        tag: r.tag ?? undefined,
        featured: r.featured,
        tiers: bySlug.get(r.slug) ?? [],
        heroKicker: r.hero_kicker || undefined,
        tagline: r.tagline || undefined,
        heroImage: r.hero_image ? asset(r.hero_image) : undefined,
        story: r.story || undefined,
        rules: asRules(r.rules),
        gallery: asGallery(r.gallery).map((g) => ({ ...g, url: asset(g.url) })),
        links: asLinks(r.links),
        endsAt: r.ends_at ? new Date(r.ends_at) : undefined,
        position: r.position ?? 0,
      }))
      .filter((e) => e.tiers.length > 0);
  }, seedEvents.map(withAsset));
}

/** One published event, for its own page. undefined = no such event on sale. */
export async function getEvent(slug: string): Promise<CollegeEvent | undefined> {
  const all = await getEvents();
  return all.find((e) => e.slug === slug);
}

/* ---------- misc ------------------------------------------------------------ */
export { searchChips, lkr };
export const lowestPrice = (e: CollegeEvent) =>
  e.tiers.reduce((min, t) => Math.min(min, t.price), Number.POSITIVE_INFINITY);
