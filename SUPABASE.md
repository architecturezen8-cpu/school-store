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
`select/insert/update/delete` on the 10 store tables and `usage/select` on the
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
