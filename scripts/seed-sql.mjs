/**
 * Turns data/seed.ts into a single idempotent SQL script.
 *
 * Used when the database can only be reached through the Supabase connector
 * (SQL execution API) rather than a Postgres connection string:
 *
 *   node scripts/seed-sql.mjs > /tmp/seed.sql
 */
import path from "node:path";
import { build } from "esbuild";

const bundle = await build({
  entryPoints: [path.join(process.cwd(), "data", "seed.ts")],
  bundle: true,
  format: "esm",
  write: false,
  platform: "node",
  target: "node20",
});
const mod = await import(
  "data:text/javascript;base64," + Buffer.from(bundle.outputFiles[0].text).toString("base64")
);
const { categories, products, reviews, events } = mod;

/** Postgres literal for a JS value. */
function lit(v) {
  if (v === null || v === undefined) return "null";
  if (typeof v === "number") return String(v);
  if (typeof v === "boolean") return v ? "true" : "false";
  if (v instanceof Date) return `'${v.toISOString()}'`;
  if (typeof v === "object") return `${lit(JSON.stringify(v))}::jsonb`;
  return `'${String(v).replace(/'/g, "''")}'`;
}

const out = ["begin;"];

out.push("-- categories");
for (const [i, c] of categories.entries()) {
  out.push(
    `insert into categories (slug, title, description, image, blurb, position) values (` +
      [c.slug, c.title, c.desc, c.image, c.count, i].map(lit).join(", ") +
      `) on conflict (slug) do update set title = excluded.title, description = excluded.description, image = excluded.image, blurb = excluded.blurb, position = excluded.position;`
  );
}

out.push("-- products");
for (const p of products) {
  out.push(
    `insert into products (slug, name, price, image, tag, category, rating, reviews, description, details, options, gallery, colours, is_featured, is_new) values (` +
      [
        p.slug,
        p.name,
        p.price,
        p.image,
        p.tag ?? null,
        p.category,
        p.rating,
        p.reviews,
        p.description,
        p.details ?? [],
        p.options ?? null,
        p.gallery ?? [],
        p.colours ?? [],
        Boolean(p.isFeatured),
        Boolean(p.isNew),
      ]
        .map(lit)
        .join(", ") +
      `) on conflict (slug) do update set name = excluded.name, price = excluded.price, image = excluded.image, tag = excluded.tag, category = excluded.category, rating = excluded.rating, reviews = excluded.reviews, description = excluded.description, details = excluded.details, options = excluded.options, gallery = excluded.gallery, colours = excluded.colours, is_featured = excluded.is_featured, is_new = excluded.is_new;`
  );
}

out.push("-- reviews");
out.push("delete from reviews;");
for (const [i, r] of reviews.entries()) {
  out.push(
    `insert into reviews (name, role, body, rating, position) values (` +
      [r.name, r.role, r.text, r.rating, i].map(lit).join(", ") +
      ");"
  );
}

out.push("-- events");
for (const e of events) {
  out.push(
    `insert into events (slug, title, subtitle, description, venue, city, starts_at, doors, image, tag, featured) values (` +
      [
        e.slug,
        e.title,
        e.subtitle,
        e.description,
        e.venue,
        e.city,
        e.date,
        e.doors,
        e.image,
        e.tag ?? null,
        Boolean(e.featured),
      ]
        .map(lit)
        .join(", ") +
      `) on conflict (slug) do update set title = excluded.title, subtitle = excluded.subtitle, description = excluded.description, venue = excluded.venue, city = excluded.city, starts_at = excluded.starts_at, doors = excluded.doors, image = excluded.image, tag = excluded.tag, featured = excluded.featured;`
  );

  for (const [i, t] of e.tiers.entries()) {
    out.push(
      `insert into ticket_tiers (id, event, name, price, perks, note, position) values (` +
        [t.id, e.slug, t.name, t.price, t.perks ?? [], t.note ?? null, i].map(lit).join(", ") +
        `) on conflict (id) do update set event = excluded.event, name = excluded.name, price = excluded.price, perks = excluded.perks, note = excluded.note, position = excluded.position;`
    );
  }
}

out.push("commit;");
process.stdout.write(out.join("\n") + "\n");
