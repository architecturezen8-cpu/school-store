"use client";

import LogoBadge from "@/components/LogoBadge";
import { useBrand } from "@/components/context/BrandContext";
import Reveal from "@/components/Reveal";

const marks = ["Est. 1873", "150+ years", "6,000+ Thomians"];

export default function Motto() {
  const { logo, scale: logoScale } = useBrand();
  return (
    <section className="relative overflow-hidden py-24 md:py-32">
      {/* soft navy halo behind the crest */}
      <div className="pointer-events-none absolute left-1/2 top-1/2 h-[560px] w-[min(92vw,820px)] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(closest-side,rgba(22,36,74,0.42),transparent)]" />

      <div className="relative mx-auto max-w-2xl px-5 text-center">
        {/* crest */}
        <Reveal>
          <div className="relative mx-auto grid h-56 w-56 place-items-center md:h-64 md:w-64">
            {/* aura */}
            <div className="absolute inset-0 animate-[aura_5.5s_ease-in-out_infinite] rounded-full bg-[radial-gradient(closest-side,rgba(255,255,255,0.14),transparent_72%)]" />
            <div
              className="absolute inset-0 animate-[aura_5.5s_ease-in-out_infinite_1.8s] rounded-full bg-[radial-gradient(closest-side,rgba(30,48,96,0.6),transparent_74%)]"
            />
            <div className="absolute inset-6 rounded-full shadow-[0_0_90px_rgba(255,255,255,0.22)]" />

            {/* rings */}
            <span className="absolute inset-0 animate-[ring-pulse_4.5s_ease-out_infinite] rounded-full border border-white/25" />
            <span className="absolute inset-0 animate-[ring-pulse_4.5s_ease-out_infinite_2.2s] rounded-full border border-white/15" />
            <span className="absolute -inset-4 animate-[spin-slow_34s_linear_infinite] rounded-full border border-dashed border-white/20" />

            {/* The big mark, in the same white circle the navbar uses — so an
                uploaded logo looks deliberate here rather than pasted in. */}
            <LogoBadge
              src={logo}
              size={176}
              scale={logoScale}
              decorative={false}
              className="relative shadow-[0_0_70px_rgba(255,255,255,0.4),0_0_150px_rgba(30,48,96,0.85)] md:!h-44 md:!w-44"
            />
          </div>
        </Reveal>

        {/* heading */}
        <Reveal delay={160}>
          <div className="mt-14 flex items-center justify-center gap-4">
            <span className="h-px w-12 bg-gold/50" />
            <span className="text-[10px] font-bold uppercase tracking-[0.45em] text-gold">
              Our Motto
            </span>
            <span className="h-px w-12 bg-gold/50" />
          </div>

          <h2 className="mt-6 font-display text-[2.6rem] font-semibold leading-none tracking-tight md:text-6xl">
            Animo <span className="text-gold">et</span> Fide
          </h2>

          <p className="mt-5 text-[11px] font-bold uppercase tracking-[0.5em] text-white/60">
            Courage &amp; Faith
          </p>
        </Reveal>

        {/* quiet footer row */}
        <Reveal delay={280}>
          <div className="mx-auto mt-12 flex max-w-lg items-center justify-center gap-4">
            {marks.map((m, i) => (
              <span key={m} className="flex items-center gap-4">
                {i > 0 && <span className="h-1 w-1 rounded-full bg-white/20" />}
                <span className="text-[11px] font-semibold uppercase tracking-[0.22em] text-white/60">
                  {m}
                </span>
              </span>
            ))}
          </div>
        </Reveal>
      </div>
    </section>
  );
}
