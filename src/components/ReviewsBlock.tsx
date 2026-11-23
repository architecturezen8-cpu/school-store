import { useMemo, useState } from "react";
import { Check, Star } from "lucide-react";
import Reveal from "./Reveal";
import SectionHead from "./SectionHead";

type Review = {
  id: number;
  name: string;
  rating: number;
  body: string;
  date: string;
};

/** Seed reviews shown while the backend has nothing for this product. */
const seeds: Record<string, Review[]> = {
  default: [
    {
      id: 1,
      name: "Shenal Rajapaksa",
      rating: 5,
      body: "Quality is exactly what you expect from the college store. Nothing flimsy about it.",
      date: "2 weeks ago",
    },
    {
      id: 2,
      name: "Dinithi Perera",
      rating: 5,
      body: "Ordered for my son, arrived in two days and the fit was spot on. Very happy.",
      date: "1 month ago",
    },
    {
      id: 3,
      name: "Sanjula Herath",
      rating: 4,
      body: "Good product overall. Would have liked one more size option, but no complaints otherwise.",
      date: "1 month ago",
    },
  ],
};

function Stars({
  value,
  size = 14,
}: {
  value: number;
  size?: number;
}) {
  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: 5 }).map((_, i) => (
        <Star
          key={i}
          size={size}
          className={i < value ? "fill-gold text-gold" : "fill-white/15 text-white/15"}
        />
      ))}
    </div>
  );
}

export default function ReviewsBlock({
  productSlug,
  productName,
  seedRating,
  seedCount,
}: {
  productSlug: string;
  productName: string;
  seedRating: number;
  seedCount: number;
}) {
  const [list, setList] = useState<Review[]>(
    seeds[productSlug] ?? seeds.default
  );
  const [open, setOpen] = useState(false);
  const [sent, setSent] = useState(false);
  const [name, setName] = useState("");
  const [rating, setRating] = useState(5);
  const [body, setBody] = useState("");

  const avg = useMemo(() => {
    if (list.length === 0) return seedRating;
    const total = list.reduce((a, r) => a + r.rating, 0);
    return Math.round((total / list.length) * 10) / 10;
  }, [list, seedRating]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !body.trim()) return;
    setList((prev) => [
      {
        id: Date.now(),
        name: name.trim(),
        rating,
        body: body.trim(),
        date: "Just now",
      },
      ...prev,
    ]);
    setSent(true);
    setName("");
    setBody("");
    setRating(5);
    window.setTimeout(() => setSent(false), 2500);
  };

  return (
    <div className="mt-24" id="reviews">
      <SectionHead
        align="left"
        eyebrow="Customer Reviews"
        title="What Thomians say"
      />

      {/* summary + toggle */}
      <Reveal delay={80}>
        <div className="mt-8 flex flex-wrap items-center gap-x-8 gap-y-5 border-y border-white/10 py-6">
          <div className="flex items-center gap-4">
            <span className="font-display text-4xl font-semibold leading-none">
              {avg}
            </span>
            <div>
              <Stars value={Math.round(avg)} />
              <p className="mt-1.5 text-xs text-white/35">
                Based on {seedCount} reviews
              </p>
            </div>
          </div>

          <button
            onClick={() => setOpen((v) => !v)}
            className="ml-auto rounded-full bg-white px-6 py-3 text-[11px] font-bold uppercase tracking-[0.22em] text-ink transition-all duration-300 hover:shadow-[0_0_32px_rgba(255,255,255,0.2)]"
          >
            {open ? "Close" : "Write a review"}
          </button>
        </div>
      </Reveal>

      {/* form */}
      <div
        className={`grid transition-[grid-template-rows,opacity] duration-500 ease-out ${
          open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
        }`}
      >
        <div className="overflow-hidden">
          <form
            onSubmit={submit}
            className="mt-8 rounded-[1.5rem] bg-navy-950 p-7"
          >
            <p className="text-sm font-semibold text-white">
              Reviewing {productName}
            </p>

            <div className="mt-5 flex items-center gap-3">
              <span className="text-xs font-semibold uppercase tracking-[0.2em] text-white/40">
                Your rating
              </span>
              <div className="flex items-center gap-1">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setRating(n)}
                    aria-label={`${n} star${n > 1 ? "s" : ""}`}
                    className="transition-transform duration-200 hover:scale-110"
                  >
                    <Star
                      size={22}
                      className={
                        n <= rating ? "fill-gold text-gold" : "fill-white/15 text-white/15"
                      }
                    />
                  </button>
                ))}
              </div>
            </div>

            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your name"
              required
              className="mt-5 w-full rounded-xl bg-navy-800 px-5 py-3.5 text-sm text-white outline-none transition placeholder:text-white/30 focus:bg-navy-700"
            />
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="How was the product? Fit, quality, delivery…"
              required
              rows={4}
              className="mt-3 w-full resize-none rounded-xl bg-navy-800 px-5 py-3.5 text-sm leading-relaxed text-white outline-none transition placeholder:text-white/30 focus:bg-navy-700"
            />

            <div className="mt-4 flex items-center gap-3">
              <button
                type="submit"
                className="rounded-full bg-gold px-7 py-3.5 text-[11px] font-extrabold uppercase tracking-[0.22em] text-ink transition-all duration-300 hover:shadow-[0_0_36px_rgba(255,212,68,0.28)]"
              >
                {sent ? (
                  <span className="flex items-center gap-2">
                    <Check size={14} /> Review posted
                  </span>
                ) : (
                  "Post review"
                )}
              </button>
              {sent && (
                <span className="text-xs text-white/45">
                  Thank you — your review is now live.
                </span>
              )}
            </div>
          </form>
        </div>
      </div>

      {/* list */}
      <div className="mt-10 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {list.map((r, i) => (
          <Reveal key={r.id} delay={i * 80} className="h-full">
            <div className="flex h-full flex-col rounded-[1.5rem] bg-navy-950 p-6">
              <div className="flex items-center gap-3.5">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-navy-800 font-display text-sm font-semibold text-white">
                  {r.name.charAt(0)}
                </span>
                <div>
                  <p className="text-sm font-semibold text-white">{r.name}</p>
                  <p className="mt-0.5 text-xs text-white/35">{r.date}</p>
                </div>
              </div>
              <div className="mt-4">
                <Stars value={r.rating} />
              </div>
              <p className="mt-3.5 flex-1 text-sm leading-relaxed text-white/60">
                {r.body}
              </p>
            </div>
          </Reveal>
        ))}
      </div>
    </div>
  );
}
