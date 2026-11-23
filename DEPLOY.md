# Deploying The Thomian Store

The production build is a **single self-contained HTML file** (`docs/index.html`, ~2.5 MB) —
JS and CSS are inlined, routing is hash-based. It runs from any static host, no server needed.

Rebuild it any time with:

```bash
npm run build:docs    # → docs/index.html
```

---

## Option 1 — GitHub Pages (permanent free link)

One-time setup, done in the browser by the repo owner:

1. Open <https://github.com/architecturezen8-cpu/school-store/settings/pages>
2. **Source** → *Deploy from a branch*
3. **Branch** → `arena/e2057950-school-store` (or `main` once merged) · **Folder** → `/docs`
4. **Save**

After 1–2 minutes the site is live at:

```
https://architecturezen8-cpu.github.io/school-store/
```

`docs/.nojekyll` is already committed so Jekyll never touches the build.

> The API token used by the coding agent has no `pages` scope, so this switch is the only
> step that must be clicked manually. Everything else is ready.

---

## Option 2 — Netlify / Vercel / Cloudflare Pages (drag & drop)

No account setup beyond sign-up:

1. Download `docs/index.html` from the repo
   (`https://raw.githubusercontent.com/architecturezen8-cpu/school-store/arena/e2057950-school-store/docs/index.html`)
2. Drop the file on <https://app.netlify.com/drop>

You get a public URL like `https://thomian-store.netlify.app` immediately.
Netlify Drop serves the file as-is, so the single-file build is all that is required.

For Vercel / Cloudflare Pages instead, point them at this repo with:

- **Build command:** `npm run build:docs`
- **Output directory:** `docs`

---

## Option 3 — Local preview of the production build

```bash
npm run build           # → dist/
npm run preview         # http://localhost:4173
```

---

## Why the sandbox preview link returns 403

Arena's live-preview URLs (`https://<port>-<sandbox>.e2b.app`) are bound to the logged-in
session: the proxy expects the `e2b-traffic-access-token` header, so the same URL copied into
another browser tab or shared with someone else answers **403 Forbidden — Missing traffic
access token**. That is a platform access rule, not a bug in the site — use Option 1 or 2 for a
link you can share.
