/**
 * Seeds the catalogue, reviews and events from data/seed.ts.
 * Upserts, so it can be re-run after editing the seed file.
 *   npm run db:seed
 */
import path from "node:path";
import pg from "pg";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is not set. Add it to .env.local (see .env.example).");
  process.exit(1);
}

// data/seed.ts is plain TypeScript with no imports — run it through esbuild.
const { build } = await import("esbuild");
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
const isLocal = /(^|@)(localhost|127\.0\.0\.1)[:/]/.test(url) || url.includes("host=/");
const client = new pg.Client({
  connectionString: url,
  ssl: isLocal ? undefined : { rejectUnauthorized: false },
});

await client.connect();
try {
  await client.query("begin");

  for (const [i, c] of categories.entries()) {
    await client.query(
      `insert into categories (slug, title, description, image, blurb, position)
       values ($1, $2, $3, $4, $5, $6)
       on conflict (slug) do update set
         title = excluded.title, description = excluded.description,
         image = excluded.image, blurb = excluded.blurb, position = excluded.position`,
      [c.slug, c.title, c.desc, c.image, c.count, i]
    );
  }

  for (const p of products) {
    await client.query(
      `insert into products
         (slug, name, price, image, tag, category, rating, reviews, description,
          details, options, gallery, colours, is_featured, is_new)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
       on conflict (slug) do update set
         name = excluded.name, price = excluded.price, image = excluded.image,
         tag = excluded.tag, category = excluded.category, rating = excluded.rating,
         reviews = excluded.reviews, description = excluded.description,
         details = excluded.details, options = excluded.options, gallery = excluded.gallery,
         colours = excluded.colours, is_featured = excluded.is_featured,
         is_new = excluded.is_new`,
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
        JSON.stringify(p.details ?? []),
        p.options ? JSON.stringify(p.options) : null,
        JSON.stringify(p.gallery ?? []),
        JSON.stringify(p.colours ?? []),
        Boolean(p.isFeatured),
        Boolean(p.isNew),
      ]
    );
  }

  await client.query("delete from reviews");
  for (const [i, r] of reviews.entries()) {
    await client.query(
      "insert into reviews (name, role, body, rating, position) values ($1,$2,$3,$4,$5)",
      [r.name, r.role, r.text, r.rating, i]
    );
  }

  for (const e of events) {
    await client.query(
      `insert into events (slug, title, subtitle, description, venue, city, starts_at, doors, image, tag, featured)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
       on conflict (slug) do update set
         title = excluded.title, subtitle = excluded.subtitle, description = excluded.description,
         venue = excluded.venue, city = excluded.city, starts_at = excluded.starts_at,
         doors = excluded.doors, image = excluded.image, tag = excluded.tag,
         featured = excluded.featured`,
      [
        e.slug,
        e.title,
        e.subtitle,
        e.description,
        e.venue,
        e.city,
        e.date.toISOString(),
        e.doors,
        e.image,
        e.tag ?? null,
        Boolean(e.featured),
      ]
    );

    for (const [i, t] of e.tiers.entries()) {
      await client.query(
        `insert into ticket_tiers (id, event, name, price, perks, note, position)
         values ($1,$2,$3,$4,$5,$6,$7)
         on conflict (id) do update set
           event = excluded.event, name = excluded.name, price = excluded.price,
           perks = excluded.perks, note = excluded.note, position = excluded.position`,
        [t.id, e.slug, t.name, t.price, JSON.stringify(t.perks), t.note ?? null, i]
      );
    }
  }

  await client.query("commit");
  console.log(
    `✓ seeded ${categories.length} categories, ${products.length} products, ${reviews.length} reviews, ${events.length} events`
  );
} catch (err) {
  await client.query("rollback");
  console.error("seed failed:", err.message);
  process.exitCode = 1;
} finally {
  await client.end();
}
