import { query, databaseDown } from "./db";
import { asset } from "./assets";

/**
 * The school's own settings — one row, one place.
 *
 * Right now that is the logo. It is deliberately *one* setting rather than two
 * (a site logo and an email logo): the whole point of uploading the school's
 * crest is that every surface agrees, and two settings is how the email ends up
 * with last year's badge.
 */

export type SiteSettings = {
  /** Path under public/, or "" for the built-in crest. */
  logo: string;
  /**
   * How much of the white circle the mark fills, 0.3-1.
   *
   * Not every crest is drawn to the same edge: one fills its canvas, another has
   * a wide white margin baked in and looks lost inside a circle that insets it
   * again. The admin sets this by eye and every surface follows.
   */
  logoScale: number;
};

export const DEFAULT_SETTINGS: SiteSettings = { logo: "", logoScale: 0.86 };

/** Clamped, because the value comes from a form and drives a layout. */
export function clampScale(n: unknown): number {
  const v = typeof n === "number" ? n : Number(n);
  if (!Number.isFinite(v)) return DEFAULT_SETTINGS.logoScale;
  return Math.min(1, Math.max(0.3, Math.round(v * 100) / 100));
}

/**
 * Cheap enough to call per request, and never throws: a settings row that cannot
 * be read must not take the site down, so a missing database means the default
 * crest and nothing more.
 */
export async function getSettings(): Promise<SiteSettings> {
  if (databaseDown()) return DEFAULT_SETTINGS;
  try {
    const rows = await query<{ logo: string | null; logo_scale: string | null }>(
      "select logo, logo_scale from site_settings where id = 1"
    );
    return {
      logo: (rows[0]?.logo ?? "").trim(),
      logoScale: clampScale(rows[0]?.logo_scale ?? DEFAULT_SETTINGS.logoScale),
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export async function saveLogo(path: string): Promise<void> {
  await query(
    `insert into site_settings (id, logo) values (1, $1)
     on conflict (id) do update set logo = excluded.logo, updated_at = now()`,
    [path.trim()]
  );
}

/** How much of the circle the mark fills, on every surface. */
export async function saveLogoScale(scale: number): Promise<void> {
  await query(
    `insert into site_settings (id, logo_scale) values (1, $1)
     on conflict (id) do update set logo_scale = excluded.logo_scale, updated_at = now()`,
    [clampScale(scale)]
  );
}

/** The logo as a URL the browser can load, or "" for the built-in crest. */
export async function logoUrl(): Promise<string> {
  const { logo } = await getSettings();
  return logo ? asset(logo) : "";
}

/**
 * The logo as an absolute URL, for an email.
 *
 * A mail client has no origin of its own, so a path is useless there. Falls back
 * to the deployment URL, which is the same default `coverImageUrl` uses.
 */
export async function absoluteLogoUrl(): Promise<string> {
  const url = await logoUrl();
  if (!url) return "";
  if (/^https?:\/\//i.test(url)) return url;
  const base = (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");
  return `${base}${url.startsWith("/") ? "" : "/"}${url}`;
}
