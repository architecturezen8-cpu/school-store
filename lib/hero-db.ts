import { query } from "./db";
import { errorMessage } from "./errors";
import { SEED_HERO, type HeroSlide } from "./hero";

/**
 * The home page's slideshow, stored.
 *
 * It used to be three files in `data/seed.ts`: changing the photographs meant a
 * developer and a deploy. The office changes the front of the school's shop more
 * often than that, so the slides are rows now — uploaded in the admin, with a
 * caption that is also the alt text.
 *
 * A shop that has never touched them has no rows, and then the built-in three
 * are what the page shows: an empty table must not mean a blank hero.
 */

type Row = {
  id: string;
  image: string;
  caption: string | null;
  position: number;
};

const toSlide = (r: Row): HeroSlide => ({
  id: r.id,
  image: r.image,
  caption: r.caption ?? "",
  position: Number(r.position),
});

/** What the home page should show. Never throws: a missing table is the seed. */
export async function getHeroSlides(): Promise<HeroSlide[]> {
  try {
    const rows = await query<Row>(
      "select id, image, caption, position from hero_slides where active order by position, id"
    );
    return rows.length ? rows.map(toSlide) : SEED_HERO;
  } catch (err) {
    console.error("[hero] could not read the slides:", errorMessage(err));
    return SEED_HERO;
  }
}

export type HeroAdminState = {
  /** Rows the office owns. Empty until they import or upload. */
  slides: HeroSlide[];
  /** What the home page is actually showing right now. */
  showing: HeroSlide[];
  /** False when the table is empty and the page is showing the built-in three. */
  saved: boolean;
  /** Why the built-in three are on screen, when they are because of an error. */
  problem: string;
};

export async function getHeroForAdmin(): Promise<HeroAdminState> {
  try {
    const rows = await query<Row>(
      "select id, image, caption, position from hero_slides order by position, id"
    );
    const slides = rows.map(toSlide);
    return {
      slides,
      showing: slides.length ? slides : SEED_HERO,
      saved: slides.length > 0,
      problem: "",
    };
  } catch (err) {
    return {
      slides: [],
      showing: SEED_HERO,
      saved: false,
      problem: `The slides could not be read: ${errorMessage(err)}`,
    };
  }
}

/** Add or update one slide. `id` empty means "append". */
export async function saveHeroSlide(input: {
  id?: string;
  image: string;
  caption: string;
}): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const image = input.image.trim();
  if (!image) return { ok: false, error: "A slide needs a photograph." };
  const caption = input.caption.trim().slice(0, 160);

  try {
    if (input.id) {
      const rows = await query<{ id: string }>(
        "update hero_slides set image = $2, caption = $3 where id = $1 returning id",
        [input.id, image, caption]
      );
      if (!rows.length) return { ok: false, error: "That slide is gone. Reload the page." };
      return { ok: true, id: rows[0].id };
    }

    const rows = await query<{ id: string }>(
      `insert into hero_slides (image, caption, position)
       values ($1, $2, coalesce((select max(position) + 1 from hero_slides), 0))
       returning id`,
      [image, caption]
    );
    return { ok: true, id: rows[0].id };
  } catch (err) {
    return { ok: false, error: errorMessage(err) };
  }
}

export async function deleteHeroSlide(id: string): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    await query("delete from hero_slides where id = $1", [id]);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: errorMessage(err) };
  }
}

/**
 * Copy the built-in three into the table.
 *
 * Offered as a button rather than done on first read: a page that writes to the
 * database when it is opened is a page that cannot be trusted to be read-only.
 */
export async function importSeedHero(): Promise<{ ok: true; count: number } | { ok: false; error: string }> {
  try {
    const existing = await query<{ n: number }>("select count(*)::int as n from hero_slides");
    const already = Number(existing[0]?.n ?? 0);
    if (already > 0) return { ok: true, count: already };

    // Checked once, not per row: once the first slide is in, the table is no
    // longer empty and a per-row guard would silently drop slides two and three.
    for (const [i, slide] of SEED_HERO.entries()) {
      await query("insert into hero_slides (image, caption, position) values ($1, $2, $3)", [
        slide.image,
        slide.caption,
        i,
      ]);
    }
    return { ok: true, count: SEED_HERO.length };
  } catch (err) {
    return { ok: false, error: errorMessage(err) };
  }
}
