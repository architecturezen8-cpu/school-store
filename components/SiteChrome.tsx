"use client";

import { useEffect, useState, type ReactNode } from "react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import SearchOverlay from "@/components/SearchOverlay";
import CartDrawer from "@/components/CartDrawer";
import TrackOrderModal from "@/components/TrackOrderModal";
import { onOpenSearch, onOpenTrack, useRouteName } from "@/lib/nav";
import type { Product } from "@/data/seed";

/**
 * Everything that is on screen on every route: the ambient glow, the navbar,
 * the footer and the three overlays (search, bag, order tracking).
 *
 * It is a client component only because those overlays hold UI state — the
 * page content passed as `children` stays a server component.
 */
export default function SiteChrome({
  children,
  searchIndex,
}: {
  children: ReactNode;
  /** Slim catalogue for the search overlay (name/category/slug/price/image). */
  searchIndex: Product[];
}) {
  const [searchOpen, setSearchOpen] = useState(false);
  const [trackOpen, setTrackOpen] = useState(false);
  const routeName = useRouteName();

  // Pages open the search overlay through this event — see lib/nav.tsx.
  useEffect(() => onOpenSearch(() => setSearchOpen(true)), []);
  useEffect(() => onOpenTrack(() => setTrackOpen(true)), []);

  return (
    <div className="relative min-h-screen overflow-x-clip bg-ink font-sans text-white">
      <div className="pointer-events-none fixed inset-0" aria-hidden>
        <div className="absolute left-1/2 top-[-18%] h-[70vh] w-[130vw] -translate-x-1/2 rounded-full bg-[radial-gradient(closest-side,rgba(20,36,86,0.35),transparent)]" />
        <div className="absolute right-[-12%] top-[46%] h-[50vh] w-[46vw] rounded-full bg-[radial-gradient(closest-side,rgba(30,48,96,0.35),transparent)]" />
        <div className="absolute left-[-12%] top-[78%] h-[50vh] w-[46vw] rounded-full bg-[radial-gradient(closest-side,rgba(20,36,86,0.3),transparent)]" />
      </div>

      <Navbar
        onSearch={() => setSearchOpen(true)}
        onTrack={() => setTrackOpen(true)}
        active={routeName}
      />

      <main>{children}</main>

      <Footer />

      <SearchOverlay
        open={searchOpen}
        onClose={() => setSearchOpen(false)}
        products={searchIndex}
      />
      <CartDrawer />
      <TrackOrderModal open={trackOpen} onClose={() => setTrackOpen(false)} />
    </div>
  );
}
