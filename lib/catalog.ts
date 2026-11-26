import { hasDatabase, query, schemaFailure } from "./db";
import { errorMessage } from "./errors";
import { slugify } from "./slug";
import { categories as seedCategories, products as seedProducts } from "@/data/seed";

/**
 * The shop's own admin: categories, products, and the vocabulary the filters use.
 *
 * Everything here writes. The storefront's readers live in `lib/store.ts` and
 * fall back to the seed catalogue when there is no database; these do not, because
 * an admin screen that silently "saves" into a fallback is worse than one that
 * refuses to open.
 */

/* ------------------------------------------------------------------ *\
 *  Types
\* ------------------------------------------------------------------ */

export type AdminCategory = {
  slug: string;
  title: string;
  description: string;
  image: string;
  /** A line of copy under the title. Not a count — the shop counts items. */
  blurb: string;
  position: number;
  /** How many live products sit in it. */
  items: number;
};

export type AdminProduct = {
  slug: string;
  name: string;
  price: number;
  image: string;
  tag: string;
  category: string;
  rating: number;
  reviews: number;
  description: string;
  details: string[];
  options: { label: string; values: string[] } | null;
  gallery: string[];
  colours: string[];
  isFeatured: boolean;
  isNew: boolean;
  active: boolean;
};

export type ProductDraft = Omit<AdminProduct, "slug" | "active"> & {
  slug: string;
  active: boolean;
};

export type CategoryDraft = {
  slug: string;
  title: string;
  description: string;
  image: string;
  blurb: string;
};

export type ShopFilter = {
  id: string;
  kind: "colour" | "size";
  label: string;
  /** '#1b2b55' for a colour; empty for a size. */
  swatch: string;
  position: number;
  isActive: boolean;
};

export type SaveResult<T = undefined> =
  | ({ ok: true } & (T extends undefined ? { slug?: string } : { slug: string }))
  | { ok: false; error: string };

/* ------------------------------------------------------------------ *\
 *  Reading, when the database is behind the app
\* ------------------------------------------------------------------ */

/**
 * Read, or fall back to the built-in catalogue.
 *
 * These are the admin's *read* paths, and they used to throw. A database one
 * migration behind the app — the case that reaches the office as "SOMETHING
 * BROKE" on the new-product screen — took the whole page into the error
 * boundary, because `shop_filters` did not exist yet. An admin cannot act on a
 * crash. It can act on a shelf of its own catalogue with a banner that names the
 * missing table and offers the one button that fixes it.
 *
 * Writes are deliberately *not* wrapped: a save that quietly failed against a
 * fallback would be worse than the crash.
 */
async function readOr<T>(fallback: T, fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    // Only the "database is behind" case falls back. A connection failure is
    // already reported by the admin's own banner, and pretending to have rows
    // then would be the lie that banner exists to prevent.
    if (!schemaFailure()) throw err;
    console.warn("[catalog] serving the built-in catalogue:", errorMessage(err));
    return fallback;
  }
}

/** The seed catalogue, shaped like the admin's rows. */
function seedAdminCategories(): AdminCategory[] {
  return seedCategories.map((c, i) => ({
    slug: c.slug,
    title: c.title,
    description: c.desc,
    image: c.image,
    blurb: c.count,
    position: i,
    items: seedProducts.filter((p) => p.category === c.slug).length,
  }));
}

function seedAdminProducts(): AdminProduct[] {
  return seedProducts.map((p) => ({
    slug: p.slug,
    name: p.name,
    price: p.price,
    image: p.image,
    tag: p.tag ?? "",
    category: p.category,
    rating: p.rating,
    reviews: p.reviews,
    description: p.description,
    details: p.details,
    options: p.options ?? null,
    gallery: p.gallery ?? [],
    colours: p.colours ?? [],
    isFeatured: Boolean(p.isFeatured),
    isNew: Boolean(p.isNew),
    active: true,
  }));
}

