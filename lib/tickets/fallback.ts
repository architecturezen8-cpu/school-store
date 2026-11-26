import type { Ticket } from "../bookings";

/**
 * The ticket when the school has not uploaded a design yet.
 *
 * It exists so a sale is never a message with no ticket in it. The artwork is
 * drawn to the same rule the admin's design follows — a plain white square on
 * the right, about a fifth of the width — so the QR is pasted in exactly the
 * same way by the same code.
 *
 * What it says is the *ticket*: the event, when and where, the type of seat, and
 * the ticket's own code. Not the purchaser's name, and not the sale's reference.
 *
 * Two reasons, and the second is the one that matters. The page a QR opens is
 * read by whoever is holding the phone, who is usually not the person who paid —
 * a guest, a friend, a steward who has just scanned somebody else's code — so the
 * buyer's name does not belong on it. And the reference is not a harmless label:
 * the gate accepts it and admits the next seat of the party that has not been in,
 * which means printing it on a ticket anyone can photograph would put the whole
 * sale behind one shared string. The code is per person; the reference stays in
 * the office's own paperwork, and on the bill.
 *
 * Each ticket in a sale gets its own drawing, because each one prints its own
 * code and its own seat.
 */
export function fallbackTicketSvg(ticket: Ticket): string {
  const esc = (s: string) =>
    s.replace(/[&<>"']/g, (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!
    );
  const type = ticket.tierName || "Admission";
  const seat = ticket.of > 1 ? `ticket ${ticket.seq} of ${ticket.of}` : "admits one";
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="640" viewBox="0 0 1200 640">
  <rect width="1200" height="640" fill="#0a1224"/>
  <rect y="0" width="1200" height="8" fill="#ffd444"/>
  <text x="60" y="120" fill="#ffd444" font-size="54" font-family="sans-serif" font-weight="bold">${esc(ticket.eventTitle)}</text>
  <text x="60" y="176" fill="#ffffff" font-size="26" font-family="sans-serif">${esc(ticket.venue)}, ${esc(ticket.city)}</text>
  <text x="60" y="220" fill="#7c8db5" font-size="22" font-family="sans-serif">${esc(new Date(ticket.eventDate).toDateString())}</text>
  <text x="60" y="420" fill="#ffffff" font-size="38" font-family="sans-serif">${esc(type)}</text>
  <text x="60" y="466" fill="#7c8db5" font-size="22" font-family="sans-serif">${esc(seat)}</text>
  <text x="60" y="556" fill="#ffd444" font-size="30" font-family="monospace" font-weight="bold">${esc(ticket.code || ticket.reference)}</text>
  <rect x="820" y="340" width="300" height="300" fill="#ffffff"/>
</svg>`;
}
