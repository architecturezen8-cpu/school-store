# The Thomian Store — connecting to Supabase

The store talks to Postgres directly through `DATABASE_URL` (plain `pg`, no
Supabase SDK), so nothing in the code knows about Supabase. Anything that is
configured is configured with one connection string.

---

## 1. Get the connection string

Supabase dashboard → your project **school shop** → **Connect** → **Session
pooler** → port **5432**.

It looks like this (the password is the one you set when the project was
created):

```
postgresql://postgres.pkhonlhtzdnbbutruens:YOUR-PASSWORD@aws-0-ap-northeast-2.pooler.supabase.com:5432/postgres
```

Use the **Session pooler**, not "Direct connection": the direct host
(`db.<ref>.supabase.co`) is IPv6-only, and on many home/school networks that
resolves but never connects.

If you have forgotten the password: **Settings → Database → Reset database
password**, then paste the new one into the URL.

## 2. Point the app at it

```bash
cp .env.example .env.local
```

Then in `.env.local`:

```bash
DATABASE_URL="postgresql://postgres.pkhonlhtzdnbbutruens:YOUR-PASSWORD@aws-0-ap-northeast-2.pooler.supabase.com:5432/postgres"
```

No other keys are needed — the app does not use the Supabase JS client, anon
keys, or Row Level Security policies.

## 3. Check it actually connected

```bash
npm run db:check
```

One command that answers "is the site talking to my database?". It prints the
backend it would use, connects, verifies all 10 tables exist, counts the rows,
runs the storefront's product query, and writes a real order (then rolls it
back) — because a read-only check can pass while checkout is still broken.

All check marks:

```
── Connection ───────────────────────────────────────
  ✓ DATABASE_URL is set → aws-0-ap-northeast-2.pooler.supabase.com:5432/postgres (real Postgres)
  ✓ connected to "postgres"
── Does the store's schema exist? ────────────────────
  ✓ all 10 tables are present
── Is there data to show? ────────────────────────────
  ✓ products       17 rows
...
Everything above is check marks → the site is live on this database.
```

If it exits with `DATABASE_URL is not set`, the app is running on the embedded
PGlite database instead — the connection string is missing from `.env.local`.

## 4. Run

```bash
npm install
npm run dev
```

Open <http://localhost:3000>. Everything you see (17 products, 5 categories,
5 events, 12 ticket tiers, 4 reviews) is read from Supabase at request time.

### Proving it in the browser, not just in the terminal

`npm run db:check` proves the app *can* read and write. To prove the running
site *is* using your database, change one row in Supabase and watch the page
follow:

1. Supabase → **Table Editor** → `products` → edit any `name` (e.g. add
   "TEST" to the end of a product) and save.
2. Refresh <http://localhost:3000/shop>. The new name is there.
3. Change it back.

If the page shows the edit, the storefront is reading your database. If it
does not, the app is on the embedded PGlite database — re-check `.env.local`
and restart `npm run dev` (env vars are read at startup).

You can confirm the other direction from the terminal: after placing an order,
`orders` in the Table Editor has a new row with a `STC-…` reference, and
"Track my order" on the home page finds it by reference + email.

---

## What is already set up in this project

| Thing | State |
| --- | --- |
| Schema (`db/schema.sql`) | applied — 10 tables + `order_number_seq`, `set_updated_at()`, `orders_touch_updated_at` |
| Seed data | applied — 5 categories, 17 products, 4 reviews, 5 events, 12 tiers |
| Orders / bookings | empty and ready; references start at `STC-01042` |
| Row Level Security | on, **no policies** — the table owner (`postgres`) bypasses it, and only the server connects with that credential. Keep it this way: the tables are never exposed through the Supabase REST API. |

Re-running either script is safe — they upsert:

```bash
npm run db:migrate   # db/schema.sql  (idempotent)
npm run db:seed      # data/seed.ts   (upserts, re-reads reviews)
```

`data/seed.ts` is the single source of truth for the catalogue. Edit it, run
`npm run db:seed`, and both the storefront and the database follow.

---

## The old app's data is still there

Your project previously held a different school-shop app (13 tables: `users`,
`orders`, `product_variants`, `homepage_config`, …). Nothing was deleted — that
schema and its 26 products / 169 variants / 8 reviews were moved, intact, into a
schema called **`legacy_shop`**. `public` now contains only the store's tables.

To look at it:

```sql
select table_name from information_schema.tables where table_schema = 'legacy_shop';
select * from legacy_shop.products limit 10;
```

Once you are satisfied you do not need it:

```sql
drop schema legacy_shop cascade;
```

That is the only destructive step in the whole migration, and it is yours to
take — nothing else depends on it.

---

## Tuning (optional)

`lib/db.ts` opens a pool of 5 connections with an 8 s connect timeout. On the
free Supabase plan with the session pooler that is plenty for a school store; if
you later put it behind heavier traffic, lower `max` rather than raise it — the
pooler multiplexes for you.

`STORE_BACKEND=pglite` runs the same app against an embedded Postgres in WASM
(no network, no Supabase) — useful for a demo laptop. `STORE_BACKEND=none`
serves the seed catalogue read-only.
