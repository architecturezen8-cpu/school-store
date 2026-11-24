/**
 * `decodeURIComponent` that cannot throw.
 *
 * The admin pages put messages in the query string (`?error=…&ok=…`) and read
 * them back with decodeURIComponent. Next hands `searchParams` over already
 * percent-decoded, so decoding a second time throws `URIError: URI malformed`
 * whenever the message contains a literal `%` — and that error takes the whole
 * page down instead of showing the message. A message is not worth a crash.
 */
export function safeDecode(value: string | undefined | null): string {
  if (!value) return "";
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}
