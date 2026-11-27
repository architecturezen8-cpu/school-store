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

/**
 * The white border a QR needs around it, in modules.
 *
 * Four is the number in the standard, and it is not decoration: a scanner finds
 * the symbol's edge by the contrast between the code and the *white* around it.
 * With no quiet zone the code ends against the artwork and many phones just do
 * not lock on.
 */
export const QUIET_MODULES = 4;

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
  // The quiet zone counts: the symbol the camera has to find is the data modules
  // *plus* the white border around them, and `composeTicket` draws both.
  const { modules } = await QRCode.create(qrPayload, { errorCorrectionLevel: "Q" });
  return modules.size + QUIET_MODULES * 2;
}

/**
 * Pastes a QR code into a detected square.
 *
 * `inset` is the fraction of the square left as padding on each side. It is
 * small on purpose: the code now carries its own quiet zone (four modules of
 * white, inside the image), so the white square is already the margin. Leaving
 * 10% of the square empty as padding *as well* just made the code smaller than
 * it needed to be — and a smaller code is the one that does not scan.
 *
 * The admin's rule is unchanged: draw a white square about a fifth of the
 * design, and the code fills it.
 */
export async function composeTicket({
  design,
  qrPayload,
  square,
  inset = 0.03,
  format = "png",
}: {
  design: Buffer | string;
  qrPayload: string;
  square: DetectedSquare;
  inset?: number;
  format?: "png" | "jpeg";
}): Promise<{ image: Buffer; width: number; height: number }> {
  const { default: QRCode } = await import("qrcode");

  /**
   * Why the code is built this way — it is the answer to "sometimes it does not
   * scan", and every line here is one of the reasons.
   *
   *   · **A quiet zone.** The code used to be drawn edge to edge (`margin: 0`).
   *     Screenshots of real tickets showed the symbol ending wherever the white
   *     square ended, so there was nothing for a scanner to find the edge
   *     against. Four modules of white now travel *inside* the image, which is
   *     free — the square is white anyway.
   *   · **Level Q, not H.** The heaviest error correction makes the symbol about
   *     a third denser: more, smaller modules for the same physical width. On a
   *     phone screen at arm's length that is a worse trade than the redundancy it
   *     buys. Q still recovers a quarter of the code — a crease, a thumbprint.
   *   · **Whole pixels per module.** Resizing 41 modules into an arbitrary width
   *     gives modules 7.3 px wide and, after rounding, some 7 and some 8. Scanners
   *     expect a grid. The code is sized to an exact multiple of its module count
   *     and centred in the square.
   *   · **Enough pixels.** If the design gives the square too few pixels, the
   *     artwork is scaled up rather than the code being drawn too fine to read.
   *
   * None of this changes the design: the QR still fills the white square the
   * admin drew, at about 80% of it.
   */
  const MIN_PX_PER_MODULE = 4;

  const qr = await QRCode.toBuffer(qrPayload, {
    type: "png",
    scale: 1,
    margin: QUIET_MODULES,
    errorCorrectionLevel: "Q",
    color: { dark: "#000000", light: "#ffffff" },
  });

  // `margin` is part of the buffer's width, so this is the whole symbol: data
  // modules plus the quiet zone on both sides.
  let qrModules = (await sharp(qr).metadata()).width ?? 29;
  if (!qrModules) qrModules = 29;

  let designBuffer = design;
  let squareOut = { ...square };
  const designMeta = await sharp(design).metadata();
  const designWidth = designMeta.width ?? 0;

  // Too few pixels under the code? Scale the artwork up — capped at 3×, because
  // a 300 px design blown up eight times is a different problem.
  if (square.size > 0 && square.size < qrModules * MIN_PX_PER_MODULE && designWidth) {
    const factor = Math.min(3, Math.ceil((qrModules * MIN_PX_PER_MODULE) / square.size));
    if (factor > 1) {
      designBuffer = await sharp(design)
        .resize({ width: Math.round(designWidth * factor), kernel: "lanczos3" })
        .png()
        .toBuffer();
      squareOut = {
        x: Math.round(square.x * factor),
        y: Math.round(square.y * factor),
        size: Math.round(square.size * factor),
        confidence: square.confidence,
      };
    }
  }

  // The admin's inset is the breathing room around the symbol; the quiet zone is
  // already inside the image, so this only has to keep it off the artwork.
  const usable = Math.max(qrModules, Math.floor(squareOut.size * (1 - inset * 2)));
  const perModule = Math.max(1, Math.floor(usable / qrModules));
  const size = perModule * qrModules;

  const scaled = await sharp(qr)
    .resize(size, size, { kernel: "nearest" }) // never blur a QR's edges
    .png()
    .toBuffer();

  const meta = await sharp(designBuffer).metadata();

  // Centred in the square, and clamped inside the artwork: a code that overhangs
  // the white onto dark print has a quiet zone on three sides only.
  const pad = Math.max(0, Math.floor((squareOut.size - size) / 2));
  const maxLeft = Math.max(0, (meta.width ?? size) - size);
  const maxTop = Math.max(0, (meta.height ?? size) - size);

  const image = await sharp(designBuffer)
    .composite([
      {
        input: scaled,
        left: Math.min(squareOut.x + pad, maxLeft),
        top: Math.min(squareOut.y + pad, maxTop),
      },
    ])
    .toFormat(format, format === "jpeg" ? { quality: 95 } : {})
    .toBuffer();

  return { image, width: meta.width ?? 0, height: meta.height ?? 0 };
}
