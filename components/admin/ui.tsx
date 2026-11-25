import type { ReactNode } from "react";

/**
 * The admin's own small design system.
 *
 * Every surface here is a single flat colour from the navy scale with a hairline
 * border. There is deliberately no gradient, no translucency and no blur: the
 * panel is a tool, and a tool reads better when its layers are unambiguous.
 *
 *   page      bg-ink            (#04060d)
 *   sidebar   bg-navy-950       (#060a16)
 *   panel     bg-navy-900       (#0b1226)
 *   raised    bg-navy-800       (#111a33)
 *   hairline  border-navy-700   (#1b2745)
 *   accent    bg-gold / text-gold
 */

/* ---------- inputs ---------------------------------------------------- */

export const inputClass =
  "mt-1.5 w-full rounded-lg border border-navy-600 bg-navy-950 px-3.5 py-2.5 text-sm text-white " +
  "placeholder:text-white/45 outline-none transition-colors focus:border-gold";

export const selectClass = `${inputClass} appearance-none`;

export const labelClass =
  "text-[11px] font-medium uppercase tracking-[0.16em] text-white/55";

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
  "inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold " +
  "transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 " +
  "focus-visible:outline-gold disabled:opacity-50";

const BUTTON_TONES = {
  primary: "bg-gold text-navy-950 hover:bg-[#ffe066]",
  secondary: "border border-navy-600 bg-navy-800 text-white hover:bg-navy-700",
  ghost: "border border-navy-600 text-white/75 hover:bg-navy-800 hover:text-white",
  danger: "border border-red-500/40 text-red-300 hover:bg-red-500/10",
} as const;

export function buttonClass(tone: keyof typeof BUTTON_TONES = "primary") {
  return `${BUTTON_BASE} ${BUTTON_TONES[tone]}`;
}

/** A link that looks like a button — for navigation, not submission. */
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
    <div className="flex flex-wrap items-end justify-between gap-4 border-b border-navy-700 pb-6">
      <div className="min-w-0">
        {eyebrow && (
          <p className="text-[11px] uppercase tracking-[0.24em] text-gold">{eyebrow}</p>
        )}
        <h1 className="mt-1.5 font-display text-2xl font-semibold text-white sm:text-3xl">
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

export function Panel({
  title,
  description,
  actions,
  children,
  className = "",
}: {
  title?: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`rounded-xl border border-navy-700 bg-navy-900 ${className}`}>
      {(title || actions) && (
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-navy-700 px-5 py-4">
          <div className="min-w-0">
            {title && <h2 className="font-display text-lg text-white">{title}</h2>}
            {description && (
              <p className="mt-1 max-w-xl text-sm leading-relaxed text-white/55">{description}</p>
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
}: {
  label: string;
  value: string;
  note?: string;
}) {
  // dt/dd, not p/p: these sit inside a <dl>, and a definition list may only
  // contain dt/dd groups (axe flags anything else).
  return (
    <div className="rounded-xl border border-navy-700 bg-navy-900 p-4">
      <dt className="text-[11px] uppercase tracking-[0.16em] text-white/65">{label}</dt>
      <dd className="mt-1.5 font-display text-2xl text-white">
        {value}
        {note && <span className="block text-xs font-normal text-white/60">{note}</span>}
      </dd>
    </div>
  );
}

/* ---------- feedback -------------------------------------------------- */

const NOTICE_TONES = {
  ok: "border-emerald-500/40 bg-emerald-900/40 text-emerald-100",
  error: "border-red-500/40 bg-red-900/40 text-red-100",
  warn: "border-amber-500/40 bg-amber-900/40 text-amber-100",
  info: "border-navy-600 bg-navy-800 text-white/80",
} as const;

export function Notice({
  tone = "info",
  children,
}: {
  tone?: keyof typeof NOTICE_TONES;
  children: ReactNode;
}) {
  return (
    <p role="status" className={`rounded-lg border px-4 py-3 text-sm ${NOTICE_TONES[tone]}`}>
      {children}
    </p>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return (
    <p className="rounded-lg border border-dashed border-navy-600 px-4 py-8 text-center text-sm text-white/60">
      {children}
    </p>
  );
}

/** A two-tone pill: the admin's at-a-glance state. */
export function Pill({
  tone = "muted",
  children,
}: {
  tone?: "ok" | "muted" | "gold";
  children: ReactNode;
}) {
  const tones = {
    ok: "bg-emerald-900/60 text-emerald-200",
    muted: "bg-navy-800 text-white/70",
    gold: "bg-gold text-navy-950",
  } as const;
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-medium ${tones[tone]}`}
    >
      {children}
    </span>
  );
}
