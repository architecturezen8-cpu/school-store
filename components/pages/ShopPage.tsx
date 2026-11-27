"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, Eye, Heart, Star } from "lucide-react";
import { getCategoryName, type Category, type Product } from "@/data/seed";
import type { ShopFilter } from "@/lib/catalog";
import { lkr } from "@/lib/format";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { href, openSearch } from "@/lib/nav";
import QuickView from "@/components/QuickView";
import ProductImage from "@/components/ProductImage";
import Reveal from "@/components/Reveal";

/* ------------------------------------------------------------------ */
/*  SORTING                                                           */
/* ------------------------------------------------------------------ */
const sortOptions = [
  { id: "featured", label: "Featured" },
  { id: "newest", label: "New Arrivals" },
  { id: "price-desc", label: "Price: High to Low" },
  { id: "price-asc", label: "Price: Low to High" },
  { id: "rating", label: "Top Rated" },
] as const;

type SortId = (typeof sortOptions)[number]["id"];

function SortMenu({
  value,
  onChange,
}: {
  value: SortId;
  onChange: (v: SortId) => void;
}) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const current = sortOptions.find((o) => o.id === value)!;

  return (
    <div ref={box} className="relative z-30">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex items-center gap-2.5 rounded-full bg-navy-900 px-5 py-2.5 text-xs font-semibold tracking-wide text-white/70 transition-colors duration-300 hover:bg-navy-800 hover:text-white"
      >
        <span className="text-white/60">Sort</span>
        {current.label}
        <ChevronDown
          size={13}
          className={`transition-transform duration-300 ${open ? "rotate-180" : ""}`}
        />
      </button>

      <div
        className={`absolute right-0 top-full z-[60] mt-2 w-56 origin-top-right transition-all duration-300 ease-out ${
          open
            ? "visible scale-100 opacity-100"
            : "invisible scale-95 opacity-0"
        }`}
      >
        <div className="overflow-hidden rounded-xl bg-navy-900 shadow-[0_24px_60px_rgba(0,0,0,0.6)]">
          {sortOptions.map((o) => (
            <button
              key={o.id}
              onClick={() => {
                onChange(o.id);
                setOpen(false);
              }}
              className={`flex w-full items-center justify-between border-b border-white/5 px-5 py-3 text-left text-[13px] transition-colors duration-200 last:border-b-0 hover:bg-navy-800 ${
                value === o.id ? "text-white" : "text-white/55"
              }`}
            >
              {o.label}
              {value === o.id && <Check size={13} className="text-gold" />}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  PRODUCT CARD                                                      */
/* ------------------------------------------------------------------ */
function Stars({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-0.5">
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

export function ShopProductCard({
  product,
  delay = 0,
  onQuickView,
}: {
  product: Product;
  delay?: number;
  onQuickView: (p: Product) => void;
}) {
  return (
    <Reveal delay={delay} className="h-full">
      <div className="group relative flex h-full flex-col">
        <Link
          href={href.product(product.slug)}
          className="absolute inset-0 z-0"
          aria-label={`View ${product.name}`}
        />
        <div className="relative aspect-[4/5] overflow-hidden rounded-2xl bg-navy-900">
          <ProductImage
            src={product.image}
            alt={product.name}
            className="transition-transform duration-[1100ms] ease-out group-hover:scale-[1.04]"
          />
          <div className="absolute inset-0 bg-ink/0 transition-colors duration-500 group-hover:bg-ink/20" />

          {/* tag */}
          {product.tag && (
            <span className="absolute left-4 top-4 rounded-lg bg-ink px-3.5 py-2 text-[10px] font-bold uppercase tracking-[0.16em] text-white">
              {product.tag}
            </span>
          )}

          {/*
            The shelf, on the picture.

            Three states, and the numbers have to be honest in each: gone, the
            last handful, or "some of it is gone" — a hoodie with two sizes left
            is not "Only 34 left", it is a product you cannot buy in grey.
          */}
          {product.stock && (product.stock.soldOut || product.stock.low) && (
            <span
              className={`absolute right-4 top-16 rounded-lg px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.14em] ${
                product.stock.soldOut
                  ? "bg-ink/90 text-white/85"
                  : product.stock.total <= 5
                    ? "bg-gold text-ink"
                    : "bg-ink/90 text-white/85"
              }`}
            >
              {product.stock.soldOut
                ? "Sold out"
                : product.stock.total <= 5
                  ? `Only ${product.stock.total} left`
                  : "Some sizes low"}
            </span>
          )}

          {/* wishlist */}
          <button
            onClick={(e) => e.preventDefault()}
            aria-label={`Save ${product.name}`}
            className="absolute right-4 top-4 grid h-9 w-9 place-items-center rounded-full text-white transition-colors hover:text-gold"
          >
            <Heart size={17} />
          </button>

          {/* bottom action bar */}
          <div className="absolute inset-x-0 bottom-0 flex items-center gap-2.5 p-3 translate-y-[130%] transition-transform duration-500 ease-out group-hover:translate-y-0 max-sm:translate-y-0">
            <Link
              href={href.product(product.slug)}
              className="relative z-10 grid h-12 flex-1 place-items-center rounded-full bg-white text-[11px] font-bold uppercase tracking-[0.22em] text-ink transition-colors hover:bg-white/90"
            >
              View Product
            </Link>
            <button
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onQuickView(product);
              }}
              aria-label={`Quick view ${product.name}`}
              className="relative z-10 grid h-12 w-12 shrink-0 place-items-center rounded-full bg-ink text-white transition-colors hover:text-gold"
            >
              <Eye size={17} />
            </button>
          </div>
        </div>

        <div className="mt-4 flex items-center justify-between">
          <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-white/60">
            {getCategoryName(product.category)}
          </p>
          <p className="text-sm font-bold text-white">{lkr(product.price)}</p>
        </div>

        <h2 className="mt-2 text-base font-semibold leading-snug text-white">
          {product.name}
        </h2>

        <div className="mt-2.5 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Stars rating={product.rating} />
            <span className="text-xs text-white/60">({product.reviews})</span>
          </div>
          {product.stock && (
            <span
              className={`text-[10px] font-semibold uppercase tracking-[0.14em] ${
                product.stock.soldOut ? "text-white/60" : product.stock.low ? "text-gold" : "text-white/55"
              }`}
            >
              {product.stock.soldOut
                ? "Sold out"
                : product.stock.total <= 5
                  ? `Only ${product.stock.total} left`
                  : "In stock"}
            </span>
          )}
        </div>
      </div>
    </Reveal>
  );
}

/* ------------------------------------------------------------------ */
/*  SHOP PAGE                                                         */
/* ------------------------------------------------------------------ */
export default function ShopPage({
  category,
  products,
  categories,
  filters = [],
}: {
  category?: string;
  products: Product[];
  categories: Category[];
  /** The admin's vocabulary: which colours and sizes the shop offers. */
  filters?: ShopFilter[];
}) {
  const router = useRouter();
  const [active, setActive] = useState<string | undefined>(category);
  useEffect(() => setActive(category), [category]);
  const [sort, setSort] = useState<SortId>("featured");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [quick, setQuick] = useState<Product | null>(null);
  // One colour and one size at a time. More than that is a form, and a shopper
  // with a phone in one hand is not filling in forms.
  const [colour, setColour] = useState<string | null>(null);
  const [size, setSize] = useState<string | null>(null);

  // Category clicks navigate to /shop/<slug> so the filter is a real URL.
  const go = (slug?: string) => {
    setActive(slug);
    router.push(slug ? href.shopCategory(slug) : href.shop, { scroll: false });
  };

  // The collection on screen, before the chips narrow it.
  const inCollection = useMemo(
    () => (active ? products.filter((p) => p.category === active) : [...products]),
    [active, products]
  );

  /**
   * Which chips are worth drawing.
   *
   * A colour nobody stocks in this collection would be a chip that empties the
   * page, so only values that occur here are offered — and in the admin's order,
   * which is why the vocabulary is not just "the distinct values in the data".
   */
  const offered = useMemo(() => {
    const has = (value: string, kind: "colour" | "size") =>
      inCollection.some((p) =>
        kind === "colour"
          ? p.colours?.some((c) => c.toLowerCase() === value.toLowerCase())
          : p.options?.values.some((v) => v.toLowerCase() === value.toLowerCase())
      );
    return {
      colours: filters.filter((f) => f.kind === "colour" && has(f.label, "colour")),
      sizes: filters.filter((f) => f.kind === "size" && has(f.label, "size")),
    };
  }, [inCollection, filters]);

  const visible = useMemo(() => {
    const list = inCollection.filter((p) => {
      if (colour && !p.colours?.some((c) => c.toLowerCase() === colour.toLowerCase())) return false;
      if (size && !p.options?.values.some((v) => v.toLowerCase() === size.toLowerCase())) return false;
      return true;
    });

    const by = [...list];
    switch (sort) {
      case "price-asc":
        by.sort((a, b) => a.price - b.price);
        break;
      case "price-desc":
        by.sort((a, b) => b.price - a.price);
        break;
      case "rating":
        by.sort((a, b) => b.rating - a.rating || b.reviews - a.reviews);
        break;
      case "newest":
        by.sort((a, b) => Number(!!b.isNew) - Number(!!a.isNew));
        break;
      default:
        by.sort((a, b) => Number(!!b.isFeatured) - Number(!!a.isFeatured));
    }
    return by;
  }, [inCollection, sort, colour, size]);

  const narrowed = Boolean(colour || size);

  const heading = active
    ? categories.find((c) => c.slug === active)?.title ?? "The Store"
    : "The Thomian Store";

  const sub = active
    ? categories.find((c) => c.slug === active)?.desc
    : "Badges, uniforms, event wear, exam papers and batch shirts — everything a Thomian needs, in one place.";

  return (
    <section className="relative pb-24 pt-32 md:pt-40">
      <div className="pointer-events-none absolute left-1/2 top-0 h-[420px] w-[min(90vw,760px)] -translate-x-1/2 -translate-y-1/3 rounded-full bg-[radial-gradient(closest-side,rgba(19,34,80,0.4),transparent)]" />

      <div className="relative mx-auto max-w-[1400px] px-5 lg:px-10">
        {/* breadcrumb */}
        <Reveal>
          <nav className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-white/60">
            <a href={href.home} className="transition-colors hover:text-white">
              Home
            </a>
            <span className="text-white/50">/</span>
            <span className="text-white/60">Shop</span>
            {active && (
              <>
                <span className="text-white/50">/</span>
                <span className="text-white/60">
                  {categories.find((c) => c.slug === active)?.title}
                </span>
              </>
            )}
          </nav>
        </Reveal>

        {/* heading */}
        <Reveal delay={80}>
          <h1 className="mt-6 font-display text-[2.2rem] font-semibold leading-tight tracking-tight md:text-5xl">
            {heading}
          </h1>
          <p className="mt-4 max-w-xl text-sm leading-relaxed text-white/50 md:text-[15px]">
            {sub}
          </p>
        </Reveal>

        {/* ---------- filter bar ---------- */}
        <Reveal delay={140}>
          <div className="mt-10 border-y border-white/10 py-4">
            {/* mobile: trigger row */}
            <div className="flex items-center justify-between lg:hidden">
              <button
                onClick={() => setFiltersOpen((v) => !v)}
                aria-expanded={filtersOpen}
                className="flex items-center gap-2.5 rounded-full bg-navy-900 px-5 py-2.5 text-xs font-semibold text-white/75 transition-colors hover:bg-navy-800 hover:text-white"
              >
                Filters
                <ChevronDown
                  size={13}
                  className={`transition-transform duration-300 ${filtersOpen ? "rotate-180" : ""}`}
                />
              </button>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => openSearch()}
                  aria-label="Search"
                  className="rounded-full px-3 py-2.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-white/60 transition-colors hover:text-white"
                >
                  Search
                </button>
                <SortMenu value={sort} onChange={setSort} />
              </div>
            </div>

            {/* mobile: expanding category list */}
            <div
              className={`grid transition-[grid-template-rows,opacity] duration-400 ease-out lg:hidden ${
                filtersOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
              }`}
            >
              <div className="overflow-hidden">
                <div className="flex flex-col gap-1 pt-4">
                  <FilterRow
                    label="All Items"
                    count={products.length}
                    active={!active}
                    onClick={() => go(undefined)}
                  />
                  {categories.map((c) => (
                    <FilterRow
                      key={c.slug}
                      label={c.title}
                      count={products.filter((p) => p.category === c.slug).length}
                      active={active === c.slug}
                      onClick={() => go(c.slug)}
                    />
                  ))}
                </div>
              </div>
            </div>

            {/* desktop: categories, then the admin's own filters */}
            <div className="hidden items-center justify-between gap-6 lg:flex">
              <div className="flex flex-wrap items-center gap-2">
                <FilterPill
                  label="All"
                  active={!active}
                  onClick={() => go(undefined)}
                />
                {categories.map((c) => (
                  <FilterPill
                    key={c.slug}
                    label={c.title}
                    active={active === c.slug}
                    onClick={() => go(c.slug)}
                  />
                ))}
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={() => openSearch()}
                  className="rounded-full px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-white/60 transition-colors hover:text-white"
                >
                  Search
                </button>
                <SortMenu value={sort} onChange={setSort} />
              </div>
            </div>

            {/* desktop: the chips themselves, on their own line */}
            {(offered.colours.length > 0 || offered.sizes.length > 0) && (
              <div className="mt-4 hidden flex-wrap items-center gap-x-8 gap-y-3 border-t border-white/5 pt-4 lg:flex">
                {offered.colours.length > 0 && (
                  <ChipGroup label="Colour">
                    {(offered.colours ?? []).map((f) => (
                      <SwatchChip
                        key={f.id}
                        label={f.label}
                        swatch={f.swatch}
                        active={colour === f.label}
                        onClick={() => setColour(colour === f.label ? null : f.label)}
                      />
                    ))}
                  </ChipGroup>
                )}
                {offered.sizes.length > 0 && (
                  <ChipGroup label="Size">
                    {(offered.sizes ?? []).map((f) => (
                      <button
                        key={f.id}
                        onClick={() => setSize(size === f.label ? null : f.label)}
                        aria-pressed={size === f.label}
                        className={`min-w-10 rounded-lg px-2.5 py-1.5 text-[11px] font-semibold transition-colors ${
                          size === f.label
                            ? "bg-white text-ink"
                            : "bg-navy-900 text-white/60 hover:text-white"
                        }`}
                      >
                        {f.label}
                      </button>
                    ))}
                  </ChipGroup>
                )}
              </div>
            )}

            {/* mobile: the same chips inside the panel */}
            <div
              className={`grid transition-[grid-template-rows,opacity] duration-400 ease-out lg:hidden ${
                filtersOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
              }`}
            >
              <div className="overflow-hidden">
                <div className="flex flex-col gap-3 pt-3">
                  {offered.colours.length > 0 && (
                    <ChipGroup label="Colour">
                      {(offered.colours ?? []).map((f) => (
                        <SwatchChip
                          key={f.id}
                          label={f.label}
                          swatch={f.swatch}
                          active={colour === f.label}
                          onClick={() => setColour(colour === f.label ? null : f.label)}
                        />
                      ))}
                    </ChipGroup>
                  )}
                  {offered.sizes.length > 0 && (
                    <ChipGroup label="Size">
                      {(offered.sizes ?? []).map((f) => (
                        <button
                          key={f.id}
                          onClick={() => setSize(size === f.label ? null : f.label)}
                          aria-pressed={size === f.label}
                          className={`min-w-10 rounded-lg px-2.5 py-1.5 text-[11px] font-semibold transition-colors ${
                            size === f.label
                              ? "bg-white text-ink"
                              : "bg-navy-900 text-white/60 hover:text-white"
                          }`}
                        >
                          {f.label}
                        </button>
                      ))}
                    </ChipGroup>
                  )}
                </div>
              </div>
            </div>
          </div>
        </Reveal>

        {/* count */}
        <Reveal delay={180}>
          <p className="mt-7 text-xs text-white/50">
            Showing {visible.length} of {products.length} items
            {active && ` · ${categories.find((c) => c.slug === active)?.title}`}
            {narrowed && (
              <button
                onClick={() => {
                  setColour(null);
                  setSize(null);
                }}
                className="ml-3 rounded-full bg-navy-900 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-white/70 hover:text-white"
              >
                Clear filters
              </button>
            )}
          </p>
        </Reveal>

        {/* grid */}
        <div className="mt-5 grid gap-6 sm:grid-cols-2 lg:grid-cols-4 lg:gap-x-5">
          {visible.map((p, i) => (
            <ShopProductCard
              key={p.slug}
              product={p}
              delay={i * 70}
              onQuickView={setQuick}
            />
          ))}
        </div>

        {visible.length === 0 && (
          <p className="py-16 text-center text-sm text-white/60">
            Nothing in this collection yet.
          </p>
        )}

        {/* one shared quick-view modal, rendered at body level */}
        <QuickView product={quick} onClose={() => setQuick(null)} />
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/*  FILTER PIECES                                                     */
/* ------------------------------------------------------------------ */
/** A labelled row of chips: "Colour · ● Navy ● Black". */
function ChipGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/50">
        {label}
      </span>
      {children}
    </div>
  );
}

/** A colour chip: the swatch, then the word — never colour alone. */
function SwatchChip({
  label,
  swatch,
  active,
  onClick,
}: {
  label: string;
  swatch: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className={`flex items-center gap-2 rounded-full py-1.5 pl-1.5 pr-3 text-[11px] font-semibold transition-colors ${
        active ? "bg-white text-ink" : "bg-navy-900 text-white/65 hover:text-white"
      }`}
    >
      <span
        aria-hidden
        className="h-4 w-4 rounded-full ring-1 ring-inset ring-black/20"
        style={{ background: swatch || "#8b9099" }}
      />
      {label}
    </button>
  );
}

function FilterPill({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.16em] transition-colors duration-300 ${
        active
          ? "bg-white text-ink"
          : "text-white/50 hover:bg-navy-900 hover:text-white"
      }`}
    >
      {label}
    </button>
  );
}

function FilterRow({
  label,
  count,
  active,
  onClick,
}: {
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center justify-between rounded-xl px-4 py-3 text-left transition-colors duration-300 ${
        active ? "bg-white text-ink" : "bg-navy-950 text-white/65 hover:bg-navy-900"
      }`}
    >
      <span className="text-[13px] font-semibold tracking-wide">{label}</span>
      <span
        className={`text-[11px] font-semibold ${
          active ? "text-ink/50" : "text-white/50"
        }`}
      >
        {count}
      </span>
    </button>
  );
}
