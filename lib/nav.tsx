"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useMemo, type AnchorHTMLAttributes, type ReactNode } from "react";

/* ------------------------------------------------------------------ *
 *  App-Router shim.
 *
 *  The store's components were written against a tiny hash router
 *  (`href.shop`, `<a href="#/shop">`). Next owns navigation now, so this
 *  module keeps the same call sites working on real URLs:
 *
 *    #/                → /
 *    #/shop            → /shop
 *    #/shop/badges     → /shop?category=badges
 *    #/product/<slug>  → /product/<slug>
 *    #/tickets         → /tickets
 *
 *  Old links (bookmarks, WhatsApp shares) still work: <Link> only sees the
 *  canonical path, and legacy hashes are rewritten in LegacyHashRedirect.
 * ------------------------------------------------------------------ */

export const href = {
  home: "/",
  shop: "/shop",
  tickets: "/tickets",
  shopCategory: (slug: string) => `/shop?category=${slug}`,
  product: (slug: string) => `/product/${slug}`,
} as const;

/** True for in-page anchors (#contact, #community) that are not routes. */
export const isAnchor = (to: string) => to.startsWith("#") && !to.startsWith("#/");

/**
 * `<ILink>` = `<Link>` that also accepts the legacy `#/…` hrefs and plain
 * in-page anchors, so components keep their markup.
 */
export function ILink({
  href: to,
  children,
  ...rest
}: { href: string; children: ReactNode } & Omit<
  AnchorHTMLAttributes<HTMLAnchorElement>,
  "href"
>) {
  if (isAnchor(to)) {
    return (
      <a href={to} {...rest}>
        {children}
      </a>
    );
  }
  return (
    <Link href={to} {...rest}>
      {children}
    </Link>
  );
}

/**
 * Just the route name — no `useSearchParams`, so client chrome can render in
 * statically prerendered pages (404) without a Suspense boundary.
 */
export function useRouteName(): "home" | "shop" | "product" | "tickets" {
  const pathname = usePathname() ?? "/";
  const head = pathname.split("/").filter(Boolean)[0];
  if (head === "shop") return "shop";
  if (head === "product") return "product";
  if (head === "tickets") return "tickets";
  return "home";
}

/** Current route in the shape the old components expect. */
export function useRoute() {
  const pathname = usePathname() ?? "/";
  const params = useSearchParams();

  return useMemo(() => {
    const parts = pathname.split("/").filter(Boolean);
    if (parts[0] === "shop") {
      return { name: "shop" as const, category: params.get("category") ?? undefined };
    }
    if (parts[0] === "product") {
      return { name: "product" as const, slug: parts[1] ?? "" };
    }
    if (parts[0] === "tickets") return { name: "tickets" as const };
    return { name: "home" as const };
  }, [pathname, params]);
}

/* ---------- search overlay bridge ------------------------------------------
 *  Search lives once, in the navbar overlay. A page can ask it to open without
 *  threading a callback through the server→client boundary (functions cannot
 *  be serialised across it).
 * -------------------------------------------------------------------------- */
const SEARCH_EVENT = "thomian:open-search";

export const openSearch = () =>
  window.dispatchEvent(new CustomEvent(SEARCH_EVENT));

export const onOpenSearch = (handler: () => void) => {
  window.addEventListener(SEARCH_EVENT, handler);
  return () => window.removeEventListener(SEARCH_EVENT, handler);
};

export function useNavigate() {
  const router = useRouter();
  return (to: string) => {
    if (isAnchor(to)) {
      document.querySelector(to)?.scrollIntoView({ behavior: "smooth" });
      return;
    }
    router.push(to);
  };
}
