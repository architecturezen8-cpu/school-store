import type { Ticket } from "../bookings";

/**
 * The ticket when the school has not uploaded a design yet.
 *
 * It exists so a sale is never a message with no ticket in it. The artwork is
 * drawn to the same rule the admin's design follows — a plain white square on
 * the right, about a fifth of the width — so the QR is pasted in exactly the
 * same way by the same code.
 *
 * The number printed on it is the ticket's own code, not the sale's reference:
 * that is what the desk types when a QR will not read, and what a parent reads
 * down a phone line.
 */
/** A simple ticket when no design has been uploaded yet. */
export function fallbackTicketSvg(ticket: {
  reference: string;
  /** The ticket's own code: the number a person reads out, and the one the desk types. */
  code: string;
  name: string;
  eventTitle: string;
  eventDate: string;
  venue: string;
  city: string;
}): string {
  const esc = (s: string) =>
    s.replace(/[&<>"']/g, (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!
    );
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="640" viewBox="0 0 1200 640">
  <rect width="1200" height="640" fill="#0a1224"/>
  <rect y="0" width="1200" height="8" fill="#ffd444"/>
  <text x="60" y="120" fill="#ffd444" font-size="54" font-family="sans-serif" font-weight="bold">${esc(ticket.eventTitle)}</text>
  <text x="60" y="176" fill="#ffffff" font-size="26" font-family="sans-serif">${esc(ticket.venue)}, ${esc(ticket.city)}</text>
  <text x="60" y="220" fill="#7c8db5" font-size="22" font-family="sans-serif">${esc(new Date(ticket.eventDate).toDateString())}</text>
  <text x="60" y="420" fill="#ffffff" font-size="38" font-family="sans-serif">${esc(ticket.name)}</text>
  <text x="60" y="556" fill="#ffd444" font-size="30" font-family="monospace" font-weight="bold">${esc(ticket.code || ticket.reference)}</text>
  <text x="60" y="588" fill="#7c8db5" font-size="18" font-family="sans-serif">booking ${esc(ticket.reference)}</text>
  <rect x="820" y="340" width="300" height="300" fill="#ffffff"/>
</svg>`;
}
