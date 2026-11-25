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
import { hasDatabase, query } from "./db";
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
  isFeatured: r.is_featured,
  isNew: r.is_new,
});

/** Applies the base-path prefix to every image field of a seed record. */
function withAsset<T extends { image: string; gallery?: string[] }>(item: T): T {
  return {
    ...item,
    image: asset(item.image),
    ...(item.gallery ? { gallery: item.gallery.map(asset) } : {}),
  };
}

async function safe<T>(run: () => Promise<T>, fallback: T): Promise<T> {
  if (!hasDatabase()) return fallback;
  try {
    return await run();
  } catch (err) {
    console.error("[store] query failed, serving seed data:", errorMessage(err));
    return fallback;
  }
}

/* ---------- categories ------------------------------------------------------ */
export async function getCategories(): Promise<Category[]> {
  return safe(async () => {
    const rows = await query<CategoryRow>(
      "select slug, title, description, image, blurb from categories order by position, title"
    );
    return rows.length ? rows.map(toCategory) : seedCategories.map(withAsset);
  }, seedCategories.map(withAsset));
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
  description, details, options, gallery, colours, is_featured, is_new`;

export async function getProducts(): Promise<Product[]> {
  return safe(async () => {
    const rows = await query<ProductRow>(
      `select ${productColumns} from products where active order by created_at, name`
    );
    return rows.length ? rows.map(toProduct) : seedProducts.map(withAsset);
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
    if (rows[0]) return toProduct(rows[0]);
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
};
type TierRow = {
  id: string;
  event: string;
  name: string;
  price: number;
  perks: string[];
  note: string | null;
};

export async function getEvents(): Promise<CollegeEvent[]> {
  return safe(async () => {
    const [rows, tiers] = await Promise.all([
      query<EventRow>(
        `select slug, title, subtitle, description, venue, city, starts_at, doors,
                image, tag, featured
           from events where published order by starts_at`
      ),
      query<TierRow>(
        "select id, event, name, price, perks, note from ticket_tiers order by event, position"
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
        image: asset(r.image),
        tag: r.tag ?? undefined,
        featured: r.featured,
        tiers: bySlug.get(r.slug) ?? [],
      }))
      .filter((e) => e.tiers.length > 0);
  }, seedEvents.map(withAsset));
}

/* ---------- misc ------------------------------------------------------------ */
export { searchChips, lkr };
export const lowestPrice = (e: CollegeEvent) =>
  e.tiers.reduce((min, t) => Math.min(min, t.price), Number.POSITIVE_INFINITY);
