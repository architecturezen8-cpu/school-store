import { useState } from "react";
import { RotateCcw, ShieldCheck, Truck } from "lucide-react";
import { featuredProducts, type Product } from "../data";
import { ShopProductCard } from "../pages/ShopPage";
import QuickView from "./QuickView";
import Reveal from "./Reveal";
import SectionHead from "./SectionHead";

const services = [
  {
    icon: Truck,
    title: "Free island-wide delivery",
    desc: "On every order above LKR 5,000.",
  },
  {
    icon: ShieldCheck,
    title: "100% official merchandise",
    desc: "Sold by the college, for the college.",
  },
  {
    icon: RotateCcw,
    title: "14-day easy exchange",
    desc: "Sizes swapped, no questions asked.",
  },
];

export default function Featured() {
  const [quick, setQuick] = useState<Product | null>(null);

  return (
    <section id="featured" className="relative py-20 md:py-28">
      <div className="pointer-events-none absolute right-0 top-1/4 h-[460px] w-[min(80vw,540px)] translate-x-1/3 rounded-full bg-[radial-gradient(closest-side,rgba(22,36,74,0.45),transparent)]" />

      <div className="relative mx-auto max-w-[1400px] px-5 lg:px-10">
        <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <SectionHead
            align="left"
            eyebrow="Featured"
            title="Curated for every Thomian"
            sub="Four pieces the store reaches for first — crafted in college colours, finished in gold."
          />
        </div>

        <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4 lg:gap-x-5">
          {featuredProducts.map((p, i) => (
            <ShopProductCard
              key={p.slug}
              product={p}
              delay={i * 110}
              onQuickView={setQuick}
            />
          ))}
        </div>

        {/* ---------- services, set quietly beneath the collection ---------- */}
        <Reveal delay={120}>
          <div className="mt-20 border-t border-white/10 pt-9">
            <ul className="grid gap-7 sm:grid-cols-3 sm:gap-6">
              {services.map((s) => (
                <li key={s.title} className="flex items-start gap-3.5">
                  <s.icon size={17} className="mt-0.5 shrink-0 text-white/35" />
                  <div>
                    <p className="text-[13.5px] font-semibold tracking-tight text-white">
                      {s.title}
                    </p>
                    <p className="mt-1.5 text-[12.5px] leading-relaxed text-white/45">
                      {s.desc}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </Reveal>
      </div>

      <QuickView product={quick} onClose={() => setQuick(null)} />
    </section>
  );
}
