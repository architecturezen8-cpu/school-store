# The Thomian Store

The official e-commerce front end for **St. Thomas' College Matale** — est. 1873 · *Animo et Fide*.

A single-page store built with React, Vite and Tailwind CSS v4, covering the full shopping flow from browsing to a confirmed ticket booking.

---

## Pages

| Route | Description |
|---|---|
| `#/` | Home — cinematic hero, collections, featured products, motto, community reviews |
| `#/shop` | Full catalogue with category filter + sorting |
| `#/shop/:category` | A single collection |
| `#/product/:slug` | Product detail — gallery, options, reviews |
| `#/tickets` | Event listings with live countdown and booking |

Routing is hash-based (`src/lib/router.ts`) so the production build works from any static host without server rewrites.

## Features

**Catalogue** — 5 selling categories (Badges, Uniforms, Event Clothings, Exam Writing Papers, Batch Shirts), 17 products with pricing, ratings and detail bullets.

**Shop** — category filter with item counts, sort by Featured / New Arrivals / Price (high–low, low–high) / Top Rated. Collapsible filter panel on mobile.

**Product cards** — shared across shop, home featured and related products. Hover reveals a white *View Product* bar and a quick-view button.

**Quick view** — a portal-rendered modal with image carousel, colour swatches, size picker, quantity stepper, add-to-bag and buy-now.

**Product pages** — 4-image gallery with thumbnails, size and colour selection, quantity control, an expandable customer review form that posts live.

**Tickets** — featured event spotlight with a live countdown, upcoming events as cards, and a three-step booking flow (tickets → details → confirmed) that issues an e-ticket with a booking reference and barcode.

**Cart** — slide-out drawer with a free-shipping progress meter, quantity controls and subtotal. Search overlay with instant results. Order tracking modal.

**Navigation** — desktop bar with a centred crest, a Shop dropdown; mobile uses a full-height drawer that expands in place with the hamburger morphing into a close icon.

## Stack

- **React 19** + TypeScript
- **Vite 7** — single-file production build
- **Tailwind CSS v4** — dark navy/black/white palette, `#FFD444` gold as a sparing accent
- **Inter** (body) and **Poppins** (headings)
- **lucide-react** for icons

## Getting started

```bash
npm install
npm run dev      # local dev server
npm run build    # production build → dist/
```

## Connecting a database

The API layer lives in `src/lib/api.ts`. Set the base URL and the store will fetch live data instead of the local seed file:

```ts
export const API_BASE_URL = "https://your-api.example.com/v1";
```

Expected endpoints:

```
GET  /categories
GET  /products?category=<slug>
GET  /products/:slug
POST /orders
```

Until a URL is set the site renders local seed data from `src/data.ts`, so nothing breaks.

The matching MySQL schema is in **`database/schema.sql`**. Run it once — it drops any previous tables and rebuilds `categories`, `products`, `product_options`, `customers`, `orders`, `order_items` and `reviews`, seeding the five collections.

## Project structure

```
src/
  components/   reusable UI (navbar, cards, modals, footer)
  pages/        Shop, Product, Tickets
  lib/          router, API client
  context/      cart state
  data/         seed catalogue
  assets/       imagery
database/
  schema.sql    MySQL schema + seed
```
