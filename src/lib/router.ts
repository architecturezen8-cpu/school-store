import { useEffect, useState, useCallback } from "react";

/** Lightweight hash router — works in a single-file build with no dependencies. */
export type Route =
  | { name: "home" }
  | { name: "shop"; category?: string }
  | { name: "product"; slug: string }
  | { name: "tickets" };

function parse(hash: string): Route {
  const clean = hash.replace(/^#\/?/, "").replace(/\/$/, "");
  if (!clean) return { name: "home" };
  const [head, tail] = clean.split("/");

  if (head === "shop") return { name: "shop", category: tail || undefined };
  if (head === "product") return { name: "product", slug: tail ?? "" };
  if (head === "tickets") return { name: "tickets" };
  return { name: "home" };
}

export function useRouter() {
  const [route, setRoute] = useState<Route>(() => parse(window.location.hash));

  useEffect(() => {
    const onChange = () => {
      const h = window.location.hash;
      // In-page anchors (#contact, #community, …) are NOT routes.
      // Ignore them entirely so the current page stays mounted and the
      // browser's native scroll-to-element behaviour is preserved.
      if (!h.startsWith("#/")) return;
      setRoute(parse(h));
      window.scrollTo({ top: 0 });
    };
    window.addEventListener("hashchange", onChange);
    return () => window.removeEventListener("hashchange", onChange);
  }, []);

  const navigate = useCallback((to: string) => {
    window.location.hash = to;
  }, []);

  return { route, navigate };
}

export const href = {
  home: "#/",
  shop: "#/shop",
  tickets: "#/tickets",
  shopCategory: (slug: string) => `#/shop/${slug}`,
  product: (slug: string) => `#/product/${slug}`,
};
