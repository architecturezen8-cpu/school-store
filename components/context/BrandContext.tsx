"use client";

import { createContext, useContext } from "react";

/**
 * The school's logo, handed down from the server.
 *
 * The navbar and the footer are client components — they hold menu and bag state
 * — but the logo comes from the database. Rather than turn the whole chrome into
 * a server component (and lose the overlays), the layout reads the setting once
 * and puts it here.
 *
 * Empty string means "no logo uploaded": every consumer falls back to the
 * built-in crest, so the site is never missing its mark.
 */
export type Brand = {
  /** Path under public/, or "" for the built-in crest. */
  logo: string;
  /** How much of the white circle an uploaded logo fills, 0.3-1. */
  scale: number;
};

const DEFAULT_BRAND: Brand = { logo: "", scale: 0.86 };

const BrandContext = createContext<Brand>(DEFAULT_BRAND);

export function BrandProvider({
  logo,
  scale = DEFAULT_BRAND.scale,
  children,
}: {
  logo: string;
  scale?: number;
  children: React.ReactNode;
}) {
  return (
    <BrandContext.Provider value={{ logo, scale }}>{children}</BrandContext.Provider>
  );
}

/** The logo, for a `<LogoBadge src>` — the common case. */
export const useBrandLogo = () => useContext(BrandContext).logo;

/** The logo and the size the admin set for it. */
export const useBrand = () => useContext(BrandContext);
