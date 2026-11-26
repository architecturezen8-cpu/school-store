# QA report — "The Thomian Store"

Real Chromium (131) driving the running Next.js dev server at 1440 / 820 / 393 px,
plus automated layout / a11y / interaction probes. Server: webpack dev, PGlite backend.

## Bugs found and fixed

| # | Area | Bug | Fix |
|---|------|-----|-----|
| 1 | Tickets page | Hydration mismatch on every load: `fullDate()` renders `Saturday, 9 January 2027` in Node but `Saturday 9 January 2027` in Chromium (ICU build difference — the `en-GB` weekday+day pattern is not stable across engines). React throws away the server tree. | `lib/dates.ts` formats each part explicitly with `formatToParts` and joins them itself. |
| 2 | Footer | "Track my order" points at `#track`, but nothing listens for it — clicking does nothing. The checkout success dialog tells the customer to track "from the footer". | Footer links emit the same `openTrack()` event the navbar uses. |
| 3 | Tickets page | Event cards use a fixed column layout, so the two-line title on "Inter-House Athletics Meet" pushed its **BOOK** button below the other three cards. | Cards are flex columns; title block grows, footer line is pinned with `mt-auto`. |
| 4 | Navbar | `aria-label="Home"` on the crest link does not contain the link's visible text (`1873 / ANIMO ET FIDE` from the SVG crest) — WCAG 2.5.3, axe `label-content-name-mismatch` (serious) on **every** page. | Crest SVGs are decorative (`aria-hidden`), link label is the real text. |
| 5 | Search overlay | Category shown as the raw slug — "event-clothings". | Uses `getCategoryName()`. |
| 6 | Checkout | Inputs have no `name` attribute: no autofill, no password-manager/browser autocomplete, and no form semantics for assistive tech. | `name`, `autoComplete`, proper `type`/`inputMode` on every field. |
| 7 | Shop grid | Broken/blocked product images render as an empty navy rectangle with the alt text spilling out — looks like an unfinished page. | Card image area keeps its 4:5 box and shows a crest placeholder when the image fails to load. |
| 8 | Home hero | Carousel caption counter ("01 / 03") and the slide captions are the only description of the hero image — no `alt` text at all. | Real `alt` on the hero image, decorative layers hidden. |

## Checked and found healthy

- Add to bag → bag drawer → checkout → order placed (`STC-01044`) → track order timeline, all in the browser.
- Ticket booking modal: tier selection, quantity, stepper, total.
- Search overlay: query, result, add-to-bag.
- Product page: size/colour pickers, quantity, details.
- Mobile 393 px: no horizontal overflow on `/`, `/shop`, `/product/*`, `/tickets`.
- Keyboard: first Tab lands on the brand link with a visible focus ring; no focus stops on hidden elements.
- 404 page renders with chrome, CTA and footer.

## Re-running the checks

```bash
bash qa/setup.sh          # once: Chromium + shared libs for the harness
npm run dev &             # store on :3000
QA_MODULES=/tmp/qaenv/node_modules QA_LIBS=/tmp/al/lib node qa/e2e.mjs
QA_MODULES=/tmp/qaenv/node_modules QA_LIBS=/tmp/al/lib node qa/axe.mjs
QA_MODULES=/tmp/qaenv/node_modules QA_LIBS=/tmp/al/lib node qa/crawl.mjs 1440
```

`qa/` is a dev harness only — none of it is imported by the app and none of its
packages were added to `package.json`.

## Not a bug (harness artefacts, recorded so they are not re-investigated)

- Full-page screenshots pin the `position: fixed` navbar mid-page and clip scroll-revealed
  sections. Viewport-by-viewport strips are used instead.
- `images.pexels.com` is unreachable from this sandbox, so those five remote product
  photos always report as failed here. The local `public/images/*` files all load.