/* ------------------------------------------------------------------ *\
 *  Categories
\* ------------------------------------------------------------------ */

type CategoryRow = {
  slug: string;
  title: string;
  description: string;
  image: string;
  blurb: string;
  position: number;
  items: number;
};

export async function listAdminCategories(): Promise<AdminCategory[]> {
  const rows = await readOr<CategoryRow[] | null>(null, () =>
    query<CategoryRow>(
      `select c.slug, c.title, c.description, c.image, c.blurb, c.position,
              (select count(*) from products p where p.category = c.slug and p.active)::int as items
         from categories c
        order by c.position, c.title`
    )
  );
  if (!rows) return seedAdminCategories();
  return rows.map((r) => ({ ...r, position: Number(r.position), items: Number(r.items) }));
}

export async function getAdminCategory(slug: string): Promise<AdminCategory | undefined> {
  const all = await listAdminCategories();
  return all.find((c) => c.slug === slug);
}

export async function saveCategory(
  draft: CategoryDraft,
  mode: "create" | "update"
): Promise<{ ok: true; slug: string } | { ok: false; error: string }> {
  const title = draft.title.trim();
  if (!title) return { ok: false, error: "A category needs a name." };

  const slug = mode === "create" ? slugify(draft.slug || title) : draft.slug;
  if (!slug) return { ok: false, error: "That name has no letters an address can be built from." };

  try {
    if (mode === "create") {
      const clash = await query("select 1 from categories where slug = $1", [slug]);
      if (clash.length) {
        return { ok: false, error: `There is already a category at “${slug}”.` };
      }
      const next = await query<{ n: number }>(
        "select coalesce(max(position), -1)::int + 1 as n from categories"
      );
      await query(
        `insert into categories (slug, title, description, image, blurb, position)
         values ($1, $2, $3, $4, $5, $6)`,
        [slug, title, draft.description.trim(), draft.image.trim(), draft.blurb.trim(), next[0]?.n ?? 0]
      );
    } else {
      await query(
        `update categories
            set title = $2, description = $3, image = $4, blurb = $5
          where slug = $1`,
        [slug, title, draft.description.trim(), draft.image.trim(), draft.blurb.trim()]
      );
    }
    return { ok: true, slug };
  } catch (err) {
    return { ok: false, error: errorMessage(err) };
  }
}

/**
 * Deletes a category only when it is empty.
 *
 * `products.category` is `on delete restrict`, so the database would refuse
 * anyway — but a foreign-key violation is not an answer an admin can act on.
 * Counting first lets the page say "move its 4 products first" instead.
 */
export async function deleteCategory(
  slug: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const used = await query<{ n: number }>(
    "select count(*)::int as n from products where category = $1",
    [slug]
  );
  const n = Number(used[0]?.n ?? 0);
  if (n) {
    return {
      ok: false,
      error: `“${slug}” still holds ${n} product${n === 1 ? "" : "s"}. Move ${n === 1 ? "it" : "them"} to another category first.`,
    };
  }
  try {
    await query("delete from categories where slug = $1", [slug]);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: errorMessage(err) };
  }
}

/* ------------------------------------------------------------------ *\
 *  Products
\* ------------------------------------------------------------------ */

type ProductRow = {
  slug: string;
  name: string;
  price: number;
  image: string;
  tag: string | null;
  category: string;
  rating: string | number;
  reviews: number;
  description: string;
  details: unknown;
  options: unknown;
  gallery: unknown;
  colours: unknown;
  is_featured: boolean;
  is_new: boolean;
  active: boolean;
};

const toProduct = (r: ProductRow): AdminProduct => ({
  slug: r.slug,
  name: r.name,
  price: Number(r.price),
  image: r.image,
  tag: r.tag ?? "",
  category: r.category,
  rating: Number(r.rating),
  reviews: Number(r.reviews),
  description: r.description,
  details: asStrings(r.details),
  options: asOptions(r.options),
  gallery: asStrings(r.gallery),
  colours: asStrings(r.colours),
  isFeatured: r.is_featured,
  isNew: r.is_new,
  active: r.active,
});

