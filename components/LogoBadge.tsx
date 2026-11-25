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
  decorative = true,
}: {
  src?: string;
  size?: number;
  className?: string;
  inset?: number;
  decorative?: boolean;
}) {
  const crestSize = Math.round(size * inset);

  return (
    <span
      className={`grid shrink-0 place-items-center overflow-hidden rounded-full bg-white ${className}`}
      style={{ height: size, width: size }}
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt={decorative ? "" : "St. Thomas' College crest"}
          aria-hidden={decorative || undefined}
          width={size}
          height={size}
          className="h-full w-full object-cover"
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
