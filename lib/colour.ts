/**
 * A colour, and the dot that shows it.
 *
 * The shop used to print the *name* and leave the colour to the reader: "Navy"
 * on a pill, with no navy anywhere. On a phone that is a word you have to
 * translate; a swatch is the colour itself, and the name underneath is the part
 * that makes it readable aloud or to someone who cannot see the dot.
 *
 * The value has to come from somewhere, and the admin is the right place: the
 * office knows that "House tie green" is the green of the tie. So a product
 * carries `colourSwatches` (name → hex) alongside its colour names, the global
 * Filters list carries the same per colour, and this module is the one place
 * that decides what a dot looks like when nobody has picked one.
 *
 * Client-safe on purpose: the product page, the quick view, the shop grid and
 * the admin all draw the same dot from the same function.
 */

/** Colours the school already sells, so a new product does not start grey. */
export const NAMED_COLOURS: Record<string, string> = {
  Navy: "#12203d",
  Black: "#0b0b0d",
  White: "#f2f1ea",
  Grey: "#6b7280",
  Maroon: "#5b1a2b",
  Green: "#1e3d2f",
  Gold: "#c9a227",
  Sky: "#a9c4dd",
  Khaki: "#8a7a52",
  Cream: "#efe6d2",
  Beige: "#d8c9ae",
  Brown: "#5a3d2b",
  Red: "#8d2230",
  Blue: "#1c3f94",
  Royal: "#1b2f6b",
};

const HEX = /^#[0-9a-f]{6}$/i;

export function isHexColour(value: unknown): value is string {
  return typeof value === "string" && HEX.test(value);
}

/**
 * Words that name a colour family, checked in order.
 *
 * "House tie green" is not in any list and never will be — but the office type
 * it expecting green, and a dot derived from a hash of the letters gave them a
 * dark blue-grey instead. Matching the word is the honest reading of the name;
 * the small variation afterwards keeps two greens from being the same green.
 */
const FAMILIES: Array<[RegExp, keyof typeof NAMED_COLOURS]> = [
  [/navy|midnight/i, "Navy"],
  [/royal|cobalt/i, "Royal"],
  [/sky|powder|baby blue/i, "Sky"],
  [/green|olive|lime|mint|sage|emerald|forest|bottle/i, "Green"],
  [/gold|yellow|mustard|amber|ochre/i, "Gold"],
  [/maroon|claret|burgundy|wine|wine red/i, "Maroon"],
  [/red|scarlet|crimson|cherry/i, "Red"],
  [/blue|indigo|denim|azure|steel/i, "Blue"],
  [/grey|gray|silver|charcoal|slate|graphite/i, "Grey"],
  [/black|ebony|ink|jet/i, "Black"],
  [/white|snow|ivory|off white/i, "White"],
  [/cream|vanilla/i, "Cream"],
  [/beige|oat|nude/i, "Beige"],
  [/khaki|sand|camel|dune/i, "Khaki"],
  [/brown|tan|coffee|chocolate|walnut|cocoa/i, "Brown"],
];

/** A stable 0-359 from the letters, so a name always gets the same dot. */
function hashOf(label: string): number {
  let hash = 0;
  for (let i = 0; i < label.length; i++) hash = (hash * 31 + label.charCodeAt(i)) % 360;
  return hash;
}

/** Nudge a hex lighter or darker, keeping it a hex (an <input type="color"> needs one). */
function shade(hex: string, amount: number): string {
  const channel = (start: number) => {
    const value = parseInt(hex.slice(start, start + 2), 16) + amount;
    return Math.max(0, Math.min(255, Math.round(value)))
      .toString(16)
      .padStart(2, "0");
  };
  return `#${channel(1)}${channel(3)}${channel(5)}`;
}

/** HSL to hex, for the names nothing can recognise. */
function hslHex(hue: number, saturation: number, lightness: number): string {
  const s = saturation;
  const l = lightness;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const h = hue / 60;
  const x = c * (1 - Math.abs((h % 2) - 1));
  const [r1, g1, b1] =
    h < 1 ? [c, x, 0] : h < 2 ? [x, c, 0] : h < 3 ? [0, c, x] : h < 4 ? [0, x, c] : h < 5 ? [x, 0, c] : [c, 0, x];
  const m = l - c / 2;
  const to = (v: number) =>
    Math.round((v + m) * 255)
      .toString(16)
      .padStart(2, "0");
  return `#${to(r1)}${to(g1)}${to(b1)}`;
}

/**
 * The dot for a colour name.
 *
 * Order: what the admin picked for *this* thing, then what the school always
 * sells under that name, then the family the name mentions, then a hue derived
 * from the letters so that a colour the office typed in a second ago is never
 * the grey of every other one. Always a hex, because the picker and the
 * light-or-dark test both need one.
 */
export function colourHex(
  name: string,
  swatches?: Record<string, string> | null
): string {
  const label = (name ?? "").trim();
  if (!label) return "#8b9099";

  const picked = swatches?.[label];
  if (isHexColour(picked)) return picked;

  const named = Object.keys(NAMED_COLOURS).find(
    (key) => key.toLowerCase() === label.toLowerCase()
  );
  if (named) return NAMED_COLOURS[named];

  const hash = hashOf(label);

  const family = FAMILIES.find(([pattern]) => pattern.test(label));
  if (family) {
    // ±14 of brightness: enough that "House tie green" and "Forest green" are
    // distinguishable dots, small enough that both still read as green.
    return shade(NAMED_COLOURS[family[1]], (hash % 29) - 14);
  }

  return hslHex(hash, 0.42, 0.34 + (hash % 7) / 100);
}

/**
 * Is the dot light enough that a white tick on it disappears?
 *
 * Used for the selected colour's tick, which has to read on navy and on cream.
 */
export function isLightColour(hex: string): boolean {
  if (!isHexColour(hex)) return false;
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  // Rec. 709 luma, the same weighting the eye uses.
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255 > 0.6;
}

/** The colour a swatch picker opens on when the shop has never seen the name. */
export function suggestedHex(name: string): string {
  return colourHex(name);
}
