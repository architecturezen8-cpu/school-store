import Hero from "@/components/Hero";
import Categories from "@/components/Categories";
import Featured from "@/components/Featured";
import Motto from "@/components/Motto";
import Reviews from "@/components/Reviews";
import { getFeaturedProducts, getHomeCategories, getReviews } from "@/lib/store";
import { getHeroSlides } from "@/lib/hero-db";

// Catalogue content changes rarely; revalidate instead of querying per request.
export const revalidate = 300;

export default async function HomePage() {
  const [categories, featured, reviews, slides] = await Promise.all([
    getHomeCategories(),
    getFeaturedProducts(),
    getReviews(),
    getHeroSlides(),
  ]);

  return (
    <>
      <Hero slides={slides} />
      <Categories categories={categories} />
      <Featured products={featured} />
      <Motto />
      <Reviews reviews={reviews} />
    </>
  );
}
