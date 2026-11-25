/**
 * Turning a title into an address.
 *
 * Deliberately dependency-free: the admin editor is a client component, and
 * importing these from `lib/events` would drag the database — and `pg` — into
 * the browser bundle, which 500s the whole admin.
 */

/**
 * "Inter-House Swimming Meet!" → "inter-house-swimming-meet".
 *
 * Returns "" when the title has no Latin letters or digits in it (a title
 * written entirely in Sinhala, say). The caller decides what to do with that
 * rather than getting an invented address back.
 */
export function slugify(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "") // strip accents: é → e
    .toLowerCase()
    .replace(/['’"]/g, "") // "Founders' Day" → founders-day, not founders--day
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
    .replace(/-+$/g, ""); // slicing can leave a trailing dash
}

/** The next free slug, given a title and any others in the way. */
export function uniqueSlug(base: string, taken: string[]): string {
  const set = new Set(taken);
  if (!set.has(base)) return base;
  for (let i = 2; i < 100; i++) {
    const candidate = `${base}-${i}`;
    if (!set.has(candidate)) return candidate;
  }
  return `${base}-${Math.random().toString(36).slice(2, 8)}`;
}
