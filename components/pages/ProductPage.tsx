"use client";

import { useEffect, useState } from "react";
import { Check, ChevronRight, Minus, Plus, RotateCcw, ShieldCheck, Truck } from "lucide-react";
import type { Category, Product } from "@/data/seed";
import { lkr } from "@/lib/format";
import { useCart } from "@/components/context/CartContext";
import { href } from "@/lib/nav";
import { ShopProductCard } from "@/components/pages/ShopPage";
import Reveal from "@/components/Reveal";
import SectionHead from "@/components/SectionHead";
import ReviewsBlock from "@/components/ReviewsBlock";
import QuickView from "@/components/QuickView";

const perks = [
  { icon: Truck, text: "Free delivery over LKR 5,000" },
  { icon: RotateCcw, text: "14-day easy exchange" },
  { icon: ShieldCheck, text: "100% official merchandise" },
];

export default function ProductPage({
  slug,
  products,
  categories,
}: {
  slug: string;
  products: Product[];
  categories: Category[];
}) {
  const product = products.find((p) => p.slug === slug);
  const getCategoryName = (c: string) =>
    categories.find((x) => x.slug === c)?.title ?? c;
  const { add, setOpen } = useCart();
  const [qty, setQty] = useState(1);
  const [picked, setPicked] = useState<string | null>(null);
  const [colour, setColour] = useState<string | null>(null);
  const [added, setAdded] = useState(false);
  const [active, setActive] = useState(0);
  const [quick, setQuick] = useState<Product | null>(null);

  useEffect(() => {
    setQty(1);
    setAdded(false);
    setActive(0);
    setPicked(product?.options?.values[0] ?? null);
    setColour(product?.colours?.[0] ?? null);
  }, [slug, product]);

  if (!product) {
    return (
      <section className="flex min-h-[70vh] flex-col items-center justify-center px-5 pt-32 text-center">
        <p className="font-display text-3xl font-semibold">Product not found</p>
        <p className="mt-3 text-sm text-white/65">
          That item may have moved or sold out.
        </p>
        <a
          href={href.shop}
          className="mt-7 rounded-full bg-white px-7 py-3.5 text-[11px] font-bold uppercase tracking-[0.24em] text-ink"
        >
          Back to the store
        </a>
      </section>
    );
  }

  const gallery = [product.image, ...(product.gallery ?? [])];

  const related = products
    .filter((p) => p.category === product.category && p.slug !== product.slug)
    .slice(0, 4);

  const handleAdd = (goToBag = false) => {
    add(product);
    if (goToBag) {
      setOpen(true);
      return;
    }
    setAdded(true);
    window.setTimeout(() => setAdded(false), 1600);
  };

  return (
    <section className="relative pb-24 pt-28 md:pt-36">
      <div className="pointer-events-none absolute right-0 top-0 h-[420px] w-[min(80vw,560px)] -translate-y-1/4 rounded-full bg-[radial-gradient(closest-side,rgba(19,34,80,0.38),transparent)]" />

      <div className="relative mx-auto max-w-[1400px] px-5 lg:px-10">
        {/* breadcrumb */}
        <Reveal>
          <nav className="flex flex-wrap items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-white/65">
            <a href={href.home} className="transition-colors hover:text-white">
              Home
            </a>
            <ChevronRight size={12} className="text-white/50" />
            <a href={href.shop} className="transition-colors hover:text-white">
              Shop
            </a>
            <ChevronRight size={12} className="text-white/50" />
            <a
              href={href.shopCategory(product.category)}
              className="transition-colors hover:text-white"
            >
              {getCategoryName(product.category)}
            </a>
            <ChevronRight size={12} className="text-white/50" />
            <span className="text-white/65">{product.name}</span>
          </nav>
        </Reveal>

        <div className="mt-8 grid gap-10 lg:grid-cols-2 lg:gap-14">
          {/* ---------- gallery ---------- */}
          <Reveal>
            <div>
              <div className="relative overflow-hidden rounded-[1.75rem] bg-navy-900">
                <img
                  src={gallery[active]}
                  alt={product.name}
                  className="aspect-[4/5] w-full object-cover"
                />
                {product.tag && (
                  <span className="absolute left-5 top-5 rounded-lg bg-ink px-3.5 py-2 text-[10px] font-bold uppercase tracking-[0.16em] text-white">
                    {product.tag}
                  </span>
                )}
              </div>

              {gallery.length > 1 && (
                <div className="mt-3.5 flex gap-3">
                  {gallery.map((g, i) => (
                    <button
                      key={i}
                      onClick={() => setActive(i)}
                      aria-label={`View image ${i + 1}`}
                      className={`h-20 w-20 overflow-hidden rounded-xl transition-all duration-300 ${
                        active === i
                          ? "ring-2 ring-white"
                          : "opacity-45 hover:opacity-100"
                      }`}
                    >
                      <img src={g} alt="" className="h-full w-full object-cover" />
                    </button>
                  ))}
                </div>
              )}
            </div>
          </Reveal>

          {/* ---------- details ---------- */}
          <Reveal delay={100}>
            <div className="lg:pt-4">
              <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-gold">
                {getCategoryName(product.category)}
              </p>
              <h1 className="mt-4 font-display text-[2rem] font-semibold leading-tight tracking-tight md:text-[2.6rem]">
                {product.name}
              </h1>

              <div className="mt-4 flex items-center gap-3">
                <div className="flex items-center gap-0.5">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <svg
                      key={i}
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      className={i < product.rating ? "fill-gold" : "fill-white/15"}
                    >
                      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                    </svg>
                  ))}
                </div>
                <span className="text-xs text-white/65">
                  {product.reviews} reviews
                </span>
              </div>

              <p className="mt-6 font-display text-3xl font-semibold tracking-tight text-white">
                {lkr(product.price)}
              </p>

              <p className="mt-5 text-sm leading-relaxed text-white/55">
                {product.description}
              </p>

              {/* size / option picker */}
              {product.options && (
                <div className="mt-8">
                  <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-white/65">
                    {product.options.label}
                  </p>
                  <div className="mt-3.5 flex flex-wrap gap-2.5">
                    {product.options.values.map((v) => (
                      <button
                        key={v}
                        onClick={() => setPicked(v)}
                        className={`min-w-[3.25rem] rounded-xl px-4 py-2.5 text-sm font-semibold transition-colors duration-300 ${
                          picked === v
                            ? "bg-white text-ink"
                            : "bg-navy-900 text-white/65 hover:bg-navy-800 hover:text-white"
                        }`}
                      >
                        {v}
                      </button>
                     ))}
                   </div>
                 </div>
               )}

              {/* colour picker */}
              {product.colours && (
                <div className="mt-7">
                  <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-white/65">
                    Colour
                  </p>
                  <div className="mt-3.5 flex flex-wrap gap-2.5">
                    {product.colours.map((c) => (
                      <button
                        key={c}
                        onClick={() => setColour(c)}
                        className={`rounded-xl px-4 py-2.5 text-sm font-semibold transition-colors duration-300 ${
                          colour === c
                            ? "bg-white text-ink"
                            : "bg-navy-900 text-white/65 hover:bg-navy-800 hover:text-white"
                        }`}
                      >
                        {c}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* quantity + actions */}
              <div className="mt-8 flex items-stretch gap-3">
                <div className="flex items-center rounded-full bg-navy-900">
                  <button
                    onClick={() => setQty((q) => Math.max(1, q - 1))}
                    aria-label="Decrease quantity"
                    className="grid h-12 w-11 place-items-center rounded-l-full text-white/65 transition hover:text-white"
                  >
                    <Minus size={15} />
                  </button>
                  <span className="min-w-8 text-center text-sm font-semibold">{qty}</span>
                  <button
                    onClick={() => setQty((q) => q + 1)}
                    aria-label="Increase quantity"
                    className="grid h-12 w-11 place-items-center rounded-r-full text-white/65 transition hover:text-white"
                  >
                    <Plus size={15} />
                  </button>
                </div>

                <button
                  onClick={() => handleAdd()}
                  className={`flex flex-1 items-center justify-center gap-2 rounded-full text-[11px] font-extrabold uppercase tracking-[0.22em] transition-all duration-500 ${
                    added
                      ? "bg-white text-ink"
                      : "bg-gold text-ink hover:shadow-[0_0_40px_rgba(255,212,68,0.28)]"
                  }`}
                >
                  {added ? (
                    <>
                      <Check size={15} /> Added
                    </>
                  ) : (
                    "Add to bag"
                  )}
                </button>
              </div>

              <button
                onClick={() => handleAdd(true)}
                className="mt-3 w-full rounded-full bg-white py-4 text-[11px] font-bold uppercase tracking-[0.22em] text-ink transition-all duration-300 hover:shadow-[0_0_36px_rgba(255,255,255,0.2)]"
              >
                Buy it now
              </button>

              {/* details list */}
              <div className="mt-10 border-t border-white/10 pt-7">
                <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-white/65">
                  Details
                </p>
                <ul className="mt-4 space-y-2.5">
                  {product.details.map((d) => (
                    <li key={d} className="flex items-start gap-3 text-sm text-white/55">
                      <span className="mt-[0.45rem] h-1 w-1 shrink-0 rounded-full bg-white/30" />
                      {d}
                    </li>
                  ))}
                </ul>
              </div>

              {/* perks */}
              <ul className="mt-8 space-y-3 border-t border-white/10 pt-7">
                {perks.map((p) => (
                  <li key={p.text} className="flex items-center gap-3 text-sm text-white/50">
                    <p.icon size={16} className="shrink-0 text-white/65" />
                    {p.text}
                  </li>
                ))}
              </ul>
            </div>
          </Reveal>
        </div>

        <ReviewsBlock
          productSlug={product.slug}
          productName={product.name}
          seedRating={product.rating}
          seedCount={product.reviews}
        />

        {/* ---------- related ---------- */}
        {related.length > 0 && (
          <div className="mt-24">
            <SectionHead
              align="left"
              eyebrow="More from this collection"
              title="You may also like"
            />
            <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4 lg:gap-x-5">
              {related.map((p, i) => (
                <ShopProductCard
                  key={p.slug}
                  product={p}
                  delay={i * 90}
                  onQuickView={setQuick}
                />
              ))}
            </div>
          </div>
        )}
      </div>

      <QuickView product={quick} onClose={() => setQuick(null)} />
    </section>
  );
}
