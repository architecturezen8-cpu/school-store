import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Check, ChevronLeft, ChevronRight, Minus, Plus, X } from "lucide-react";
import { lkr, getCategoryName, type Product } from "../data";
import { useCart } from "../context/CartContext";

const SWATCHES: Record<string, string> = {
  Navy: "#0f1a33",
  Black: "#0b0b0d",
  White: "#f4f4ef",
  Grey: "#6b7280",
  Maroon: "#5b1a2b",
  Green: "#1e3d2f",
  Gold: "#c9a227",
  Sky: "#a9c4dd",
  Khaki: "#8a7a52",
};

export default function QuickView({
  product,
  onClose,
}: {
  product: Product | null;
  onClose: () => void;
}) {
  const { add, setOpen } = useCart();
  const [qty, setQty] = useState(1);
  const [size, setSize] = useState<string | null>(null);
  const [colour, setColour] = useState<string | null>(null);
  const [added, setAdded] = useState(false);
  const [active, setActive] = useState(0);

  useEffect(() => {
    if (product) {
      setQty(1);
      setAdded(false);
      setActive(0);
      setSize(product.options?.values[0] ?? null);
      setColour(product.colours?.[0] ?? null);
    }
  }, [product]);

  // lock scroll + close on Escape
  useEffect(() => {
    if (!product) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [product, onClose]);

  // render at <body> level so nothing can clip or layer it
  if (!product) return null;

  const gallery = [product.image, ...(product.gallery ?? [])];
  const go = (dir: number) =>
    setActive((i) => (i + dir + gallery.length) % gallery.length);

  const handleAdd = (goToBag = false) => {
    add(product);
    if (goToBag) {
      onClose();
      setOpen(true);
      return;
    }
    setAdded(true);
    window.setTimeout(() => setAdded(false), 1600);
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[999] flex items-center justify-center px-4 py-8"
      role="dialog"
      aria-modal="true"
    >
      <div className="absolute inset-0 bg-ink/90" onClick={onClose} />

      <div className="relative grid max-h-[92vh] w-full max-w-4xl overflow-y-auto rounded-[1.75rem] border border-white/10 bg-ink shadow-[0_40px_120px_rgba(0,0,0,0.85)] md:grid-cols-2 md:overflow-hidden">
        {/* ---------------- image ---------------- */}
        <div className="relative bg-navy-950">
          <div className="aspect-square w-full overflow-hidden md:aspect-auto md:h-full">
            <img
              src={gallery[active]}
              alt={product.name}
              className="h-full w-full object-cover"
            />
          </div>

          {gallery.length > 1 && (
            <>
              <button
                onClick={() => go(-1)}
                aria-label="Previous image"
                className="absolute left-4 top-1/2 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-full bg-white text-ink transition hover:scale-105"
              >
                <ChevronLeft size={17} />
              </button>
              <button
                onClick={() => go(1)}
                aria-label="Next image"
                className="absolute right-4 top-1/2 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-full bg-white text-ink transition hover:scale-105"
              >
                <ChevronRight size={17} />
              </button>
              <div className="pointer-events-none absolute bottom-4 left-1/2 flex -translate-x-1/2 gap-1.5">
                {gallery.map((_, i) => (
                  <span
                    key={i}
                    className={`h-1.5 rounded-full transition-all duration-300 ${
                      i === active ? "w-5 bg-white" : "w-1.5 bg-white/40"
                    }`}
                  />
                ))}
              </div>
            </>
          )}
        </div>

        {/* ---------------- details ---------------- */}
        <div className="relative px-7 pb-8 pt-8 md:px-9 md:pb-9 md:pt-10">
          <button
            onClick={onClose}
            aria-label="Close quick view"
            className="absolute right-5 top-5 grid h-9 w-9 place-items-center rounded-full text-white/55 transition-colors hover:bg-navy-900 hover:text-white"
          >
            <X size={17} />
          </button>

          <p className="text-[10px] font-semibold uppercase tracking-[0.26em] text-white/60">
            {getCategoryName(product.category).replace(/-/g, " ")}
          </p>

          <h3 className="mt-3.5 pr-8 font-display text-[1.9rem] font-semibold leading-tight tracking-tight">
            {product.name}
          </h3>

          <div className="mt-3 flex items-center gap-2.5">
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
            <span className="text-xs text-white/60">({product.reviews})</span>
          </div>

          <p className="mt-5 font-display text-[1.75rem] font-semibold tracking-tight">
            {lkr(product.price)}
          </p>

          <p className="mt-3.5 text-[13.5px] leading-relaxed text-white/55">
            {product.description}
          </p>

          {/* colours */}
          {product.colours && (
            <div className="mt-6">
              <p className="text-[10px] font-bold uppercase tracking-[0.26em] text-white/60">
                Colour: <span className="text-white/80">{colour}</span>
              </p>
              <div className="mt-3 flex flex-wrap gap-2.5">
                {product.colours.map((c) => (
                  <button
                    key={c}
                    onClick={() => setColour(c)}
                    aria-label={c}
                    title={c}
                    className={`grid h-9 w-9 place-items-center rounded-full border transition-all duration-300 ${
                      colour === c
                        ? "border-white ring-2 ring-white/70"
                        : "border-white/20 hover:border-white/60"
                    }`}
                    style={{ backgroundColor: SWATCHES[c] ?? "#333" }}
                  >
                    {colour === c && <Check size={13} className="text-white mix-blend-difference" />}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* sizes */}
          {product.options && (
            <div className="mt-6">
              <p className="text-[10px] font-bold uppercase tracking-[0.26em] text-white/60">
                {product.options.label}:{" "}
                <span className="text-white/80">{size}</span>
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {product.options.values.map((v) => (
                  <button
                    key={v}
                    onClick={() => setSize(v)}
                    className={`min-w-[3rem] rounded-xl px-3.5 py-2.5 text-[13px] font-semibold transition-colors duration-300 ${
                      size === v
                        ? "bg-white text-ink"
                        : "bg-navy-900 text-white/60 hover:bg-navy-800 hover:text-white"
                    }`}
                  >
                    {v}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* qty + add */}
          <div className="mt-8 flex items-stretch gap-3">
            <div className="flex items-center rounded-full bg-navy-900">
              <button
                onClick={() => setQty((q) => Math.max(1, q - 1))}
                aria-label="Decrease quantity"
                className="grid h-12 w-11 place-items-center rounded-l-full text-white/60 transition hover:text-white"
              >
                <Minus size={15} />
              </button>
              <span className="min-w-7 text-center text-sm font-semibold">{qty}</span>
              <button
                onClick={() => setQty((q) => q + 1)}
                aria-label="Increase quantity"
                className="grid h-12 w-11 place-items-center rounded-r-full text-white/60 transition hover:text-white"
              >
                <Plus size={15} />
              </button>
            </div>

            <button
              onClick={() => handleAdd()}
              className={`flex flex-1 items-center justify-center gap-2 rounded-full text-[11px] font-extrabold uppercase tracking-[0.22em] transition-all duration-300 ${
                added
                  ? "bg-white text-ink"
                  : "bg-gold text-ink hover:shadow-[0_0_36px_rgba(255,212,68,0.3)]"
              }`}
            >
              {added ? (
                <>
                  <Check size={14} /> Added
                </>
              ) : (
                "Add to bag"
              )}
            </button>
          </div>

          <button
            onClick={() => handleAdd(true)}
            className="mt-3 w-full rounded-full border border-white/20 py-3.5 text-[11px] font-bold uppercase tracking-[0.22em] text-white transition-colors hover:bg-white hover:text-ink"
          >
            Buy it now
          </button>

          <a
            href={`#/product/${product.slug}`}
            onClick={onClose}
            className="mt-2.5 block w-full rounded-full border border-white/15 py-3.5 text-center text-[11px] font-bold uppercase tracking-[0.22em] text-white/70 transition-colors hover:bg-white hover:text-ink"
          >
            View full details
          </a>
        </div>
      </div>
    </div>,
    document.body
  );
}
