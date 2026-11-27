import { mkdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import sharp from "sharp";

/**
 * Photographs the admin uploads — an event's hero, the gallery, a poster.
 *
 * Separate from `lib/tickets/templates.ts`, which is about one very particular
 * kind of image (artwork with a white square that a QR is pasted into). This is
 * the ordinary case: a picture, resized to something sensible, stored under
 * `public/uploads/events/` and referenced by URL.
 *
 * Every upload is normalised rather than stored as-is. A 12 MP phone photo is
 * 4 MB and takes a second to decode on a phone at the gate; the same photo at
 * 2000 px on its long side is a tenth of that and looks identical at any size the
 * site renders it. Orientation is baked in too, because a portrait photo taken on
 * a phone carries an EXIF flag that some browsers honour and some ignore — and a
 * hero that flips is a bug nobody enjoys explaining.
 */

export const EVENT_UPLOAD_DIR = path.join("public", "uploads", "events");

const ALLOWED = new Map([
  ["image/png", ".png"],
  ["image/jpeg", ".jpg"],
  ["image/webp", ".webp"],
]);

export const MAX_UPLOAD_BYTES = 12 * 1024 * 1024;
const MAX_EDGE = 2000;

export type UploadedImage =
  | { ok: true; url: string; width: number; height: number }
  | { ok: false; error: string };

export async function uploadImage(file: File, folder = ""): Promise<UploadedImage> {
  // `folder` is a sub-folder *inside* uploads/events, not the folder itself —
  // EVENT_UPLOAD_DIR already ends in `events`.
  const safeFolder = folder.replace(/[^a-z0-9-]/gi, "").slice(0, 40);
  return store(file, path.join("uploads", "events", safeFolder));
}

/**
 * A photograph for the home page's slideshow.
 *
 * Same shrinking and same limits as any other upload, in its own folder so the
 * hero can be cleared out without touching event artwork.
 */
export async function uploadHeroImage(file: File): Promise<UploadedImage> {
  return store(file, path.join("uploads", "hero"));
}

/**
 * Shrink, normalise and write one image under `public/<dir>`.
 *
 * The single place an upload touches the disk. `dir` is a path under `public/`
 * and is the caller's business — `uploadImage` for event artwork,
 * `uploadHeroImage` for the slideshow, and the two brand uploaders below for the
 * logo and the tab icon.
 */
async function store(file: File, dir: string): Promise<UploadedImage> {
  const ext = ALLOWED.get(file.type);
  if (!ext) return { ok: false, error: "Upload a PNG, JPEG or WebP image." };
  if (file.size > MAX_UPLOAD_BYTES) {
    return { ok: false, error: "That image is over 12 MB. Compress it and try again." };
  }

  const bytes = Buffer.from(await file.arrayBuffer());

  let output: Buffer;
  let width = 0;
  let height = 0;
  try {
    const image = sharp(bytes).rotate(); // honour EXIF orientation, then forget it
    const meta = await image.metadata();
    const longest = Math.max(meta.width ?? 0, meta.height ?? 0);
    if (!longest) return { ok: false, error: "That image has no dimensions." };
    if (longest > 12000) return { ok: false, error: "That image is too large to read." };

    const resized =
      longest > MAX_EDGE ? image.resize({ width: MAX_EDGE, height: MAX_EDGE, fit: "inside" }) : image;
    output = await (ext === ".png"
      ? resized.png({ compressionLevel: 9 })
      : ext === ".webp"
        ? resized.webp({ quality: 82 })
        : resized.jpeg({ quality: 82, mozjpeg: true })
    ).toBuffer();

    const done = await sharp(output).metadata();
    width = done.width ?? 0;
    height = done.height ?? 0;
  } catch {
    return { ok: false, error: "That file is not a readable image." };
  }

  const relative = path.join(dir, `${randomUUID()}${ext}`).replace(/\\/g, "/");
  const absolute = path.join(process.cwd(), "public", relative);
  await mkdir(path.dirname(absolute), { recursive: true });
  await writeFile(absolute, output);

  return { ok: true, url: `/${relative}`, width, height };
}

/**
 * Removes an upload this module made, and only this module's uploads.
 *
 * The path check is the whole point: a stored URL could have been typed in by
 * hand, and `unlink` on `../../app/page.tsx` would be a bad afternoon.
 */
const REMOVABLE = [path.join("public", "uploads", "events"), path.join("public", "uploads", "hero")];

export async function removeUpload(url: string): Promise<void> {
  if (!url.startsWith("/uploads/events/") && !url.startsWith("/uploads/hero/")) return;
  const absolute = path.join(process.cwd(), "public", url.replace(/^\//, ""));
  const ok = REMOVABLE.some((dir) => absolute.startsWith(path.join(process.cwd(), dir) + path.sep));
  if (!ok) return;
  await unlink(absolute).catch(() => {});
}

/* ------------------------------------------------------------------ *
 *  The school's logo
 * ------------------------------------------------------------------ */

/**
 * The logo, normalised into a square.
 *
 * A crest is nearly always taller than it is wide, and the white circles that
 * show it are square. Padding to a square — rather than cropping — means the
 * bottom of the motto never gets cut off, and the circle stays a circle. Drawn on
 * white first so a transparent PNG does not turn into a black square in an email
 * client (Outlook composites onto white, Gmail onto the message background; the
 * only safe answer is to have no transparency at all).
 *
 * 512 px is four times the biggest circle on the site, which is enough for a
 * retina screen and small enough to travel inline in a mail.
 */
export const LOGO_UPLOAD_DIR = path.join("public", "uploads", "brand");
const LOGO_EDGE = 512;

export async function uploadLogo(file: File): Promise<UploadedImage> {
  const ext = ALLOWED.get(file.type);
  if (!ext) return { ok: false, error: "Upload a PNG, JPEG or WebP image." };
  if (file.size > MAX_UPLOAD_BYTES) {
    return { ok: false, error: "That image is over 12 MB. Compress it and try again." };
  }

  let output: Buffer;
  try {
    const bytes = Buffer.from(await file.arrayBuffer());
    // Transparency is kept.
    //
    // This used to flatten the upload onto white and pad it on white, which
    // produced a square white plate around every transparent crest — and inside
    // the white circle that plate is invisible on a white-background circle but
    // obvious against the navy hero of the email, exactly as reported. The file
    // now keeps its alpha and is padded on transparent, so the only white the
    // mark sits on is the circle the site draws behind it.
    //
    // JPEG and WebP-without-alpha have no transparency to lose, so they are
    // unchanged in practice: they are already opaque.
    output = await sharp(bytes)
      .rotate()
      .resize({
        width: LOGO_EDGE,
        height: LOGO_EDGE,
        fit: "contain",
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      })
      .png({ compressionLevel: 9, palette: false })
      .toBuffer();
  } catch {
    return { ok: false, error: "That file is not a readable image." };
  }

  const relative = path.join("uploads", "brand", `${randomUUID()}.png`).replace(/\\/g, "/");
  const absolute = path.join(process.cwd(), "public", relative);
  await mkdir(path.dirname(absolute), { recursive: true });
  await writeFile(absolute, output);

  return { ok: true, url: `/${relative}`, width: LOGO_EDGE, height: LOGO_EDGE };
}

/* ------------------------------------------------------------------ * *  The browser tab icon ("favicon")
\* ------------------------------------------------------------------ */

/**
 * The tab icon, normalised into a square.
 *
 * A favicon is drawn at 16 px, so the useful thing to do with a 3000 px crest is
 * the opposite of what the hero needs: keep it small and let the mark fill the
 * square. Like the logo, transparency is kept and the padding is transparent —
 * a tab icon on a dark browser theme with a white plate around it looks like a
 * bug, not a brand.
 *
 * PNG only, and not an `.ico`: every browser this shop cares about reads a PNG
 * icon, and an ICO encoder would be a dependency for nothing.
 */
export const FAVICON_EDGE = 512;

export async function uploadFavicon(file: File): Promise<UploadedImage> {
  const ext = ALLOWED.get(file.type);
  if (!ext) return { ok: false, error: "Upload a PNG, JPEG or WebP image." };
  if (file.size > MAX_UPLOAD_BYTES) {
    return { ok: false, error: "That image is over 12 MB. Compress it and try again." };
  }

  let output: Buffer;
  try {
    const bytes = Buffer.from(await file.arrayBuffer());
    output = await sharp(bytes)
      .rotate()
      .resize({
        width: FAVICON_EDGE,
        height: FAVICON_EDGE,
        fit: "contain",
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      })
      .png({ compressionLevel: 9, palette: false })
      .toBuffer();
  } catch {
    return { ok: false, error: "That file is not a readable image." };
  }

  const relative = path.join("uploads", "brand", `icon-${randomUUID()}.png`).replace(/\\/g, "/");
  const absolute = path.join(process.cwd(), "public", relative);
  await mkdir(path.dirname(absolute), { recursive: true });
  await writeFile(absolute, output);

  return { ok: true, url: `/${relative}`, width: FAVICON_EDGE, height: FAVICON_EDGE };
}
