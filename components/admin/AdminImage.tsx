"use client";

import ProductImage from "@/components/ProductImage";

/**
 * A photo in the admin, with the shop's failure state.
 *
 * The admin's own pages used bare `<img>` tags, so a remote stock photo that the
 * network refused (a filtered school line, an offline demo) showed the browser's
 * broken-image glyph in the middle of the shelf — the one thing that makes a
 * picture-led page look broken. `ProductImage` already knows how to fail: a crest
 * on navy, and the words "photo unavailable". The admin simply borrows it.
 *
 * The sizing classes land on a wrapper rather than on the photo itself:
 * `ProductImage` sizes its own `<img>` at `h-full w-full`, and two competing
 * `w-` utilities on one element are decided by stylesheet order, not by the
 * order they are written — which is how a 48px thumbnail on the overview grew
 * to the full width of its card.
 */
export default function AdminImage({
  src,
  alt = "",
  className = "",
}: {
  src: string;
  alt?: string;
  className?: string;
}) {
  return (
    <span className={`block overflow-hidden ${className}`}>
      <ProductImage src={src} alt={alt} />
    </span>
  );
}
