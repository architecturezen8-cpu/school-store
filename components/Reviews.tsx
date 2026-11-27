import { Quote, Star } from "lucide-react";
import type { Review } from "@/lib/store";
import Reveal from "@/components/Reveal";
import SectionHead from "@/components/SectionHead";

function Stars({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-1">
      {Array.from({ length: 5 }).map((_, i) => (
        <Star
          key={i}
          size={13}
          className={i < rating ? "fill-gold text-gold" : "fill-white/15 text-white/15"}
        />
      ))}
    </div>
  );
}

export default function Reviews({ reviews }: { reviews: Review[] }) {
  return (
    <section id="community" className="relative py-20 md:py-28">
      <div className="pointer-events-none absolute left-0 top-1/3 h-[460px] w-[min(80vw,540px)] -translate-x-1/3 rounded-full bg-[radial-gradient(closest-side,rgba(22,36,74,0.5),transparent)]" />

      <div className="relative mx-auto max-w-[1400px] px-5 lg:px-10">
        <SectionHead
          eyebrow="Our Community"
          title="Thomians worldwide"
          sub="Kind words from the Thomian family — students, parents and old boys, from Matale to every corner of the globe."
        />

        <Reveal delay={150}>
          <div className="bento mx-auto mt-8 flex w-fit items-center gap-3 px-6 py-4">
            <Stars rating={5} />
            <span className="text-sm text-white/50">
              <span className="font-semibold text-white">4.9 / 5</span> · 800+ reviews
            </span>
          </div>
        </Reveal>

        {/* one clean row of four */}
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {reviews.map((r, i) => (
            <Reveal key={r.name} delay={i * 110} className="h-full">
              <figure className="bento bento-lift flex h-full flex-col p-6">
                <div className="flex items-center justify-between">
                  <span className="grid h-11 w-11 place-items-center rounded-full border border-white/15 bg-navy-800 font-display text-base font-semibold text-white">
                    {r.name.charAt(0)}
                  </span>
                  <Quote size={20} className="fill-white/10 text-white/50" />
                </div>

                <div className="mt-5">
                  <Stars rating={r.rating} />
                </div>

                <blockquote className="mt-4 flex-1 text-sm leading-relaxed text-white/65">
                  “{r.text}”
                </blockquote>

                <figcaption className="mt-6 border-t border-white/10 pt-4">
                  <p className="text-sm font-semibold text-white">{r.name}</p>
                  <p className="mt-0.5 text-xs text-white/60">{r.role}</p>
                </figcaption>
              </figure>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