function asStrings(value: unknown): string[] {
  const raw = typeof value === "string" ? safeJson(value) : value;
  return Array.isArray(raw) ? raw.map((v) => String(v).trim()).filter(Boolean) : [];
}

function asOptions(value: unknown): { label: string; values: string[] } | null {
  const raw = typeof value === "string" ? safeJson(value) : value;
  if (!raw || typeof raw !== "object") return null;
  const label = String((raw as { label?: unknown }).label ?? "").trim();
  const values = asStrings((raw as { values?: unknown }).values);
  return label && values.length ? { label, values } : null;
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return [];
  }
}

export async function listAdminProducts(): Promise<AdminProduct[]> {
  const rows = await readOr<ProductRow[] | null>(null, () =>
    query<ProductRow>(
      `select slug, name, price, image, tag, category, rating, reviews, description,
              details, options, gallery, colours, is_featured, is_new, active
         from products
        order by category, name`
    )
  );
  return rows ? rows.map(toProduct) : seedAdminProducts();
}

export async function getAdminProduct(slug: string): Promise<AdminProduct | undefined> {
  const rows = await readOr<ProductRow[] | null>(null, () =>
    query<ProductRow>(
      `select slug, name, price, image, tag, category, rating, reviews, description,
              details, options, gallery, colours, is_featured, is_new, active
         from products where slug = $1`,
      [slug]
    )
  );
  if (!rows) return seedAdminProducts().find((p) => p.slug === slug);
  return rows[0] ? toProduct(rows[0]) : undefined;
}

export async function saveProduct(
  draft: ProductDraft,
  mode: "create" | "update"
): Promise<{ ok: true; slug: string } | { ok: false; error: string }> {
  const name = draft.name.trim();
  if (!name) return { ok: false, error: "A product needs a name." };
  const price = Math.round(Number(draft.price));
  if (!Number.isFinite(price) || price < 0) {
    return { ok: false, error: "The price has to be a whole number of rupees." };
  }
  if (!draft.category) return { ok: false, error: "Choose a category." };

  // The slug is the product's identity in every order ever placed, so it is
  // chosen once and then fixed — renaming it would orphan the order history.
  const slug = mode === "create" ? slugify(draft.slug || name) : draft.slug;
  if (!slug) return { ok: false, error: "That name has no letters an address can be built from." };

  const cols = [
    name,
    price,
    draft.image.trim(),
    draft.tag.trim(),
    draft.category,
    Math.max(0, Math.min(5, Number(draft.rating) || 0)),
    Math.max(0, Math.round(Number(draft.reviews) || 0)),
    draft.description.trim(),
    JSON.stringify(draft.details.map((d) => d.trim()).filter(Boolean)),
    draft.options && draft.options.values.length && draft.options.label.trim()
      ? JSON.stringify({
          label: draft.options.label.trim(),
          values: draft.options.values.map((v) => v.trim()).filter(Boolean),
        })
      : null,
    JSON.stringify(draft.gallery.map((g) => g.trim()).filter(Boolean)),
    JSON.stringify(draft.colours.map((c) => c.trim()).filter(Boolean)),
    Boolean(draft.isFeatured),
    Boolean(draft.isNew),
    Boolean(draft.active),
  ];

  try {
    if (mode === "create") {
      const clash = await query("select 1 from products where slug = $1", [slug]);
      if (clash.length) return { ok: false, error: `There is already a product at “${slug}”.` };
      await query(
        `insert into products
           (name, price, image, tag, category, rating, reviews, description, details,
            options, gallery, colours, is_featured, is_new, active, slug)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)`,
        [...cols, slug]
      );
    } else {
      await query(
        `update products set
           name = $2, price = $3, image = $4, tag = $5, category = $6, rating = $7,
           reviews = $8, description = $9, details = $10, options = $11, gallery = $12,
           colours = $13, is_featured = $14, is_new = $15, active = $16
         where slug = $1`,
        [slug, ...cols]
      );
    }
    return { ok: true, slug };
  } catch (err) {
    return { ok: false, error: errorMessage(err) };
  }
}

