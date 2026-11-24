import sharp from "sharp";

/**
 * Finds the plain white square in an uploaded ticket design.
 *
 * The admin drops a white square into their artwork — no pixel coordinates, no
 * guessing in a form. A square is a square: we scan rows of near-white pixels,
 * measure how tall the run is, and keep the largest region that is as wide as it
 * is tall. Padding inside the artwork is fine (the square itself is white, the
 * space around it can be anything), and so is a white square that is not
 * perfectly aligned to the pixel grid.
 *
 * Returns null when there is no square, and the caller tells the admin to add
 * one — much better than silently pasting a QR somewhere arbitrary.
 */

export type DetectedSquare = {
  x: number;
  y: number;
  size: number;
  /** How "square" and how large the accepted candidate was, for diagnostics. */
  confidence: number;
};

export type DetectOptions = {
  /** 0–255. A pixel counts as white when all channels are at least this. */
  threshold?: number;
  /** Ignore candidates smaller than this fraction of the image's short side. */
  minFraction?: number;
};

const CHANNELS = 3;

/** True when the pixel at (x, y) is within `threshold` of pure white. */
function isWhiteAt(
  data: Buffer,
  width: number,
  x: number,
  y: number,
  threshold: number
): boolean {
  const i = (y * width + x) * CHANNELS;
  return (
    data[i] >= threshold && data[i + 1] >= threshold && data[i + 2] >= threshold
  );
}

export async function detectWhiteSquare(
  input: Buffer | string,
  options: DetectOptions = {}
): Promise<DetectedSquare | null> {
  const threshold = options.threshold ?? 244;
  const minFraction = options.minFraction ?? 0.08;

  const { data, info } = await sharp(input)
    .flatten({ background: "#ffffff" }) // a transparent PNG has no "white"
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const width = info.width;
  const height = info.height;
  const shortSide = Math.min(width, height);
  const minSize = Math.max(32, Math.floor(shortSide * minFraction));

  let best: DetectedSquare | null = null;

  // Sample every few pixels: a square that is at least 8% of the short side is
  // many pixels wide, so a sparse grid cannot miss it, and this stays fast on a
  // 4K design.
  const step = Math.max(1, Math.floor(shortSide / 400));

  for (let y = 0; y < height; y += step) {
    // Once a candidate is found, everything inside it is white and would just
    // re-derive the same square — skip that band entirely. Without this a
    // mostly-white design costs seconds, because every scan point inside the
    // region walks the whole run again.
    if (best && y >= best.y && y < best.y + best.size) continue;

    for (let x = 0; x < width; x += step) {
      if (best && x >= best.x && x < best.x + best.size && y >= best.y) {
        x = best.x + best.size; // jump past the known square's column range
        continue;
      }
      if (!isWhiteAt(data, width, x, y, threshold)) continue;

      // Grow right along this row, then down the first column of the run.
      let runWidth = 0;
      while (
        x + runWidth < width &&
        isWhiteAt(data, width, x + runWidth, y, threshold)
      ) {
        runWidth += 1;
      }
      if (runWidth < minSize) continue;

      let runHeight = 0;
      while (
        y + runHeight < height &&
        isWhiteAt(data, width, x, y + runHeight, threshold)
      ) {
        runHeight += 1;
      }
      if (runHeight < minSize) continue;

      // A square's width and height agree. Allow a few percent of slop for
      // anti-aliased edges.
      const size = Math.min(runWidth, runHeight);
      const skew = Math.abs(runWidth - runHeight) / size;
      if (skew > 0.06) continue;

      // The run we grew rightwards might start partway into the square if the
      // scan grid landed on a column that is only white inside the region —
      // walk left while it stays white to find the true left edge.
      let left = x;
      while (
        left > 0 &&
        isWhiteAt(data, width, left - 1, y, threshold)
      ) {
        left -= 1;
      }
      let runWidthLeft = 0;
      while (
        left + runWidthLeft < width &&
        isWhiteAt(data, width, left + runWidthLeft, y, threshold)
      ) {
        runWidthLeft += 1;
      }

      // Same for the top edge.
      let top = y;
      while (top > 0 && isWhiteAt(data, width, left, top - 1, threshold)) {
        top -= 1;
      }
      let runHeightUp = 0;
      while (
        top + runHeightUp < height &&
        isWhiteAt(data, width, left, top + runHeightUp, threshold)
      ) {
        runHeightUp += 1;
      }

      const finalSize = Math.min(runWidthLeft, runHeightUp);
      const finalSkew =
        finalSize > 0 ? Math.abs(runWidthLeft - runHeightUp) / finalSize : 1;
      if (finalSize < minSize || finalSkew > 0.06) continue;

      const confidence =
        (finalSize / shortSide) * (1 - finalSkew) * (1 - (threshold - 240) / 64);

      if (!best || finalSize > best.size) {
        best = {
          x: left,
          y: top,
          size: finalSize,
          confidence: Math.max(0, Math.min(1, confidence)),
        };
      }
    }
  }

  return best;
}

