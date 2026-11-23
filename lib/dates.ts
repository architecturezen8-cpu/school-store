/**
 * Date formatting for events.
 *
 * Always formatted in Asia/Colombo and with explicit `en-GB` options so the
 * server-rendered HTML and the browser produce byte-identical strings (a
 * locale/timezone mismatch here is the classic React hydration error #418).
 */
const TZ = "Asia/Colombo";

export const dayNumber = (d: Date) =>
  new Intl.DateTimeFormat("en-GB", { day: "2-digit", timeZone: TZ }).format(d);

export const monthShort = (d: Date) =>
  new Intl.DateTimeFormat("en-GB", { month: "short", timeZone: TZ })
    .format(d)
    .toUpperCase();

export const weekdayShort = (d: Date) =>
  new Intl.DateTimeFormat("en-GB", { weekday: "short", timeZone: TZ })
    .format(d)
    .toUpperCase();

export const fullDate = (d: Date) =>
  new Intl.DateTimeFormat("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: TZ,
  }).format(d);
