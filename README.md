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

## Three ways to run it

| Where | Database | Command |
| --- | --- | --- |
| Local / StackBlitz / CodeSandbox | PGlite (embedded, zero setup) | `npm run dev` |
| Local with Postgres | your server | `DATABASE_URL=… npm run dev` |
| Vercel | hosted Postgres | `npm run build` |

## Database

`db/schema.sql` — categories, products, reviews, events, ticket_tiers, orders,
order_items, order_events, bookings, booking_items. Works on any Postgres 13+
(Neon, Supabase, Vercel Postgres, RDS, local).

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
`{ slug, qty }`.

## Project layout

```
app/                 routes (App Router) + API handlers
  layout.tsx         page shell, metadata, cart provider, chrome
  globals.css        Tailwind v4 theme + component primitives
components/          UI (client components) — navbar, footer, shop, checkout…
  context/           cart state
data/seed.ts         catalogue + events, also the DB seed source
db/schema.sql        Postgres schema
lib/                 db (postgres | PGlite), data access, orders, bookings, routing
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
