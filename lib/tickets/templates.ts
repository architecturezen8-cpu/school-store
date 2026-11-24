import { mkdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import sharp from "sharp";
import { query } from "../db";
import { detectWhiteSquare } from "./detect";

/**
 * Ticket designs uploaded by the admin.
 *
 * The artwork lives on disk (`public/uploads/templates/`), the metadata in
 * Postgres. Keeping the bytes out of the database means the ticket email can
 * point a plain <img> at a file instead of streaming megabytes through a row.
 */

export const TEMPLATE_DIR = path.join("public", "uploads", "templates");

/** What sharp can read and what a browser will show. */
const ALLOWED_TYPES = new Map([
  ["image/png", ".png"],
  ["image/jpeg", ".jpg"],
  ["image/webp", ".webp"],
]);

/** 8 MB is generous for a designed ticket and stops a 90 MB phone photo. */
export const MAX_TEMPLATE_BYTES = 8 * 1024 * 1024;

export type TicketTemplate = {
  id: string;
  slug: string;
  event: string | null;
  name: string;
  file: string;
  width: number;
  height: number;
  qrX: number;
  qrY: number;
  qrSize: number;
  isActive: boolean;
  createdAt: string;
};

type Row = {
  id: string;
  slug: string;
  event: string | null;
  name: string;
  file: string;
  width: number;
  height: number;
  qr_x: number;
  qr_y: number;
  qr_size: number;
  is_active: boolean;
  created_at: string;
};

const toTemplate = (r: Row): TicketTemplate => ({
  id: r.id,
  slug: r.slug,
  event: r.event,
  name: r.name,
  file: r.file,
  width: Number(r.width),
  height: Number(r.height),
  qrX: Number(r.qr_x),
  qrY: Number(r.qr_y),
  qrSize: Number(r.qr_size),
  isActive: r.is_active,
  createdAt: r.created_at,
});

const COLUMNS = `id, slug, event, name, file, width, height, qr_x, qr_y, qr_size, is_active, created_at`;

/** Every template, newest first — for the admin list. */
export async function listTemplates(): Promise<TicketTemplate[]> {
  const rows = await query<Row>(
    `select ${COLUMNS} from ticket_templates order by created_at desc`
  );
  return rows.map(toTemplate);
}

/** The design a booking for `event` should use: a per-event one, else the default. */
export async function getTemplateForEvent(
  event: string
): Promise<TicketTemplate | null> {
  const rows = await query<Row>(
    `select ${COLUMNS} from ticket_templates
      where is_active and (event = $1 or event is null)
      order by event nulls last, created_at desc
      limit 1`,
    [event]
  );
  return rows[0] ? toTemplate(rows[0]) : null;
}

export type UploadResult =
  | { ok: true; template: TicketTemplate }
  | { ok: false; error: string };

/**
 * Stores a design and records where its white square is.
 *
 * Rejects anything without a usable square up front, with the reason, rather
 * than failing later when the first customer buys a ticket.
 */
export async function uploadTemplate({
  file,
  name,
  event,
  slug,
}: {
  file: File;
  name: string;
  event: string | null;
  slug: string;
}): Promise<UploadResult> {
  const ext = ALLOWED_TYPES.get(file.type);
  if (!ext) {
    return { ok: false, error: "Upload a PNG, JPEG or WebP image." };
  }
  if (file.size > MAX_TEMPLATE_BYTES) {
    return { ok: false, error: "That image is over 8 MB. Compress it and try again." };
  }
  if (!/^[a-z0-9-]{2,60}$/.test(slug)) {
    return {
      ok: false,
      error: "Slug must be lowercase letters, numbers and dashes (2–60 characters).",
    };
  }

  const bytes = Buffer.from(await file.arrayBuffer());

  let meta: { width?: number; height?: number };
  try {
    meta = await sharp(bytes).metadata();
  } catch {
    return { ok: false, error: "That file is not a readable image." };
  }
  if (!meta.width || !meta.height) {
    return { ok: false, error: "That image has no dimensions." };
  }
  if (Math.max(meta.width, meta.height) > 6000) {
    return { ok: false, error: "Keep the image under 6000 px on its longest side." };
  }

  const square = await detectWhiteSquare(bytes);
  if (!square) {
    return {
      ok: false,
      error:
        "No white square found in the design. Add a solid white square where the QR code should go — it can be any size, as long as its width and height match.",
    };
  }
  if (square.size < 160) {
    return {
      ok: false,
      error: `The white square is only ${square.size}px. Make it at least 160px so the QR code is scannable.`,
    };
  }

  const id = randomUUID();
  const relative = path.join("uploads", "templates", `${id}${ext}`).replace(/\\/g, "/");
  const absolute = path.join(process.cwd(), "public", relative);

  await mkdir(path.dirname(absolute), { recursive: true });
  await writeFile(absolute, bytes);

  try {
    const rows = await query<Row>(
      `insert into ticket_templates
         (id, slug, event, name, file, width, height, qr_x, qr_y, qr_size)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       returning ${COLUMNS}`,
      [
        id,
        slug,
        event,
        name.slice(0, 120),
        `/${relative}`,
        meta.width,
        meta.height,
        square.x,
        square.y,
        square.size,
      ]
    );
    return { ok: true, template: toTemplate(rows[0]) };
  } catch (err) {
    await unlink(absolute).catch(() => {});
    const message = (err as Error).message;
    if (/duplicate key/i.test(message)) {
      return { ok: false, error: `The slug "${slug}" is already used by another template.` };
    }
    return { ok: false, error: `Could not save the template: ${message}` };
  }
}

/** Turns a template off without deleting it, so old emails keep working. */
export async function setTemplateActive(id: string, active: boolean) {
  await query(
    "update ticket_templates set is_active = $2, updated_at = now() where id = $1",
    [id, active]
  );
}

/** Deletes the row and the file on disk. */
export async function deleteTemplate(id: string) {
  const rows = await query<{ file: string }>(
    "delete from ticket_templates where id = $1 returning file",
    [id]
  );
  const file = rows[0]?.file;
  if (!file) return false;
  // Only ever unlink inside our own uploads directory.
  const absolute = path.join(process.cwd(), "public", file.replace(/^\//, ""));
  if (absolute.startsWith(path.join(process.cwd(), TEMPLATE_DIR))) {
    await unlink(absolute).catch(() => {});
  }
  return true;
}
