/**
 * One spinner, used everywhere something waits.
 *
 * Not a set of animated dots and not a skeleton: a ring that turns. It is the
 * smallest thing that says "this is working" without moving the layout, and
 * because `currentColor` is inherited it wears the button's own text colour —
 * gold on the dark site, black on a gold button, either on the admin's charcoal.
 *
 * The label is not in here. A spinner with a `title` is announced once and then
 * ignored; the button it sits in changes its own words ("Preparing the bill…")
 * and sets `aria-busy`, so a screen reader hears what is happening.
 */
export function Spinner({
  size = 15,
  className = "",
  strokeWidth = 2.5,
}: {
  size?: number;
  className?: string;
  strokeWidth?: number;
}) {
  return (
    <svg
      className={`animate-spin ${className}`}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      focusable="false"
    >
      {/* the quiet track, then the arc that gives the turn a direction */}
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.25" strokeWidth={strokeWidth} />
      <path
        d="M21 12a9 9 0 0 0-9-9"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
      />
    </svg>
  );
}

export default Spinner;
