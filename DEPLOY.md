# Deploying The Thomian Store

The store is a **Next.js 16 app with a Postgres database**. It needs a host that
can run Node (server rendering + API routes), so it deploys to **Vercel** — not
to a static folder.

---

## 1. Database first

Any Postgres 13+ works: Neon, Supabase, Vercel Postgres, RDS, or your own server.

```bash
export DATABASE_URL="postgresql://user:pass@host:5432/thomian?sslmode=require"
npm run db:migrate      # tables
npm run db:seed         # catalogue, reviews, events
```

`db:migrate` is idempotent, `db:seed` upserts — safe to run again after editing
`data/seed.ts`.

## 2. Vercel

1. Import this repo at <https://vercel.com/new>.
2. Framework preset: **Next.js** (detected automatically — `next.config.ts` is enough).
3. Environment variables:

   | Key | Value |
   | --- | --- |
   | `DATABASE_URL` | the connection string from step 1 |
   | `NEXT_PUBLIC_SITE_URL` | `https://<project>.vercel.app` (used for sitemap + OG tags) |

4. Deploy. Every push to the branch redeploys.

## 3. After the first deploy

- Open `/api/orders` with a browser — a `405`/`400` JSON reply means the server and
  the database are both reachable. `503` means `DATABASE_URL` is missing.
- Place one test order and one test booking, then check the "Track my order"
  dialog with that reference + email.

## What needs a server

| Feature | Needs the server |
| --- | --- |
| Browsing, product pages, tickets list | no (rendered/cached) |
| Checkout → order in Postgres | yes |
| Track my order | yes |
| Ticket booking + stock | yes |

`NEXT_STATIC_EXPORT=1` builds a static `out/` for previews, but the API routes do
not exist there — checkout and tracking will report that the database is not
configured.

---

## GitHub Pages (preview only)

`npm run build:pages` exports a static build into `docs/` (base path
`/school-store`). The root `index.html` forwards to `docs/index.html`, so a Pages
site pointed at **any branch, folder `/`** serves the store.

What a static export cannot do: checkout, order tracking and ticket booking need
the API routes. In the Pages preview those flows show "this is a read-only
preview" instead of failing silently. Use the Vercel deployment (or a StackBlitz
workspace) to exercise them.
