/**
 * Date formatting for events.
 *
 * Everything here is built from `formatToParts` and joined by hand. That is
 * deliberate: the *pattern* a locale chooses is not stable across JS engines.
 * `en-GB` with `weekday` + `day` + `month` renders `Saturday, 9 January 2027`
 * in Node's small-ICU build and `Saturday 9 January 2027` in Chromium's — a
 * one-character difference that makes React throw the whole server tree away
 * with a hydration mismatch. Punctuation we control ourselves is the only
 * thing guaranteed to match on both sides.
 */
const TZ = "Asia/Colombo";

type PartType = "day" | "month" | "year" | "weekday";

function part(date: Date, type: PartType, options: Intl.DateTimeFormatOptions) {
  const fmt = new Intl.DateTimeFormat("en-GB", { ...options, timeZone: TZ });
  return fmt.formatToParts(date).find((p) => p.type === type)?.value ?? "";
}

export const dayNumber = (d: Date) => part(d, "day", { day: "2-digit" });

export const monthShort = (d: Date) =>
  part(d, "month", { month: "short" }).toUpperCase();

export const weekdayShort = (d: Date) =>
  part(d, "weekday", { weekday: "short" }).toUpperCase();

/** "Saturday, 9 January 2027" — comma and spacing are ours, not the ICU's. */
export const fullDate = (d: Date) => {
  const weekday = part(d, "weekday", { weekday: "long" });
  const day = part(d, "day", { day: "numeric" });
  const month = part(d, "month", { month: "long" });
  const year = part(d, "year", { year: "numeric" });
  return `${weekday}, ${day} ${month} ${year}`;
};
