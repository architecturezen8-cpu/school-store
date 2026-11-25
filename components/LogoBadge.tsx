import CrestLogo from "@/components/CrestLogo";

/**
 * The school's mark in a white circle.
 *
 * The circle is the point. A crest is a dark badge with thin lines: set straight
 * on the navy navbar it turns into a smudge, and on a photograph it disappears.
 * On white it reads at any size, which is why every surface here uses one — the
 * navbar, the footer, the admin, and the ticket email all show the same shape, so
 * an uploaded logo looks like it belongs everywhere.
 *
 * Falls back to the built-in crest when the admin has not uploaded anything, so
 * the site is never missing its mark.
 */
export default function LogoBadge({
  /** Path under public/, or "" for the built-in crest. */
  src,
  /** Diameter in pixels; the circle, the image and the crest all use it. */
  size = 44,
  className = "",
  /** Padding around the crest when falling back to the SVG. */
  inset = 0.28,
  /**
   * How much of the circle an uploaded logo fills, 0.3-1.
   *
   * Uploaded crests are padded onto a white square, so one with a lot of built-in
   * margin looks small here even though the file is correct. The admin sets this
   * by eye, and every circle — navbar, footer, admin, mail — follows.
   */
  scale = 0.86,
  decorative = true,
}: {
  src?: string;
  size?: number;
  className?: string;
  inset?: number;
  scale?: number;
  decorative?: boolean;
}) {
  const crestSize = Math.round(size * inset);
  const logoSize = Math.round(size * Math.min(1, Math.max(0.3, scale)));

  return (
    <span
      className={`grid shrink-0 place-items-center overflow-hidden rounded-full bg-white ${className}`}
      style={{ height: size, width: size }}
    >
      {src ? (
        // Inset rather than `object-cover`: a round mask over a crest with writing
        // at the bottom clips the motto, and the whole point of the white circle
        // is that the mark reads at 28 px as well as at 176.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt={decorative ? "" : "St. Thomas' College crest"}
          aria-hidden={decorative || undefined}
          width={logoSize}
          height={logoSize}
          className="object-contain"
          style={{ height: logoSize, width: logoSize }}
        />
      ) : (
        <CrestLogo
          className="text-ink"
          decorative={decorative}
          // The crest is an SVG sized by class in the original design; an inline
          // size keeps the two paths identical whatever the circle is.
          {...{ style: { height: crestSize, width: crestSize } }}
        />
      )}
    </span>
  );
}
