/**
 * `/t/<token>/<signature>` — the shape the QR code carries.
 *
 * The signature lives in the path rather than a query string purely to keep the
 * URL short: six characters fewer is one QR version smaller, and that is what
 * decides whether a 200 px white square is scannable.
 *
 * The rendering lives in `../page.tsx`, which reads the signature from either
 * place, so tickets already sitting in a customer's inbox — the older
 * `/t/<token>?s=<signature>` links — keep working.
 */

// Turbopack refuses a re-exported route-segment config (`dynamic`), so it is
// declared here rather than re-exported. Keep the two in step.
export const dynamic = "force-dynamic";

export { default, metadata } from "../page";
