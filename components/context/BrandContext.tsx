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
const BrandContext = createContext<string>("");

export function BrandProvider({
  logo,
  children,
}: {
  logo: string;
  children: React.ReactNode;
}) {
  return <BrandContext.Provider value={logo}>{children}</BrandContext.Provider>;
}

export const useBrandLogo = () => useContext(BrandContext);
