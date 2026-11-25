# Running the store on StackBlitz

StackBlitz runs the whole project **inside your browser** (WebContainer). That is
why the repo is set up to need nothing but `npm install`:

- **Database** — there is no Postgres server to start in a WebContainer, so the
  app uses **PGlite**: a real Postgres compiled to WebAssembly, storing its data
  in `.pglite/`. Same `db/schema.sql`, same SQL, real transactions. It is created
  and seeded automatically on the first request.
- **Turbopack is the default** everywhere else, but its native binary cannot run
  in a WebContainer: in StackBlitz use `npm run dev:webpack` instead of
  `npm run dev`. That is the only difference.
- **Tailwind's native oxide binary** cannot load in a WebContainer either. Set
  `TAILWIND_ENGINE=wasm` and it uses the WASM build (the package is already in
  `devDependencies`); with `npm run dev:webpack` that combination works.

---

## Open it

1. Sign in to <https://stackblitz.com> with GitHub.
2. **Projects → New project → Import from GitHub** (or open
   `https://stackblitz.com/github/architecturezen8-cpu/school-store/tree/arena/e2057950-school-store`).
3. Pick the branch `arena/e2057950-school-store`, wait for `npm install`, then the
   dev server starts on port 3000 and opens in the preview pane.

First load takes a minute: webpack compiles, PGlite initialises, and the
catalogue is seeded. After that, reloads are instant. (Turbopack is ~5x faster on
a normal machine, which is why it is the default everywhere else.)

---

## What works there

| Flow | In StackBlitz |
| --- | --- |
| Home, shop, collections, product pages | ✅ |
| Search, quick view, bag | ✅ |
| Checkout → order stored in PGlite | ✅ |
| Track my order (reference + email) | ✅ |
| Ticket booking, stock decrement | ✅ |

Orders and bookings live in `.pglite/` inside the container. When the workspace
is discarded they are gone — nothing is billed or shipped from a preview.

### Reset the demo data

```bash
npm run db:reset:embedded   # drop .pglite/ — re-created and re-seeded on next request
```

---

## Seeing it outside the editor

The editor's preview is the app. If you want a link to share, use StackBlitz's
own preview URL from the address bar. Note that a WebContainer **cannot host a
permanent public site**: for the real store, use Vercel (see `DEPLOY.md`).

---

## If something looks wrong

| Symptom | Cause / fix |
| --- | --- |
| `Cannot find module '@tailwindcss/oxide-…'` | The WASM fallback was not picked up. Run `npm install @tailwindcss/oxide-wasm32-wasi`. |
| Styles missing entirely | Check the terminal for a PostCSS error; `postcss.config.mjs` must export the plugin object. |
| `Turbopack` errors in the terminal | Inside a browser IDE only: use `npm run dev:webpack`, not `npm run dev`. |
| `Cannot find module '@tailwindcss/oxide-…'` (again) | Set `TAILWIND_ENGINE=wasm` before starting. |
| Page says "database is not configured" | A `.env` sets `STORE_BACKEND=none`. Delete that line (or set it to `pglite`). |
| `WebAssembly` errors | Reload the tab once — the WASM memory was likely exhausted during the first compile. |
| Slow first page | Normal under `dev:webpack`: webpack + WASM Postgres boot. Subsequent navigations are fast. |

The dev server log in StackBlitz is the same one you would see locally, so any
error there is worth pasting back to me.
