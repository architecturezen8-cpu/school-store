"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowUpRight, Plus, Search, X } from "lucide-react";
import { lkr, searchChips, type Product } from "@/data/seed";
import { useCart } from "@/components/context/CartContext";

export default function SearchOverlay({
  open,
  onClose,
  products,
}: {
  open: boolean;
  onClose: () => void;
  products: Product[];
}) {
  const [q, setQ] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const { add } = useCart();

  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
      const t = window.setTimeout(() => inputRef.current?.focus(), 250);
      return () => {
        window.clearTimeout(t);
        document.body.style.overflow = "";
      };
    }
    document.body.style.overflow = "";
    setQ("");
    return undefined;
  }, [open]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const results = useMemo(() => {
    const query = q.trim().toLowerCase();
    if (!query) return [];
    return products
      .filter((p) => `${p.name} ${p.category}`.toLowerCase().includes(query))
      .slice(0, 6);
  }, [q, products]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[90]"
      role="dialog"
      aria-modal="true"
      aria-label="Search the store"
    >
      <div
        className="absolute inset-0 bg-ink"
        onClick={onClose}
      />
      <div className="relative mx-auto flex min-h-full w-full max-w-2xl flex-col px-5 pb-16 pt-24 md:pt-32">
        <div className="flex items-center gap-4 border-b border-white/15 pb-5">
          <Search size={22} className="shrink-0 text-white" />
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search the store…"
            aria-label="Search the store"
            className="w-full bg-transparent font-display text-3xl text-white outline-none placeholder:text-white/50 md:text-4xl"
          />
          <button
            onClick={onClose}
            aria-label="Close search"
            className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-white/15 text-white/60 transition hover:bg-navy-800 hover:text-white"
          >
            <X size={16} />
          </button>
        </div>

        {q.trim() === "" ? (
          <div className="mt-10">
            <p className="text-[11px] font-bold uppercase tracking-[0.3em] text-white/60">
              Popular right now
            </p>
            <div className="mt-4 flex flex-wrap gap-2.5">
              {searchChips.map((chip) => (
                <button
                  key={chip}
                  onClick={() => setQ(chip)}
                  className="rounded-full border border-white/15 px-4 py-2 text-sm text-white/60 transition hover:bg-navy-800 hover:text-white"
                >
                  {chip}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="mt-8">
            <p className="text-[11px] font-bold uppercase tracking-[0.3em] text-white/60">
              {results.length > 0
                ? `${results.length} result${results.length > 1 ? "s" : ""}`
                : "Nothing found"}
            </p>
            <div className="mt-4 divide-y divide-white/5">
              {results.map((p) => (
                <a key={p.slug} href={`#/product/${p.slug}`} onClick={onClose} className="flex items-center gap-4 py-4">
                  <img
                    src={p.image}
                    alt={p.name}
                    className="h-14 w-14 rounded-xl border border-white/10 object-cover"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-display text-xl text-white">
                      {p.name}
                    </p>
                    <p className="text-xs text-white/60">{p.category}</p>
                  </div>
                  <span className="text-sm font-semibold text-white">
                    {lkr(p.price)}
                  </span>
                  <span
                    onClick={(e) => {
                      e.preventDefault();
                      add(p);
                    }}
                    role="button"
                    aria-label={`Add ${p.name} to bag`}
                    className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-gold text-ink transition hover:scale-110"
                  >
                    <Plus size={15} />
                  </span>
                </a>
              ))}
              {results.length === 0 && (
                <p className="py-6 text-sm text-white/60">
                  Try “hoodie”, “cap” or “tickets”.
                </p>
              )}
            </div>
          </div>
        )}

        <button
          onClick={onClose}
          className="mt-auto flex items-center gap-2 self-center pt-10 text-[11px] uppercase tracking-[0.3em] text-white/50 transition hover:text-white"
        >
          Close search <ArrowUpRight size={13} />
        </button>
      </div>
    </div>
  );
}
