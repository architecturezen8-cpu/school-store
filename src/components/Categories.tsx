import { ArrowUpRight } from "lucide-react";
import { homeCategories } from "../data";
import Reveal from "./Reveal";
import SectionHead from "./SectionHead";

const stats = [
  { value: "1873", label: "Heritage since" },
  { value: "52+", label: "Store products" },
  { value: "4.9★", label: "Thomian rated" },
];

export default function Categories() {
  return (
    <section id="shop" className="relative py-20 md:py-28">
      <div className="pointer-events-none absolute left-1/2 top-0 h-[420px] w-[min(90vw,760px)] -translate-x-1/2 -translate-y-1/3 rounded-full bg-[radial-gradient(closest-side,rgba(19,34,80,0.4),transparent)]" />

      <div className="relative mx-auto max-w-[1400px] px-5 lg:px-10">
        <SectionHead
          eyebrow="College Store"
          title="Everything a Thomian needs"
          sub="Three collections, one crest — from the stands on Big Match day to the classroom every morning."
        />

        {/* ---------- bento grid ---------- */}
        <div className="mt-12 grid gap-4 md:grid-cols-4 md:grid-rows-2">
          {homeCategories.map((c, i) => (
            <Reveal
              key={c.slug}
              delay={i * 120}
              className={
                i === 0
                  ? "md:col-span-2 md:row-span-2"
                  : i === 1
                    ? "md:col-span-2"
                    : "md:col-span-1"
              }
            >
              <a
                href={`#/shop/${c.slug}`}
                className={`group bento bento-lift flex h-full flex-col justify-end ${
                  i === 0 ? "min-h-[420px] md:min-h-0" : "min-h-[260px]"
                }`}
              >
                <img
                  src={c.image}
                  alt={c.title}
                  className="absolute inset-0 h-full w-full object-cover transition-transform duration-[1200ms] ease-out group-hover:scale-[1.06]"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-ink via-ink/45 to-transparent" />
                <div className="absolute inset-0 bg-gradient-to-br from-navy-900/60 to-transparent opacity-60" />

                <span className="absolute left-6 top-5 text-[10px] font-bold uppercase tracking-[0.3em] text-white/50">
                  0{i + 1}
                </span>
                <span className="absolute right-5 top-4 rounded-full bg-ink px-3.5 py-2 text-[10px] font-bold uppercase tracking-[0.15em] text-white">
                  {c.count}
                </span>

                <div className="relative p-7">
                  <h3 className="font-display text-2xl font-semibold md:text-3xl">
                    {c.title}
                  </h3>
                  <p
                    className={`mt-2.5 max-w-md text-sm leading-relaxed text-white/60 ${
                      i === 1 ? "hidden sm:block" : i === 0 ? "" : "hidden"
                    }`}
                  >
                    {c.desc}
                  </p>
                  <div className="mt-5 flex items-center gap-2.5 text-[11px] font-bold uppercase tracking-[0.24em] text-white">
                    Browse
                    <span className="grid h-8 w-8 place-items-center rounded-full bg-accent text-ink transition-transform duration-300 group-hover:rotate-45">
                      <ArrowUpRight size={14} />
                    </span>
                  </div>
                </div>
              </a>
            </Reveal>
          ))}
        </div>

        {/* ---------- elegant stats rule ---------- */}
        <Reveal delay={200}>
          <div className="mt-16 border-t border-white/10 pt-10">
            <dl className="grid grid-cols-1 divide-y divide-white/10 sm:grid-cols-3 sm:divide-x sm:divide-y-0">
              {stats.map((s) => (
                <div
                  key={s.label}
                  className="flex flex-col items-center px-6 py-4 text-center"
                >
                  <dt className="font-display text-[2.1rem] font-semibold leading-none tracking-tight text-white">
                    {s.value}
                  </dt>
                  <dd className="mt-3 text-[10px] font-semibold uppercase tracking-[0.3em] text-white/40">
                    {s.label}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
