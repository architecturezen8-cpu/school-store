/**
 * Turning whatever was thrown into a sentence.
 *
 * `(err as Error).message` is a lie that costs an outage: not everything thrown
 * is an Error, and some Errors carry no message at all. A malformed
 * `DATABASE_URL` such as `postgres://` makes `pg` reject with a bare
 * `AggregateError` whose `message` is `""` and whose `errors` array holds
 * `[null, null]`. Reading `.message` off that is fine — but a `catch` that then
 * does anything `.message`-ish with `err` (or a logger that walks `err.errors`)
 * throws *inside* the error handler, and the page returns 500 with a stack that
 * points at the handler rather than at the cause.
 *
 * So: one function, no assumptions, always a non-empty string.
 */

function describeOne(err: unknown): string {
  if (err && typeof err === "object") {
    const e = err as { message?: unknown; code?: unknown; cause?: unknown };
    if (typeof e.message === "string" && e.message.trim()) return e.message.trim();
    if (typeof e.code === "string" && e.code.trim()) return e.code.trim();
    if (e.cause !== undefined && e.cause !== err) {
      const inner = describeOne(e.cause);
      if (inner) return inner;
    }
  }
  if (typeof err === "string" && err.trim()) return err.trim();
  return "";
}

/**
 * A message worth showing a person. Aggregated errors (Node's happy-eyeballs
 * connection attempts) are unwrapped, because their own message is usually
 * empty and the useful line is inside `errors`.
 */
export function errorMessage(err: unknown): string {
  const direct = describeOne(err);

  if (err && typeof err === "object") {
    const list = (err as { errors?: unknown }).errors;
    if (Array.isArray(list)) {
      const inner = list.map(describeOne).filter(Boolean);
      if (inner.length) {
        const unique = [...new Set(inner)];
        return unique.join("; ");
      }
    }
  }

  if (direct) return direct;
  if (err === null) return "An unknown error occurred (null).";
  if (err === undefined) return "An unknown error occurred (undefined).";
  return "An unknown error occurred.";
}

/**
 * The same, for the place a non-technical reader will see it — a database that
 * is not reachable is the common case here, and "ECONNREFUSED" means nothing to
 * a shopkeeper.
 */
export function friendlyError(err: unknown): string {
  const raw = errorMessage(err);
  if (/DATABASE_URL is not configured|No database is configured/i.test(raw)) {
    return "The database is not configured. Check DATABASE_URL and restart the server.";
  }
  if (/connection terminated|ECONNREFUSED|ENOTFOUND|ETIMEDOUT|connection timeout|getaddrinfo/i.test(raw)) {
    return "The database is not reachable right now. Check the database is running and DATABASE_URL is right, then reload.";
  }
  if (/password authentication failed|SASL|28P01/i.test(raw)) {
    return "The database rejected the password. Check the credentials in DATABASE_URL.";
  }
  return raw;
}
