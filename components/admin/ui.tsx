import type { ReactNode } from "react";

/**
 * The admin's design system: bento.
 *
 * A bento box is a tray of separate, rounded compartments — so every piece of
 * the panel is a soft tile rather than a bordered table. The rules:
 *
 *   · **no borders anywhere.** Shape comes from a fill, a radius and the gap
 *     between tiles. A hairline only ever appears *inside* a tile (dividers).
 *   · **charcoal, off-white and yellow only.** Not black, not white, and not
 *     navy. Pure white on pure black is a 21:1 contrast ratio — plenty of
 *     contrast and still tiring, because the eye keeps re-adapting between the
 *     letters and the background. Both ends sit slightly inside the extremes
 *     here, which lands the text around 15:1: unmistakable and comfortable.
 *   · **the surfaces have to be visible.** A tile on the page is a 1.10:1 step
 *     and a tile on a tile is 1.26:1. Steps smaller than about 1.05:1 exist in
 *     the CSS and not on the screen.
 *   · **generous radius.** 1rem tiles, 0.75rem controls, pills for tags.
 *   · **one flat colour per tile.** No gradients, no transparency, no blur.
 *
 *   page      bg-page            (#131417)
 *   tile      bg-panel            (#1c1e21, raised)
 *   tile alt  bg-panel-2          (#26292d, a tile on a tile)
 *   quiet     bg-well             (#17181b, inset wells)
 *   accent    bg-gold / text-gold    (#ffd444)
 *
 * Text is a four-step ramp, named for the job rather than an opacity, and every
 * step clears 4.5:1 on every surface above:
 *
 *   text-strong   #f2f4f6   headings, input values
 *   text-body     #d3d7dc   sentences, nav labels
 *   text-muted    #a4aab2   labels, secondary lines
 *   text-faint    #878e97   meta text, timestamps
 *
 * `qa/admin-palette.mjs` checks all of it against the rendered pages, so this
 * does not depend on anybody remembering it.
 */

/* ---------- inputs ---------------------------------------------------- */

export const inputClass =
  "mt-2 w-full rounded-xl bg-well px-4 py-3 text-sm text-strong " +
  "placeholder:text-faint outline-none ring-0 transition-colors " +
  "focus:bg-panel-2 focus:ring-2 focus:ring-faint";

export const selectClass = `${inputClass} appearance-none`;

export const labelClass =
  "text-[11px] font-medium uppercase tracking-[0.16em] text-muted";

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
        {hint && <span className="text-[11px] text-muted">{hint}</span>}
      </span>
      {children}
    </label>
  );
}

/* ---------- buttons --------------------------------------------------- */

const BUTTON_BASE =
  "inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold " +
  "transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 " +
  "focus-visible:outline-strong disabled:opacity-50";

const BUTTON_TONES = {
  /** The one thing to press on a screen. */
  primary: "bg-gold text-black hover:bg-gold-bright",
  /** The everyday action: a grey tile with bright words. */
  secondary: "bg-panel-2 text-strong hover:bg-line",
  /** Quiet: no fill until hovered. */
  ghost: "text-body hover:bg-panel-2 hover:text-strong",
  /** Destructive: stays in-palette — white text, and the words carry the meaning. */
  danger: "bg-panel text-strong hover:bg-panel-2 hover:text-strong",
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
          <p className="text-[11px] font-medium uppercase tracking-[0.24em] text-gold">
            {eyebrow}
          </p>
        )}
        <h1 className="mt-1.5 font-display text-2xl font-semibold text-strong sm:text-[28px]">
          {title}
        </h1>
        {description && (
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted">{description}</p>
        )}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

/**
 * A bento tile. `tone` picks how it sits in the tray:
 *   raised  — grey tile on the black page (the default)
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
      ? "bg-gold text-black"
      : tone === "sunken"
        ? "bg-well"
        : "bg-panel";

  const titleColour = tone === "invert" ? "text-black" : "text-strong";
  const noteColour = tone === "invert" ? "text-black/70" : "text-muted";

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
  const shell = tone === "invert" ? "bg-gold text-black" : "bg-panel text-strong";
  return (
    <div className={`rounded-2xl ${shell} p-5`}>
      <dt
        className={`text-[11px] uppercase tracking-[0.16em] ${
          tone === "invert" ? "text-black/60" : "text-muted"
        }`}
      >
        {label}
      </dt>
      <dd className="mt-2">
        <span className="block font-display text-2xl leading-none tabular-nums text-current sm:text-3xl">
          {value}
        </span>
        {note && (
          <span
            className={`mt-2 block text-xs font-normal ${
              tone === "invert" ? "text-black/60" : "text-muted"
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
 * by the mark and the weight of the words: a bright tile for a problem, a grey
 * one for everything else.
 */
const NOTICE_TONES = {
  ok: "bg-panel-2 text-strong",
  // The one solid bright surface left in the admin, kept for the one message
  // that has to stop someone: an error. Everything else is a grey tile.
  error: "bg-strong text-black",
  warn: "bg-panel-2 text-strong",
  info: "bg-well text-strong",
} as const;

export function Notice({
  tone = "info",
  className = "",
  children,
}: {
  tone?: keyof typeof NOTICE_TONES;
  className?: string;
  children: ReactNode;
}) {
  return (
    <p
      role="status"
      className={`rounded-xl px-4 py-3 text-sm leading-relaxed ${NOTICE_TONES[tone]} ${className}`}
    >
      {tone === "error" && <span className="mr-2 font-semibold">Not done —</span>}
      {tone === "ok" && <span className="mr-2 font-semibold text-gold">Done —</span>}
      {tone === "warn" && <span className="mr-2 font-semibold text-gold">Heads up —</span>}
      {children}
    </p>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return (
    <p className="rounded-xl bg-well px-5 py-10 text-center text-sm text-muted">
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
    ok: "bg-gold text-black",
    muted: "bg-panel-2 text-body",
    invert: "bg-well text-strong",
  } as const;
  return (
    <span
      className={`inline-flex items-center rounded-full px-3 py-1 text-[11px] font-medium ${tones[tone]}`}
    >
      {children}
    </span>
  );
}

/** The small all-caps label above a title. One definition, so the tracking and
 *  the colour never drift between pages. */
export function Eyebrow({ children }: { children: ReactNode }) {
  return (
    <p className="text-[11px] font-medium uppercase tracking-[0.24em] text-muted">
      {children}
    </p>
  );
}
