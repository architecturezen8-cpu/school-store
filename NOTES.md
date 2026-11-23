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
