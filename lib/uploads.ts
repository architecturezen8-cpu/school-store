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

  // `folder` is a sub-folder *inside* uploads/events, not the folder itself —
  // EVENT_UPLOAD_DIR already ends in `events`.
  const safeFolder = folder.replace(/[^a-z0-9-]/gi, "").slice(0, 40);
  const relative = path
    .join("uploads", "events", safeFolder, `${randomUUID()}${ext}`)
    .replace(/\\/g, "/");
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
export async function removeUpload(url: string): Promise<void> {
  if (!url.startsWith("/uploads/events/")) return;
  const absolute = path.join(process.cwd(), "public", url.replace(/^\//, ""));
  const root = path.join(process.cwd(), EVENT_UPLOAD_DIR);
  if (!absolute.startsWith(root + path.sep)) return;
  await unlink(absolute).catch(() => {});
}
