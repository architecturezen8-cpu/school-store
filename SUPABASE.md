# The Thomian Store — connecting to Supabase

The store talks to Postgres directly through `DATABASE_URL` (plain `pg`, no
Supabase SDK), so nothing in the code knows about Supabase. Anything that is
configured is configured with one connection string.

---

## 1. Get the connection string

Supabase dashboard → your project **school shop** → **Connect** → **Session
pooler** → port **5432**.

The dashboard offers you `postgres` in that dialog. **Replace the username** with
the app's own role and keep the rest:

```
postgresql://thomian_app.pkhonlhtzdnbbutruens:YOUR-PASSWORD@aws-0-ap-northeast-2.pooler.supabase.com:5432/postgres
```

Use the **Session pooler**, not "Direct connection": the direct host
(`db.<ref>.supabase.co`) is IPv6-only, and on many home/school networks that
resolves but never connects.

Forgotten the password? Don't reset `postgres` — see *Why not the `postgres`
role?* under step 2. Set a new one on the app role instead, from the SQL Editor:

```sql
alter role thomian_app with password 'your-new-password';
```

Then paste it into the URL above.

### The one password you need

Everything above needs the app role's password, and it is the only value in this
document that is not copy-pasteable from the dashboard. If you do not have it,
set a new one — **do not reset the `postgres` role**, other things may use it:

```sql
-- Supabase dashboard -> SQL Editor
alter role thomian_app with password 'your-new-password';
```

Then paste it into the URL. Nothing else needs creating: the role already has
`SELECT/INSERT/UPDATE/DELETE` on all twelve tables, the schema is applied, and
the storefront has events and products in it.

Check the whole thing with one command before starting the app:

```bash
npm run db:check
```

It prints the host it resolved, the tables it can read and the columns each one
is missing — so a stale schema is a sentence, not a mystery.

## 2. Point the app at it

```bash
cp .env.example .env.local
```

Then in `.env.local`:

```bash
DATABASE_URL="postgresql://thomian_app.pkhonlhtzdnbbutruens:YOUR-PASSWORD@aws-0-ap-northeast-2.pooler.supabase.com:5432/postgres"
```

For the project this repo was built against, log in as the dedicated
**`thomian_app`** role (see below) rather than `postgres`. The username in the
pooler URL is `<role>.<project-ref>`.

No other keys are needed — the app does not use the Supabase JS client, anon
keys, or Row Level Security policies.

### If you see `getaddrinfo ENOTFOUND base`

That error means the driver could not find a host called **`base`** — which is
its default when it cannot parse the string at all. It is a typo in
`DATABASE_URL`, not a network problem. The two usual causes:

| Symptom | Cause | Fix |
| --- | --- | --- |
| `ENOTFOUND base` | the `postgresql://` prefix is missing | the value must start with `postgresql://` — exactly `postgresql://`, not `postgres:` |
| `ENOTFOUND base` | the password contains `@` | an `@` splits the URL in two; use a password without `@ : / # ? ` or a space |
| `unparseable connection string` | the password contains `#`, `?` or `/` | same — change the password |

### Percent-encoding a password (when you must keep the symbols)

A password containing `@ : / # ?` can still be used — encode those characters in
the URL only. The database stores the raw password; the URL carries the encoded
form, and the driver decodes it before authenticating.

```
password:  Matale@1873Store
in the URL: Matale%401873Store
```

| character | in the URL |
| --- | --- |
| `@` | `%40` |
| `:` | `%3A` |
| `/` | `%2F` |
| `#` | `%23` |
| `?` | `%3F` |
| space | `%20` |

Full example:

```
DATABASE_URL="postgresql://thomian_app.pkhonlhtzdnbbutruens:Matale%401873Store@aws-0-ap-northeast-2.pooler.supabase.com:5432/postgres"
```

Only the password part is encoded — leave the `@` that separates the password
from the host exactly as it is. Verified end to end against a real PostgreSQL
with a role whose password contains `@`: the encoded URL logs in, reads all 12
ticket tiers and writes an order.

Encode with one command instead of by hand:

```bash
node -e "console.log(encodeURIComponent(process.argv[1]))" 'Matale@1873Store'
```

---

`npm run db:check` now names the exact problem instead of letting the driver fall
back to `base`, so run that first. Setting a clean password avoids the whole
class of failure:

```sql
alter role thomian_app with password 'Matale1873Store';
```

Letters and digits only. Then update `.env.local` to match, and re-run
`npm run db:check`.

### Why not the `postgres` role?

Supabase's `postgres` role has `CREATEROLE` but is **not** a superuser, and since
PostgreSQL 16 an unprivileged role cannot change the password of a privileged
one. So both of these fail:

```
alter user postgres with password '…';
→ ERROR 42501: permission denied to alter role
   DETAIL: Only superusers can alter privileged roles.
```

and the dashboard's **Reset database password** button needs the database to be
restarted, which is why it can appear to do nothing.

The dedicated role sidesteps all of it — it is a normal role, so its own owner
can set its password at any time with no superuser involved:

```sql
alter role thomian_app with password 'your-new-password';
```

