/**
 * Route table — importable from both server and client components.
 *
 * Kept free of React/`next/navigation` imports so a Server Component can use it.
 * `lib/nav.tsx` re-exports it next to the client-side helpers.
 *
 * A static export served from a sub-path (GitHub Pages `/school-store`) needs the
 * prefix on plain `<a href>` values too — Next only adds it to its own router.
 */
const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

/** Prefixes an app path with the deployment base path (no-op on Vercel). */
export const withBase = (path: string) =>
  path.startsWith("/") && !path.startsWith("//") ? `${BASE_PATH}${path}` : path;

/**
 * Route paths stay *unprefixed*: `<Link>` adds the base path itself. Plain
 * `<a>` tags must go through `withBase()` (or `<ILink>`, which does it for you).
 */
export const href = {
  home: "/",
  shop: "/shop",
  tickets: "/tickets",
  shopCategory: (slug: string) => `/shop/${slug}`,
  product: (slug: string) => `/product/${slug}`,
} as const;

/** True for in-page anchors (#contact, #community) that are not routes. */
export const isAnchor = (to: string) => to.startsWith("#") && !to.startsWith("#/");
