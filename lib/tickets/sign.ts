import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Ticket QR payloads.
 *
 * A QR code is just text — anyone can type a reference into a generator. So the
 * payload carries a signature: an HMAC over the booking reference, keyed with a
 * secret that only the server has. A scanned ticket is trusted only if the
 * signature verifies, which makes a guessed or hand-edited reference useless.
 *
 *   https://host/t/BM-ABC123?s=<signature>
 *
 * The URL is what a phone camera turns into a tappable link; the signature is
 * what the server checks before showing or admitting anything.
 */

const DEV_FALLBACK = "dev-only-insecure-ticket-secret-change-me";

/**
 * The signing key. In production this must be set (`openssl rand -hex 32`).
 * Falling back keeps `npm run dev` working out of the box; the app warns once.
 */
export function ticketSecret(): string {
  const key = process.env.TICKET_SECRET;
  if (key && key.length >= 16) return key;
  if (process.env.NODE_ENV === "production" && !warned) {
    warned = true;
    console.warn(
      "[tickets] TICKET_SECRET is not set — using an insecure development key. " +
        "Set TICKET_SECRET before taking real bookings."
    );
  }
  return DEV_FALLBACK;
}
let warned = false;

/** Throws in production when the secret is missing, for places that must fail. */
export function requireTicketSecret(): string {
  const key = process.env.TICKET_SECRET;
  if (!key || key.length < 16) {
    throw new Error(
      "TICKET_SECRET is not set (min 16 chars). Add it to .env.local — see SUPABASE.md."
    );
  }
  return key;
}

/** Short, URL-safe signature for a booking's ticket token. */
export function signTicket(token: string): string {
  return createHmac("sha256", ticketSecret())
    .update(`ticket:${token}`)
    .digest("base64url")
    .slice(0, 22);
}

/** Constant-time check, so a wrong signature cannot be found by timing. */
export function verifyTicketSignature(token: string, signature: string): boolean {
  const expected = signTicket(token);
  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

/** Absolute URL a phone should open after scanning. */
export function ticketUrl(token: string, signature: string): string {
  const base = (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");
  return `${base}/t/${encodeURIComponent(token)}?s=${encodeURIComponent(signature)}`;
}

/** The text put inside the QR code. */
export function qrPayload(token: string, signature: string): string {
  return ticketUrl(token, signature);
}

/**
 * Accepts either a full URL (what the QR holds) or a bare token, and pulls out
 * the token + signature. Returns null when there is nothing usable.
 */
export function parseTicketPayload(raw: string): { token: string; signature: string } | null {
  const text = raw.trim();
  if (!text) return null;

  // Bare token, optionally with ?s= — what a staff member might type by hand.
  if (!/^https?:\/\//i.test(text)) {
    const [token, query] = text.split("?");
    const signature = new URLSearchParams(query ?? "").get("s") ?? "";
    if (!token) return null;
    return { token: decodeURIComponent(token), signature };
  }

  try {
    const url = new URL(text);
    // /t/<token>
    const match = url.pathname.match(/\/t\/([^/]+)\/?$/);
    const token = match ? decodeURIComponent(match[1]) : "";
    if (!token) return null;
    return { token, signature: url.searchParams.get("s") ?? "" };
  } catch {
    return null;
  }
}

/** Where the ticket artwork can be fetched — used by the email and the page. */
export function ticketImageUrl(token: string, signature: string): string {
  const base = (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");
  return `${base}/api/tickets/${encodeURIComponent(token)}/image?s=${encodeURIComponent(signature)}`;
}