It was created as: `login`, **not** superuser, **not** `createrole`, and
`bypassrls` (required — Row Level Security is enabled on every table with no
policies, so without it the storefront would read zero products). It holds
`select/insert/update/delete` on all twelve tables (verified: 12 of 12) and `usage/select` on the
sequences, plus matching default privileges for any table added later.

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
| Schema (`db/schema.sql`) | applied — 11 tables (including `product_stock`) + `order_number_seq`, `set_updated_at()`, `orders_touch_updated_at` |
| Seed data | applied — 5 categories, 17 products, 4 reviews, 5 events, 12 tiers |
| Orders / bookings | empty and ready; references start at `STC-01042` |
| Row Level Security | on, **no policies** — the table owner (`postgres`) bypasses it, and only the server connects with that credential. Keep it this way: the tables are never exposed through the Supabase REST API. |

Re-running either script is safe — they upsert:

```bash
npm run db:migrate   # db/schema.sql  (idempotent)
npm run db:seed      # data/seed.ts   (upserts, re-reads reviews)
```

### After pulling new code, run `db:migrate`

This catches people out, so it is worth saying plainly. New versions add
columns, and a database that was set up before the version existed does not
have them. The symptom is the build printing, over and over:

```
[store] query failed, serving seed data: column "tagline" does not exist
```

That means the shop is rendering `data/seed.ts` instead of your database — the
products and prices on the deployed site are the demo ones. The build used to
exit 0 anyway and publish it; now `npm run build` stops with that error in one
line instead of a hundred. Either way the fix is the same:

```bash
npm run db:migrate
```

and if the tables are empty as well, `npm run db:seed` after it. `npm run
db:check` tells you which of the two it is, including the exact column that is
missing.

**You do not have to reach a terminal for this.** A database that is behind the
app now says so itself, in a gold bar across the top of the admin:

> The database is older than this version of the store: the “shop_filters”
> table is not there yet. …

and the button next to it — **Update the database** — sends exactly the file
`npm run db:migrate` sends. Every statement in it is idempotent, so it is safe to
press twice, safe on a database that is already current, and it fills an empty
project with the starter catalogue the way the embedded database fills itself.

Two things changed because this used to be much worse than the sentence above
suggests:

- A missing table is **not** treated as an outage any more. It used to latch the
  whole process as "the database is down", so one table behind ate every screen
  and every later query until a restart.
- The admin's own error boundary now sits *inside* the admin layout, so a screen
  that throws still leaves the sidebar and that bar on screen — the one place
  that explains the problem used to be the part that was hidden.

### Stock and the tab icon are migrations too

Two of the settings the office uses most live in tables that arrived later than
the rest:

| Thing | Where it lives | What a database without it does |
| --- | --- | --- |
| Stock per colour and size | `product_stock` (one row per cell) | the **Stocks** screen shows every product as “not counted”, and the product form saves everything except the shelf |
| The browser tab icon | `site_settings.favicon` | the tab keeps the built-in mark; the school logo still loads, because that column is read separately |
| Which colour and size an order line bought | `order_items.colour`, `order_items.size` | older orders still list, with an empty variant |
| Seat caps per ticket tier | `ticket_tiers.capacity`, `ticket_tiers.sold` | the event page shows no “N left”, and the Stocks screen says “no cap” |
| The colours a product is sold in | `products.colours` | the product form still saves, but the shop shows no colour chips |

None of these break a page: the admin opens, the banner names what is missing, and
**Update the database** (or `npm run db:migrate`) adds it.

Every one of them is an `alter table … add column if not exists`, not just a
column in a `create table if not exists` — the latter only helps a database that
does not exist yet, which is how a project could be one round behind and have no
repair that fixed it. The probe that decides whether to show the banner asks for
all of them, so a missing *column* is reported the same way a missing table is. Nothing is backfilled,
because “how many hoodies are in the cupboard” is not a question a migration can
answer — stock starts *not counted* until someone counts it.

### Windows: `npm run build` works from cmd and PowerShell

The build used to be `STORE_STRICT=1 next build` in `package.json`. That is POSIX
shell syntax; on Windows' cmd.exe it fails before Next.js even starts:

```
'STORE_STRICT' is not recognized as an internal or external command
```

The strict switch now lives in `next.config.mjs`, which sets it when the build
phase starts — so the same `npm run build` works on cmd, PowerShell, macOS and
Linux, and also if you run `npx next build` by hand. Nothing to change on your
side; just pull and run it again:

```bash
npm run db:check
npm run db:migrate
npm run build
```

### If the build says ETIMEDOUT

```
[store] query failed, serving seed data: connect ETIMEDOUT
        fd00:…:5432; connect ETIMEDOUT 127.200.0.106:5432
```

The database was not reachable — this is a network or project state problem,
not a password one. In order of likelihood:

1. **The Supabase project is paused.** Free projects pause when idle. Open the
   dashboard and it wakes up.
2. **You are on the direct host.** `db.<ref>.supabase.co` is IPv6-only and many
   networks cannot reach it. Use the **Session pooler** address instead — the
   whole story is further up this page.
3. A firewall or proxy between you and the host.

`npm run db:check` names which of these it is.

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
