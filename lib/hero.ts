import { heroSlides as seedHeroSlides } from "@/data/seed";
import { asset } from "./assets";

/**
 * The photographs behind the home page, as the page and the admin both see them.
 *
 * Client-safe: no database import here, so the hero (a client component) can
 * import the type and the built-in fallback without dragging `pg` into the
 * browser bundle. The database side lives in `lib/hero-db.ts`.
 */

export type HeroSlide = {
  /** `seed-0…` for the built-in three, a uuid for one the office uploaded. */
  id: string;
  image: string;
  /** Read out by a screen reader and printed in the admin list. */
  caption: string;
  position: number;
};

/** The three that ship with the app, used until the office replaces them. */
export const SEED_HERO: HeroSlide[] = seedHeroSlides.map((s, i) => ({
  id: `seed-${i}`,
  image: asset(s.image),
  caption: s.caption,
  position: i,
}));

export function heroSlides(slides?: HeroSlide[] | null): HeroSlide[] {
  return slides && slides.length ? slides : SEED_HERO;
}
