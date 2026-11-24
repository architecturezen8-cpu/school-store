import { cookies } from "next/headers";
import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Admin sign-in.
 *
 * One password (set with `ADMIN_PASSWORD`), exchanged for a signed, HttpOnly
 * cookie. There is no user table and no session store: the cookie carries an
 * expiry and a signature, and the server checks both. That is enough for a
 * school store with a handful of staff, and it keeps the whole surface small
 * enough to read in one sitting.
 *
 *   ADMIN_PASSWORD      the password to sign in with
 *   ADMIN_SECRET        signs the cookie (defaults to TICKET_SECRET)
 */

const COOKIE = "thomian_admin";
const MAX_AGE_SECONDS = 60 * 60 * 12; // one school day

function secret(): string {
  return (
    process.env.ADMIN_SECRET ??
    process.env.TICKET_SECRET ??
    "dev-only-admin-secret-change-me"
  );
}

function sign(value: string): string {
  return createHmac("sha256", secret()).update(value).digest("base64url");
}

/** Constant-time string compare that tolerates different lengths. */
function same(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) {
    // Still compare, to keep the timing profile flat, then fail.
    timingSafeEqual(ab, ab);
    return false;
  }
  return timingSafeEqual(ab, bb);
}

export function adminConfigured(): boolean {
  return Boolean(process.env.ADMIN_PASSWORD);
}

/** True when the supplied password is right (always false if none is set). */
export function checkPassword(candidate: string): boolean {
  const expected = process.env.ADMIN_PASSWORD;
  if (!expected) return false;
  return same(candidate, expected);
}

/** Writes the session cookie. Call only after checkPassword(). */
export async function startSession() {
  const expires = Date.now() + MAX_AGE_SECONDS * 1000;
  const payload = `admin.${expires}`;
  const store = await cookies();
  store.set(COOKIE, `${payload}.${sign(payload)}`, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE_SECONDS,
  });
}

export async function endSession() {
  const store = await cookies();
  store.delete(COOKIE);
}

/** True when the current request carries a valid, unexpired admin cookie. */
export async function isAdmin(): Promise<boolean> {
  const store = await cookies();
  const raw = store.get(COOKIE)?.value;
  if (!raw) return false;

  const lastDot = raw.lastIndexOf(".");
  if (lastDot < 0) return false;
  const payload = raw.slice(0, lastDot);
  const signature = raw.slice(lastDot + 1);
  if (!same(signature, sign(payload))) return false;

  const [, expiry] = payload.split(".");
  const expires = Number(expiry);
  return Number.isFinite(expires) && expires > Date.now();
}