export async function setProductActive(
  slug: string,
  active: boolean
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    await query("update products set active = $2 where slug = $1", [slug, active]);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: errorMessage(err) };
  }
}

/**
 * Removes a product from the shop — and from the database, if it never sold.
 *
 * `order_items.slug` is `on delete restrict`, because an order that pointed at a
 * product nobody can look up any more is an order the office cannot explain. So a
 * product that has sold is archived (hidden, still readable from its order) and
 * one that has not is deleted outright. The page says which happened.
 */
export async function deleteProduct(
  slug: string
): Promise<{ ok: true; archived: boolean } | { ok: false; error: string }> {
  const sold = await query<{ n: number }>(
    "select count(*)::int as n from order_items where slug = $1",
    [slug]
  );
  if (Number(sold[0]?.n ?? 0) > 0) {
    try {
      await query("update products set active = false where slug = $1", [slug]);
      return { ok: true, archived: true };
    } catch (err) {
      return { ok: false, error: errorMessage(err) };
    }
  }
  try {
    await query("delete from products where slug = $1", [slug]);
    return { ok: true, archived: false };
  } catch (err) {
    return { ok: false, error: errorMessage(err) };
  }
}

/* ------------------------------------------------------------------ *\
 *  Filters
\* ------------------------------------------------------------------ */

/**
 * What is wrong with a product, in the terms the shop uses.
 *
 * The catalogue shipped with badges that offered a colour and a mug filed under
 * clothing, and neither was visible anywhere in the admin — the office found out
 * from a customer. These are the same checks, said out loud next to the product.
 * They are advice, not rules: none of them blocks a save.
 */
export function productWarnings(
  product: AdminProduct,
  categories: AdminCategory[]
): string[] {
  const out: string[] = [];
  const category = categories.find((c) => c.slug === product.category);
  const kind = `${category?.title ?? product.category}`.toLowerCase();

  if (!product.image.trim()) out.push("no picture");
  if (product.price <= 0) out.push("no price");
  if (!product.description.trim()) out.push("no description");
  // A badge is one piece of metal; a badge with a colour picker is a choice the
  // school cannot actually fulfil.
  if (/badge/.test(kind) && product.colours.length) out.push("a badge has no colours");
  // A shirt with no sizes is a guessing game at the counter. Deliberately narrow:
  // a tie, a scarf and a cap are one size, and warning about them is noise.
  const sized = /shirt|tee|hoodie|blazer|polo|uniform/i.test(product.name);
  if (sized && !product.options && !/one size/i.test(product.details.join(" "))) {
    out.push("clothing with no size");
  }
  if (product.options && !product.options.values.length) out.push("an option with no values");
  if (product.gallery.length && !product.image.trim()) out.push("a gallery but no main picture");
  return out;
}

/**
 * The filters the shop ships with, used when no database is configured.
 *
 * The same list the schema seeds. A fallback shop with no filter chips would be a
 * different shop from the one with a database, and that difference is exactly the
 * kind of thing nobody notices until a deploy.
 */
export const DEFAULT_FILTERS: { kind: "colour" | "size"; label: string; swatch: string }[] = [
  { kind: "colour", label: "Navy", swatch: "#1b2b55" },
  { kind: "colour", label: "Black", swatch: "#15171a" },
  { kind: "colour", label: "White", swatch: "#f4f2ec" },
  { kind: "colour", label: "Grey", swatch: "#8b9099" },
  { kind: "colour", label: "Maroon", swatch: "#6d1f2e" },
  { kind: "colour", label: "Sky", swatch: "#a9c6e8" },
  { kind: "size", label: "S", swatch: "" },
  { kind: "size", label: "M", swatch: "" },
  { kind: "size", label: "L", swatch: "" },
  { kind: "size", label: "XL", swatch: "" },
  { kind: "size", label: "XXL", swatch: "" },
  { kind: "size", label: "32", swatch: "" },
  { kind: "size", label: "34", swatch: "" },
  { kind: "size", label: "36", swatch: "" },
  { kind: "size", label: "38", swatch: "" },
  { kind: "size", label: "40", swatch: "" },
  { kind: "size", label: "42", swatch: "" },
  { kind: "size", label: "44", swatch: "" },
  { kind: "size", label: "46", swatch: "" },
];

