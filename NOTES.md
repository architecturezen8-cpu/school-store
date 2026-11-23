# Working agreement (dev loop)

The site is developed in this sandbox. Because the Arena preview URL needs a session
token, the on-screen preview is only visible inside Arena — so correctness is checked
by an automated smoke test instead of by eye.

## After every change

```bash
npm run typecheck     # tsc --noEmit
npm run smoke         # build + run the app in jsdom, click every flow
```

`npm run smoke:watch` keeps that running in the background: it re-runs on every save
under `src/` and prints **“▲ NEW since last run”** with anything that just broke
(console error, unhandled rejection, dead image, missing element, a11y note).

The full JSON report (every check, error text and a11y note) lands in
`verify/smoke-report.json` — git-ignored, regenerated on each run.

## What the smoke test covers

| Area | Checks |
|---|---|
| Boot | app mounts, hero renders, no console errors on load |
| Shop | product grid, category routes, custom sort dropdown re-orders the grid |
| Product | title renders, options selectable, add-to-bag works, cart count updates |
| Overlays | quick view opens/closes, search overlay filters, cart drawer opens |
| Tickets | page renders, booking flow advances to the next step |
| Footer | `#track` anchor opens the track-order modal |
| Nav | hamburger toggles to close |
| Assets | every local image exists on disk; remote images pinged when the network allows |
| Markup | one `<h1>` per route, no duplicate ids, every image/button/link/form named |

Anything not covered by the test (pixel layout, hover states, real animations)
needs a human look at the Arena preview.

---

# Real-browser QA (agent-browser + headless Chromium)

The smoke test above runs the app in jsdom, which cannot see layout. For layout,
hover states, screenshots and axe audits there is a real Chromium rig:

```bash
bash scripts/browser-qa.sh install                 # once: ~70 MB into /tmp (nothing in the repo)
bash scripts/browser-qa.sh shot '/#/shop' /tmp/shop.png
bash scripts/browser-qa.sh shot '/#/shop' /tmp/shop-m.png "iPhone 15"
bash scripts/browser-qa.sh audit '/#/product/crest-hoodie'
bash scripts/browser-qa.sh ab snapshot -i          # drive the page by hand
```

Why this rig exists: `agent-browser install` and Playwright's browser CDN are both
unreachable from the sandbox, so the binary is pulled from the npm registry instead
(`@sparticuz/chromium@143`, the last build that bundles the NSS/NSPR libraries it
needs). `scripts/browser-qa.sh install` documents and automates that.

The static build has to be served for these checks:

```bash
npm run build:docs
python3 -m http.server 8080 --bind 0.0.0.0 --directory docs
```

## What a browser pass covers

| Check | Command |
|---|---|
| Layout at 1440 / 1280 / 393 px, full-page | `shot ... --full` |
| Axe-core WCAG audit per route | `audit '/#/shop'` |
| Console errors / page errors | `ab errors` |
| Real interaction (typing, clicking, focus) | `ab click` / `ab fill` / `ab press` |

Screenshots are the only way to catch the things jsdom is blind to: horizontal
overflow, truncated labels, stacked overlays, and contrast on image backgrounds.
