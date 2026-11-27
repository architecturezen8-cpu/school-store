# The Thomian Store

The official store for **St. Thomas' College Matale** — est. 1873 · *Animo et Fide*.

Next.js 16 (App Router) · React 19 · Tailwind CSS v4 · Postgres.

---

## Routes

| Route | What it is |
| --- | --- |
| `/` | Home — cinematic hero, collections, featured products, motto, reviews |
| `/shop` | Full catalogue with category filter + sorting |
| `/shop/[category]` | A single collection (e.g. `/shop/badges`) |
| `/product/[slug]` | Product detail — gallery, options, reviews |
| `/tickets` | Events, live countdowns and ticket booking |
| `/admin` | Store admin — the shelf, stocks, tickets, the gate, the tab icon |
| `/api/orders` | `POST` place an order |
| `/api/orders/[reference]` | `GET` track an order (needs `?email=`) |
| `/api/bookings` | `POST` reserve event tickets |

Old `#/shop`, `#/product/…` links still land on the right page.

## Local setup

```bash
npm install
npm run dev                    # http://localhost:3000
```

That is genuinely all: with no `DATABASE_URL` the app uses **PGlite** (Postgres
compiled to WASM, data in `.pglite/`), creates the schema and seeds the
catalogue on the first request. `npm run db:reset:embedded` wipes it.

To use a real Postgres instead:

```bash
cp .env.example .env.local     # set DATABASE_URL
npm run db:reset               # migrate + seed
```

Supabase specifically: **see [SUPABASE.md](SUPABASE.md)** — copy the session
pooler connection string into `DATABASE_URL` and the app reads your real
database. The schema and seed are already applied to the project this repo was
built against.

`STORE_BACKEND=none` switches to read-only seed data (no database at all).
`PGLITE_DIR=/some/path` moves the embedded database off `.pglite/` — useful when
building against a copy so a build never touches the database you are working in.

## Three ways to run it

| Where | Database | Command |
| --- | --- | --- |
| Local / StackBlitz / CodeSandbox | PGlite (embedded, zero setup) | `npm run dev` |
| Local with Postgres | your server | `DATABASE_URL=… npm run dev` |
| Vercel | hosted Postgres | `npm run build` |

## Database

`db/schema.sql` — categories, products, product_stock, reviews, events,
ticket_tiers, orders, order_items, order_events, bookings, booking_items. Works
on any Postgres 13+ (Neon, Supabase, Vercel Postgres, RDS, local).

```bash
npm run db:migrate   # apply db/schema.sql (idempotent)
npm run db:seed      # upsert catalogue from data/seed.ts
```

A database that is behind the app no longer has to be diagnosed from a terminal:
the admin shows a bar naming the missing table, with an **Update the database**
button that runs the same `db/schema.sql` — and fills an empty project with the
starter catalogue. The embedded database does this for itself on first boot.

Money is stored as whole LKR integers. Order totals, the delivery fee and ticket
availability are all computed **server-side** — the browser only ever sends
`{ slug, qty, colour, size }`.

### Stock

Stock is counted per **colour × size** in `product_stock` (one row per cell), and
per **seat** on ticket tiers (`capacity` minus `sold`). A product with no rows is
*not counted* — it sells freely and the shop prints no number — which is how the
whole catalogue behaved before stock existed, and is one save away at any time.

It is set in two places, both in the admin:

- on the product form (**Stock on the shelf**, one box per colour and size), so a
  new item arrives with its shelf;
- on **Stocks** (`/admin/stock`), which lists every product's shelf and every
  ticket tier's seat cap, and puts whatever is at five or fewer at the top.

The shop reads the same table: a card or product page says “Only N left”, a size
with none left is struck through, the quantity box cannot exceed the shelf, and
`POST /api/orders` re-checks and decrements it inside the transaction — two
parents can have the last medium in their bags, but only one can buy it. Ticket
tiers work the same way: the event page prints “N left”, and a booking over the
cap is refused rather than oversold.

## Project layout

```
app/                 routes (App Router) + API handlers
  layout.tsx         page shell, metadata, cart provider, chrome
  globals.css        Tailwind v4 theme + component primitives
components/          UI (client components) — navbar, footer, shop, checkout…
  context/           cart state
data/seed.ts         catalogue + events, also the DB seed source
db/schema.sql        Postgres schema
lib/                 db (postgres | PGlite), data access, orders, bookings, stock, routing
public/images/       product & hero photos
scripts/             db-migrate.mjs, db-seed.mjs, pglite-reset.mjs, build-pages.mjs
```

## StackBlitz

See `STACKBLITZ.md` — import the repo, wait for `npm install`, done. Use
`npm run dev:webpack` there: Turbopack (the default on a real machine) cannot run
its native binary in a WebContainer, and Tailwind needs `TAILWIND_ENGINE=wasm`.

## Deploy (Vercel)

1. Import the repo in Vercel; the branch with `next.config.ts` is enough — no build tweaks.
2. Add environment variables: `DATABASE_URL` and `NEXT_PUBLIC_SITE_URL`
   (e.g. `https://the-thomian-store.vercel.app`).
3. Point the database at your Postgres, then run `npm run db:migrate && npm run db:seed`
   locally against that `DATABASE_URL` (or from the Vercel CLI).

Server features that need a running server — order tracking, checkout,
bookings, on-demand rendering — work on Vercel. `NEXT_STATIC_EXPORT=1` produces a
static `out/` instead, but then the API routes are not deployed.
