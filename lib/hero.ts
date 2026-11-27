import { heroSlides as seedHeroSlides } from "@/data/seed";
import { asset } from "./assets";

/** Hero rotation — client-safe (no database imports). */
export const heroSlides = seedHeroSlides.map((s) => ({ ...s, image: asset(s.image) }));
