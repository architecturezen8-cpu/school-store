import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { isAdmin } from "@/lib/admin/auth";
import { hasDatabase } from "@/lib/db";
import { getHeroForAdmin } from "@/lib/hero-db";
import HeroSlides from "@/components/admin/HeroSlides";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Hero slideshow",
  robots: { index: false, follow: false },
};

/** The three photographs behind the school's name on the home page. */
export default async function HeroPage() {
  if (!(await isAdmin())) redirect("/admin?next=/admin/hero");
  if (!hasDatabase()) redirect("/admin?error=database");

  const { slides, showing, saved, problem } = await getHeroForAdmin();

  return (
    <div className="rounded-2xl bg-panel p-6">
      <HeroSlides initial={slides} showing={showing} saved={saved} problem={problem} />
    </div>
  );
}