/** Every filter, hidden ones too — the admin needs those. */
export async function listFilters(): Promise<ShopFilter[]> {
  const rows = await readOr<
    { id: string; kind: "colour" | "size"; label: string; swatch: string; position: number; is_active: boolean }[] | null
  >(null, () =>
    query<{
      id: string;
      kind: "colour" | "size";
      label: string;
      swatch: string;
      position: number;
      is_active: boolean;
    }>(`select id, kind, label, swatch, position, is_active from shop_filters order by kind, position, label`)
  );
  // No table yet: the chips the shop ships with, so the editor still opens.
  if (!rows) {
    return DEFAULT_FILTERS.map((f, i) => ({
      id: `builtin-${f.kind}-${i}`,
      kind: f.kind,
      label: f.label,
      swatch: f.swatch,
      position: i,
      isActive: true,
    }));
  }
  return rows.map((r) => ({
    id: r.id,
    kind: r.kind,
    label: r.label,
    swatch: r.swatch,
    position: Number(r.position),
    isActive: r.is_active,
  }));
}

export async function saveFilter(input: {
  id?: string;
  kind: "colour" | "size";
  label: string;
  swatch: string;
  isActive: boolean;
}): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const label = input.label.trim();
  if (!label) return { ok: false, error: "A filter needs a word on it." };
  const kind = input.kind === "size" ? "size" : "colour";
  const swatch = kind === "colour" ? (input.swatch.trim() || "#8b9099") : "";

  try {
    if (input.id) {
      await query(
        `update shop_filters set kind = $2, label = $3, swatch = $4, is_active = $5 where id = $1`,
        [input.id, kind, label, swatch, input.isActive]
      );
      return { ok: true, id: input.id };
    }
    const next = await query<{ n: number }>(
      "select coalesce(max(position), -1)::int + 1 as n from shop_filters where kind = $1",
      [kind]
    );
    const rows = await query<{ id: string }>(
      `insert into shop_filters (kind, label, swatch, position, is_active)
       values ($1, $2, $3, $4, $5)
       on conflict (kind, label) do update set swatch = excluded.swatch, is_active = true
       returning id`,
      [kind, label, swatch, next[0]?.n ?? 0, input.isActive]
    );
    return { ok: true, id: rows[0]?.id ?? "" };
  } catch (err) {
    return { ok: false, error: errorMessage(err) };
  }
}

export async function deleteFilter(id: string): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    await query("delete from shop_filters where id = $1", [id]);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: errorMessage(err) };
  }
}

/** Moves a chip one place along its own row, by swapping positions. */
export async function moveFilter(
  id: string,
  direction: -1 | 1
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const row = await query<{ kind: string; position: number }>(
      "select kind, position from shop_filters where id = $1",
      [id]
    );
    if (!row[0]) return { ok: false, error: "That filter no longer exists." };
    const { kind, position } = row[0];
    const neighbour = await query<{ id: string; position: number }>(
      `select id, position from shop_filters
        where kind = $1 and position ${direction === -1 ? "<" : ">"} $2
        order by position ${direction === -1 ? "desc" : "asc"}
        limit 1`,
      [kind, position]
    );
    if (!neighbour[0]) return { ok: true }; // already at the end
    await query("update shop_filters set position = $2 where id = $1", [neighbour[0].id, position]);
    await query("update shop_filters set position = $2 where id = $1", [id, neighbour[0].position]);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: errorMessage(err) };
  }
}
