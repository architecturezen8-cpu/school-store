import type { ReactNode } from "react";

/**
 * The admin's design system: bento.
 *
 * A bento box is a tray of separate, rounded compartments — so every piece of
 * the panel is a soft tile rather than a bordered table. The rules:
 *
 *   · **no borders anywhere.** Shape comes from a fill, a radius and the gap
 *     between tiles. A hairline only ever appears *inside* a tile (dividers).
 *   · **navy, white and black only.** No gold, no amber, no green, no red.
 *     Emphasis is white-on-navy or navy-on-white; state is carried by words,
 *     not by a colour the palette does not have.
 *   · **generous radius.** 1rem tiles, 0.75rem controls, pills for tags.
 *   · **one flat colour per tile.** No gradients, no transparency, no blur.
 *
 *   page      bg-black            (#04060d, the store's ink)
 *   tile      bg-navy-900         (raised)
 *   tile alt  bg-navy-800         (a tile on a tile)
 *   quiet     bg-navy-950         (inset wells)
 *   accent    bg-white / text-white
 */

/* ---------- inputs ---------------------------------------------------- */

export const inputClass =
  "mt-2 w-full rounded-xl bg-navy-950 px-4 py-3 text-sm text-white " +
  "placeholder:text-white/40 outline-none ring-0 transition-colors " +
  "focus:bg-navy-800 focus:ring-2 focus:ring-white/70";

export const selectClass = `${inputClass} appearance-none`;

export const labelClass =
  "text-[11px] font-medium uppercase tracking-[0.16em] text-white/60";

export function Field({
  label,
  hint,
  children,
  className = "",
}: {
  label: string;
  hint?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={`block ${className}`}>
      <span className="flex items-baseline justify-between gap-3">
        <span className={labelClass}>{label}</span>
        {hint && <span className="text-[11px] text-white/60">{hint}</span>}
      </span>
      {children}
    </label>
  );
}

/* ---------- buttons --------------------------------------------------- */

const BUTTON_BASE =
  "inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold " +
  "transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 " +
  "focus-visible:outline-white disabled:opacity-50";

const BUTTON_TONES = {
  /** The one thing to press on a screen. */
  primary: "bg-white text-black hover:bg-white/85",
  /** The everyday action: navy tile, white words. */
  secondary: "bg-navy-700 text-white hover:bg-navy-600",
  /** Quiet: no fill until hovered. */
  ghost: "text-white/70 hover:bg-navy-800 hover:text-white",
  /** Destructive: stays in-palette — white text, and the words carry the meaning. */
  danger: "bg-navy-800 text-white/80 hover:bg-white hover:text-black",
} as const;

export function buttonClass(tone: keyof typeof BUTTON_TONES = "primary") {
  return `${BUTTON_BASE} ${BUTTON_TONES[tone]}`;
}

export function ActionLink({
  href,
  tone = "secondary",
  children,
}: {
  href: string;
  tone?: keyof typeof BUTTON_TONES;
  children: ReactNode;
}) {
  return (
    <a href={href} className={buttonClass(tone)}>
      {children}
    </a>
  );
}

/* ---------- layout ---------------------------------------------------- */

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        {eyebrow && (
          <p className="text-[11px] uppercase tracking-[0.24em] text-white/65">{eyebrow}</p>
        )}
        <h1 className="mt-1.5 font-display text-2xl font-semibold text-white sm:text-[28px]">
          {title}
        </h1>
        {description && (
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-white/60">{description}</p>
        )}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

/**
 * A bento tile. `tone` picks how it sits in the tray:
 *   raised  — navy tile on the black page (the default)
 *   sunken  — darker well, for lists and tables inside another tile
 *   invert  — white tile with black text, for the one tile that should shout
 */
export function Panel({
  title,
  description,
  actions,
  children,
  tone = "raised",
  className = "",
}: {
  title?: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
  tone?: "raised" | "sunken" | "invert";
  className?: string;
}) {
  const shell =
    tone === "invert"
      ? "bg-white text-black"
      : tone === "sunken"
        ? "bg-navy-950"
        : "bg-navy-900";

  const titleColour = tone === "invert" ? "text-black" : "text-white";
  const noteColour = tone === "invert" ? "text-black/65" : "text-white/60";

  return (
    <section className={`rounded-2xl ${shell} ${className}`}>
      {(title || actions) && (
        <div className="flex flex-wrap items-start justify-between gap-3 px-5 pt-5">
          <div className="min-w-0">
            {title && <h2 className={`font-display text-lg ${titleColour}`}>{title}</h2>}
            {description && (
              <p className={`mt-1 max-w-xl text-sm leading-relaxed ${noteColour}`}>
                {description}
              </p>
            )}
          </div>
          {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
        </div>
      )}
      <div className="p-5">{children}</div>
    </section>
  );
}

export function Stat({
  label,
  value,
  note,
  tone = "raised",
}: {
  label: string;
  value: string;
  note?: string;
  tone?: "raised" | "invert";
}) {
  // dt/dd, not p/p: these sit inside a <dl>, and a definition list may only
  // contain dt/dd groups (axe flags anything else).
  const shell = tone === "invert" ? "bg-white text-black" : "bg-navy-900 text-white";
  return (
    <div className={`rounded-2xl ${shell} p-5`}>
      <dt
        className={`text-[11px] uppercase tracking-[0.16em] ${
          tone === "invert" ? "text-black/60" : "text-white/60"
        }`}
      >
        {label}
      </dt>
      <dd className="mt-2 font-display text-3xl leading-none text-current">
        {value}
        {note && (
          <span
            className={`mt-2 block text-xs font-normal ${
              tone === "invert" ? "text-black/60" : "text-white/60"
            }`}
          >
            {note}
          </span>
        )}
      </dd>
    </div>
  );
}

/* ---------- feedback -------------------------------------------------- */

/**
 * In-palette notices. A bento tray has no red or green tile, so tone is carried
 * by the mark and the weight of the words: a filled white tile for a problem,
 * a navy one for everything else.
 */
const NOTICE_TONES = {
  ok: "bg-navy-800 text-white",
  error: "bg-white text-black",
  warn: "bg-navy-800 text-white",
  info: "bg-navy-950 text-white/80",
} as const;

export function Notice({
  tone = "info",
  children,
}: {
  tone?: keyof typeof NOTICE_TONES;
  children: ReactNode;
}) {
  return (
    <p
      role="status"
      className={`rounded-xl px-4 py-3 text-sm leading-relaxed ${NOTICE_TONES[tone]}`}
    >
      {tone === "error" && <span className="mr-2 font-semibold">Not done —</span>}
      {tone === "ok" && <span className="mr-2 font-semibold">Done —</span>}
      {tone === "warn" && <span className="mr-2 font-semibold">Heads up —</span>}
      {children}
    </p>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return (
    <p className="rounded-xl bg-navy-950 px-5 py-10 text-center text-sm text-white/65">
      {children}
    </p>
  );
}

/** A two-tone pill: the admin's at-a-glance state. */
export function Pill({
  tone = "muted",
  children,
}: {
  tone?: "ok" | "muted" | "invert";
  children: ReactNode;
}) {
  const tones = {
    ok: "bg-white text-black",
    muted: "bg-navy-800 text-white/75",
    invert: "bg-navy-950 text-white",
  } as const;
  return (
    <span
      className={`inline-flex items-center rounded-full px-3 py-1 text-[11px] font-medium ${tones[tone]}`}
    >
      {children}
    </span>
  );
}
