# Live site vs working files

The branch we work on is the workshop: the app **and** the test suites, the
static Pages export, the notes. The site that goes live only needs the app.

There are two ways to keep those apart, and they are not exclusive.

---

## 1. `final` — a separate branch, generated (not hand-maintained)

```bash
git pull --ff-only            # get the latest work
./publish-final.sh            # publish just the site to origin/final
```

`publish-final.sh` takes `origin/arena/6b38c6e9-school-store`, copies the tree
into a temp directory, deletes everything that is not the site, and commits what
is left on top of the previous `final` — one fast-forward commit per publish.
Two things it deliberately does **not** do:

- it never checks anything out, switches branch or resets your tree (it builds
  the commit in a temporary index, so uncommitted work is untouched);
- it does not publish twice: run it with nothing new and it prints
  `Nothing to publish`.

Options: `DEST_BRANCH=live ./publish-final.sh`,
`SRC_REF=origin/main ./publish-final.sh`,
`DEST_REMOTE=/tmp/mirror.git ./publish-final.sh` (dry run against a local bare
repo — a good way to see the result without touching GitHub).

**What goes in:** `app/`, `components/`, `data/`, `db/`, `lib/`, `public/`,
`scripts/`, `package.json`, `package-lock.json`, `next.config.mjs`,
`tsconfig.json`, `postcss.config.mjs`, `eslint.config.mjs`, `.env.example`,
`.gitignore`, `.vercelignore` — **168 files**.

**What stays out:** `qa/`, `docs/`, `index.html`, `stackblitz.config.json`, the
`*.md` notes, `PUSH-ME.md`/this file, `.arena/`, `.pglite/`, `.env.local`,
`node_modules/`, `.next/`, `out/`.

Verified: that exact tree, extracted into an empty directory, `npm ci`-ed and
built — **35/35 static pages** — and served with `next start` across `/`, `/shop`, `/product/*`, `/tickets`,
`/events/*`, `/admin`, `/admin/stock`, `/admin/mail`, `/admin/bookings`,
`/admin/events`, `/admin/templates`, `/sitemap.xml`, `/robots.txt` (all 200, or
307 on `/gate`).

Then point the deployment at `final` (Vercel → *Production Branch* → `final`).

---

## 2. `.vercelignore` — one branch, and the deployment still only gets the site

If you would rather deploy straight from the working branch, `.vercelignore`
already strips the same files before upload, so the build never sees `qa/` or
`docs/`. Nothing to maintain, nothing to forget: the two lists are checked in
together.

Use this if you want **one** branch. Use `publish-final.sh` if you want the live
branch to be reviewable on its own (or someone else deploys it).

---

## 3. Running it locally

```bash
npm ci
cp .env.example .env.local      # DATABASE_URL, TICKET_SECRET, ADMIN_PASSWORD, MAIL_FROM…
npm run db:migrate              # Supabase schema (idempotent)
npm run db:seed                 # catalogue — first time only
npm run dev                     # http://localhost:3000
```

No `DATABASE_URL`? The embedded PGlite database takes over (`.pglite/`), schema
and catalogue seed themselves, and `npm run dev` just works.

`npm run build && npm start` runs the production build the way the host does.

### Worth clicking through

| Where | What to see |
| --- | --- |
| `/shop` | 17 products; **no** stock badge — nothing is counted yet |
| `/admin` | sign in with `ADMIN_PASSWORD` |
| `/admin/stock` | every colour × size per product, ticket seat caps |
| `/admin/shop/products/crest-hoodie` | add a colour/size just for this product |
| `/events/the-big-match` | ticket tiers and seats left |

Count a shelf in `/admin/stock`, save, then reload `/shop`: the card says
`Only N left`, a size with none left is struck out, and checkout refuses to
oversell.

## 4. Before going live

- **Env vars:** `DATABASE_URL`, `NEXT_PUBLIC_SITE_URL`, `TICKET_SECRET`,
  `ADMIN_PASSWORD`, `MAIL_FROM` (+ `RESEND_API_KEY` or `SMTP_*`).
  `TICKET_SECRET` is not optional — without it ticket QR codes can be forged
  (`openssl rand -hex 32`).
- **`ADMIN_PASSWORD` empty = `/admin` and `/gate` are switched off** by design.
- **Uploads** (logo, favicon, event artwork) are written to `public/uploads/`.
  On a read-only filesystem — Vercel — they do not persist. Use a host with a
  persistent disk, or move those three uploads to object storage.
- **`docs/` is not part of the live branch.** It is the GitHub Pages preview and
  cannot do checkout, tracking or booking.
