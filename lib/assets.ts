/**
 * Asset URL helper — no database imports, so client components can use it.
 *
 * Images are stored root-relative (`/images/hero-1.jpg`). A static export served
 * from a sub-path (GitHub Pages `/school-store`) needs that prefix.
 */
const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

export const asset = (url: string) =>
  url.startsWith("/") && !url.startsWith("//") ? `${BASE_PATH}${url}` : url;