/**
 * The QR payload for a booking, and how big its square has to be to be usable.
 *
 * Measured, not guessed. A phone camera needs roughly 5 pixels per module before
 * it can read a code off a screen or a printed ticket, and the QR is pasted at
 * 80% of the square:
 *
 *   86-char URL, 53×53 modules → needs a 330 px square
 *   69-char URL, 41×41 modules → needs a 255 px square
 *
 * A ticket is laid out at its natural size — a 1440 px design is shown around
 * 380 px wide in a mail client — so the square is also checked as a *fraction of
 * the design*, not just in pixels. A square that is 25% of a 1440 px design and
 * one that is 25% of an 800 px design are equally scannable on a phone, while an
 * absolute pixel count would pass the first and fail the second for no reason.
 */
export const MIN_MODULES_PER_SIDE = 5;

export type SquareVerdict =
  | { ok: true; qrPx: number; pxPerModule: number }
  | { ok: false; reason: string };

/**
 * @param square      the detected square, in design pixels
 * @param designSize  { width, height } of the whole design
 * @param modules     how many modules the QR for this payload has
 */
export function checkSquareForQr(
  square: DetectedSquare,
  designSize: { width: number; height: number },
  modules: number
): SquareVerdict {
  const needed = modules * MIN_MODULES_PER_SIDE;
  const qrPx = Math.round(square.size * 0.8);
  const pxPerModule = qrPx / modules;

  if (square.size >= needed) {
    return { ok: true, qrPx, pxPerModule };
  }

  // Too small in absolute pixels — is it still large *for this design*? A 1200 px
  // design printed at 100 mm gives the code 10 mm, which scans; the same 1200 px
  // design shown 380 px wide in a mail client does not. The practical floor is
  // the fraction, so accept a design where the square is at least the fraction
  // below, and tell the admin exactly what to fix when it is not.
  const fraction = square.size / Math.min(designSize.width, designSize.height);
  const MIN_FRACTION = 0.18;

  if (fraction >= MIN_FRACTION) {
    return { ok: true, qrPx, pxPerModule };
  }

  return {
    ok: false,
    reason:
      `The white square is ${square.size}px, which is ${Math.round(fraction * 100)}% of the ` +
      `design. The QR code needs about ${needed}px here to scan reliably. ` +
      `Make the square at least ${Math.ceil(needed / 10) * 10}px — or about ${Math.round(
        MIN_FRACTION * 100
      )}% of the design's shorter side — and upload again.`,
  };
}

/**
 * How many modules the QR for `payload` will have. Used before a design is
 * accepted, so the admin is told the truth rather than a guessed 160 px.
 */
export async function qrModuleCount(qrPayload: string): Promise<number> {
  const { default: QRCode } = await import("qrcode");
  const { modules } = await QRCode.create(qrPayload, { errorCorrectionLevel: "H" });
  return modules.size;
}

/**
 * Pastes a QR code into a detected square, leaving an inner margin so the code
 * is not flush to the artwork's edge (a QR needs a quiet zone to scan reliably).
 *
 * `inset` is the fraction of the square left as padding on each side. The spec
 * the admin works to is "use about 80% of the square", which is exactly
 * inset ≈ 0.10.
 */
export async function composeTicket({
  design,
  qrPayload,
  square,
  inset = 0.1,
  format = "png",
}: {
  design: Buffer | string;
  qrPayload: string;
  square: DetectedSquare;
  inset?: number;
  format?: "png" | "jpeg";
}): Promise<{ image: Buffer; width: number; height: number }> {
  const { default: QRCode } = await import("qrcode");

  // A QR code needs about 4 pixels per module before a camera can resolve it
  // reliably. A long URL makes a dense code (a 22-character signature pushes it
  // to 53×53 modules, i.e. 212 px minimum); the `qrcode` encoder quietly
  // *upscales* to that minimum, which would push the code past the square the
  // admin drew and over their artwork. Hold the modules at 1 px and paste at the
  // width we actually have, so `qrcode` cannot round up behind our back.
  const qr = await QRCode.toBuffer(qrPayload, {
    type: "png",
    scale: 1,
    margin: 0,
    errorCorrectionLevel: "H", // survives a crease or a dirty phone lens
    color: { dark: "#000000", light: "#ffffff" },
  });

  // Size the QR from how many modules it actually has, never from an assumed
  // minimum, then fit it inside the square. `inset` is the quiet zone.
  const modules = (await sharp(qr).metadata()).width ?? 21;
  const target = Math.max(1, Math.floor(square.size * (1 - inset * 2)));
  const size = Math.max(modules, target); // below 1 px/module nothing scans anyway

  const pad = Math.max(0, Math.floor((square.size - size) / 2));

  const scaled = await sharp(qr)
    .resize(size, size, { kernel: "nearest" }) // never blur a QR's edges
    .png()
    .toBuffer();

  const meta = await sharp(design).metadata();

  const image = await sharp(design)
    .composite([
      {
        input: scaled,
        left: square.x + pad,
        top: square.y + pad,
      },
    ])
    .toFormat(format, format === "jpeg" ? { quality: 92 } : {})
    .toBuffer();

  return { image, width: meta.width ?? 0, height: meta.height ?? 0 };
}
