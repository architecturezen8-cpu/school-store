"use client";

import { useEffect, useRef, useState } from "react";
import CrestLogo from "@/components/CrestLogo";

/**
 * Catalogue photo with a graceful failure state.
 *
 * Five of the seeded products point at remote stock photos. When one of those
 * hosts is blocked (school wifi with a filter, a flaky CDN, an offline demo)
 * the raw `<img>` renders as an empty navy box with the alt text spilling out
 * of it — which reads as a broken page rather than a missing photo.
 *
 * Two failure paths have to be covered:
 *  - the image fails *after* hydration (slow network, host blocked late)
 *    → `onError`
 *  - the image already failed while the browser parsed the server HTML, so the
 *    `error` event fired before React attached a listener → the ref check in
 *    `useEffect` (`complete && naturalWidth === 0`).
 */
export default function ProductImage({
  src,
  alt,
  className = "",
  tone = "site",
}: {
  src: string;
  alt: string;
  className?: string;
  /**
   * Which surface the failure state sits on.
   *
   * The storefront is navy, and a missing photo there should look like a gap in
   * the shop rather than a white hole. The admin wears charcoal and no navy at
   * all, so it asks for `admin` — the same crest, the same words, on the tile
   * colour of the page it is on.
   */
  tone?: "site" | "admin";
}) {
  const ref = useRef<HTMLImageElement>(null);
  const [failed, setFailed] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const img = ref.current;
    if (!img) return;
    // React may reuse this component when the product changes (gallery
    // thumbnails, quick view); reset before re-checking.
    setFailed(false);
    setLoaded(false);
    if (!img.complete) return; // still in flight — onLoad/onError will report
    if (img.naturalWidth === 0) setFailed(true);
    else setLoaded(true);
  }, [src]);

  if (failed) {
    return (
      <div
        role="img"
        aria-label={`${alt} — photo unavailable`}
        className={`flex h-full w-full flex-col items-center justify-center gap-3 ${
          tone === "admin"
            ? "bg-well"
            : "bg-[radial-gradient(circle_at_50%_35%,#1a2a52,#0b1220_70%)]"
        } ${className}`}
      >
        <CrestLogo className={`h-12 w-12 ${tone === "admin" ? "text-white/20" : "text-white/25"}`} decorative />
        <span
          className={`px-4 text-center text-[9px] font-semibold uppercase tracking-[0.22em] ${
            tone === "admin" ? "text-faint" : "text-white/35"
          }`}
        >
          Photo unavailable
        </span>
      </div>
    );
  }

  return (
    <img
      ref={ref}
      src={src}
      alt={alt}
      loading="lazy"
      decoding="async"
      onError={() => setFailed(true)}
      onLoad={() => setLoaded(true)}
      // Keep the element mounted but invisible until it has pixels, so a
      // half-loaded image never shows the browser's broken-image glyph.
      style={{ opacity: loaded ? 1 : 0, transition: "opacity 400ms ease-out" }}
      className={`h-full w-full object-cover ${className}`}
    />
  );
}
