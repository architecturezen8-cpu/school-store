"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { ArrowRight } from "lucide-react";
import { heroSlides } from "@/data/seed";

export default function Hero() {
  const [index, setIndex] = useState(0);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const t = window.setTimeout(() => setMounted(true), 120);
    return () => window.clearTimeout(t);
  }, []);

  useEffect(() => {
    const t = window.setInterval(
      () => setIndex((i) => (i + 1) % heroSlides.length),
      6500
    );
    return () => window.clearInterval(t);
  }, []);

  const stage = (delay: number) => ({ transitionDelay: `${delay}ms` });

  return (
    <section
      id="home"
      className="relative flex h-[100svh] min-h-[640px] items-center justify-center overflow-hidden"
    >
      {heroSlides.map((s, i) => (
        <div
          key={i}
          className="absolute inset-0 transition-opacity duration-[1800ms] ease-out"
          style={{ opacity: i === index ? 1 : 0 }}
        >
          <Image
            src={s.image}
            alt=""
            fill
            priority={i === 0}
            sizes="100vw"
            className={`object-cover ${
              i === index ? "animate-[kenburns_7.5s_ease-out_forwards]" : ""
            }`}
          />
        </div>
      ))}

      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(4,6,13,0.2)_0%,rgba(4,6,13,0.55)_60%,rgba(4,6,13,0.9)_100%)]" />
      <div className="absolute inset-0 bg-gradient-to-b from-ink/75 via-transparent to-ink" />
      <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-ink to-transparent" />

      {/* content */}
      <div
        className={`relative z-10 flex flex-col items-center px-5 text-center transition-all duration-1000 ease-out ${
          mounted ? "translate-y-0 opacity-100" : "translate-y-10 opacity-0"
        }`}
      >
        <div className="flex items-center gap-4 transition-all duration-1000" style={stage(150)}>
          <span className="h-px w-10 bg-gold/60" />
          <span className="text-[11px] font-bold uppercase tracking-[0.5em] text-gold">
            Est. 1873
          </span>
          <span className="h-px w-10 bg-gold/60" />
        </div>

        <p
          className="mt-9 text-[11px] font-semibold uppercase tracking-[0.55em] text-white/55 transition-all duration-1000"
          style={stage(300)}
        >
          Welcome To
        </p>

        <h1 className="mt-4 font-display text-[clamp(2.1rem,8.2vw,6.8rem)] font-semibold leading-[1.04] [text-shadow:0_8px_60px_rgba(0,0,0,0.6)]">
          <span className="block transition-all duration-1000" style={stage(450)}>
            St. Thomas’ College
          </span>
          <span
            className="block font-semibold text-gold transition-all duration-1000"
            style={stage(600)}
          >
            Matale
          </span>
        </h1>

        <div
          className="mt-10 flex items-center gap-4 transition-all duration-1000"
          style={stage(780)}
        >
          <span className="h-px w-10 bg-white/20" />
          <span className="text-[10px] font-bold uppercase tracking-[0.5em] text-white/55">
            Shop
          </span>
          <span className="h-px w-10 bg-white/20" />
        </div>

        <a
          href="#shop"
          className="group mt-6 inline-flex items-center gap-3 rounded-full bg-accent px-8 py-4 text-[11px] font-extrabold uppercase tracking-[0.24em] text-ink transition-all duration-500 hover:-translate-y-0.5 hover:shadow-[0_12px_50px_rgba(255,255,255,0.10)]"
          style={stage(900)}
        >
          Shop Now
          <ArrowRight
            size={14}
            className="transition-transform duration-300 group-hover:translate-x-1"
          />
        </a>
      </div>

      {/* counter */}
      <div className="absolute bottom-9 left-6 z-10 hidden items-end gap-4 md:left-10 md:flex">
        <span className="font-display text-4xl font-semibold leading-none">
          {String(index + 1).padStart(2, "0")}
        </span>
        <div className="flex flex-col gap-2 pb-1">
          <span className="text-[10px] font-semibold tracking-[0.3em] text-white/60">
            / {String(heroSlides.length).padStart(2, "0")}
          </span>
          <span key={index} className="block h-px w-24 bg-white/15">
            <span className="block h-full w-full origin-left animate-[progress-x_6.5s_linear_forwards] bg-accent" />
          </span>
        </div>
      </div>

      {/* caption */}
      <div className="absolute bottom-9 right-6 z-10 hidden h-6 w-56 text-right md:right-10 md:block">
        {heroSlides.map((s, i) => (
          <p
            key={i}
            className={`text-xs font-medium uppercase tracking-[0.3em] text-white/60 transition-all duration-700 ${
              i === index
                ? "relative translate-y-0 opacity-100"
                : "absolute inset-0 translate-y-2 opacity-0"
            }`}
          >
            {s.caption}
          </p>
        ))}
      </div>

      {/* scroll cue */}
      <div className="absolute bottom-8 left-1/2 z-10 hidden -translate-x-1/2 flex-col items-center gap-3 sm:flex">
        <span className="text-[9px] font-bold uppercase tracking-[0.45em] text-white/60">
          Scroll
        </span>
        <span className="relative h-12 w-px overflow-hidden bg-white/15">
          <span className="absolute left-0 top-0 h-4 w-px animate-[scroll-dot_2.2s_ease-in-out_infinite] bg-accent" />
        </span>
      </div>

    </section>
  );
}
