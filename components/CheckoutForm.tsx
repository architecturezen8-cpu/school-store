"use client";

import { useState } from "react";
import { ArrowRight, Check, Loader2, X } from "lucide-react";
import { useCart } from "@/components/context/CartContext";
import { lkr } from "@/lib/format";
import { errorMessage } from "@/lib/errors";

type Result = {
  reference: string;
  total: number;
  delivery: number;
  subtotal: number;
};

/**
 * Cash-on-delivery style checkout: the only thing the browser sends is
 * `{ slug, qty }` — every price, the delivery fee and the order reference are
 * decided server-side (app/api/orders/route.ts).
 */
export default function CheckoutForm({ onClose }: { onClose: () => void }) {
  const { items, subtotal, clear } = useCart();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<Result | null>(null);
  const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

  const delivery = subtotal >= 5000 || subtotal === 0 ? 0 : 400;
  const total = subtotal + delivery;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!name.trim() || !email.includes("@")) {
      setError("Please add your name and a valid email — that is where the receipt goes.");
      return;
    }

    setBusy(true);
    try {
      const res = await fetch(`${basePath}/api/orders`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          email,
          phone,
          note,
          items: items.map((i) => ({ slug: i.slug, qty: i.qty, variant: i.variant ?? "" })),
        }),
      });
      if (!res.headers.get("content-type")?.includes("application/json")) {
        throw new Error(
          "Checkout needs the live store server. This is a read-only preview of the catalogue."
        );
      }
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Could not place the order.");
      setDone(data.order);
      clear();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[95] grid place-items-center overflow-y-auto px-4 py-10"
      role="dialog"
      aria-modal="true"
      aria-label="Checkout"
    >
      <div className="absolute inset-0 bg-black/85" onClick={onClose} />

      <div className="relative w-full max-w-md rounded-[2rem] border border-white/10 bg-[#070b16] p-8 shadow-[0_40px_120px_rgba(0,0,0,0.75)]">
        <button
          onClick={onClose}
          aria-label="Close"
          className="absolute right-5 top-5 grid h-9 w-9 place-items-center rounded-full border border-white/10 text-white/60 transition hover:bg-navy-800 hover:text-white"
        >
          <X size={15} />
        </button>

        {done ? (
          <div>
            <div className="grid h-12 w-12 place-items-center rounded-full bg-accent text-ink">
              <Check size={20} />
            </div>
            <h3 className="mt-5 font-display text-2xl font-medium">Order placed</h3>
            <p className="mt-2 text-sm leading-relaxed text-white/60">
              Keep this reference — you can track the order from the footer with it and your
              email.
            </p>
            <p className="mt-5 rounded-2xl border border-white/10 bg-navy-800 px-5 py-4 text-center font-display text-xl tracking-[0.18em]">
              {done.reference}
            </p>
            <dl className="mt-5 space-y-2 text-sm">
              <div className="flex justify-between text-white/60">
                <dt>Subtotal</dt>
                <dd>{lkr(done.subtotal)}</dd>
              </div>
              <div className="flex justify-between text-white/60">
                <dt>Delivery</dt>
                <dd>{done.delivery === 0 ? "Free" : lkr(done.delivery)}</dd>
              </div>
              <div className="flex justify-between border-t border-white/10 pt-2 font-semibold">
                <dt>Total</dt>
                <dd>{lkr(done.total)}</dd>
              </div>
            </dl>
            <button
              onClick={onClose}
              className="mt-7 w-full rounded-full border border-white/15 py-3 text-xs font-semibold uppercase tracking-[0.25em] text-white/70 transition hover:bg-navy-800 hover:text-white"
            >
              Done
            </button>
          </div>
        ) : (
          <form onSubmit={submit}>
            <h3 className="font-display text-2xl font-medium">Checkout</h3>
            <p className="mt-2 text-sm text-white/55">
              Pay on delivery. We only need a name and an email for the receipt.
            </p>

            <div className="mt-6 space-y-3">
              <input
                name="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Full name"
                aria-label="Full name"
                autoComplete="name"
                required
                className="w-full rounded-full border border-white/15 bg-navy-800 px-5 py-3 text-sm outline-none transition placeholder:text-white/45 focus:border-white/40"
              />
              <input
                name="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Email"
                type="email"
                inputMode="email"
                aria-label="Email"
                autoComplete="email"
                required
                className="w-full rounded-full border border-white/15 bg-navy-800 px-5 py-3 text-sm outline-none transition placeholder:text-white/45 focus:border-white/40"
              />
              <input
                name="phone"
                type="tel"
                inputMode="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="Phone (optional)"
                aria-label="Phone"
                autoComplete="tel"
                className="w-full rounded-full border border-white/15 bg-navy-800 px-5 py-3 text-sm outline-none transition placeholder:text-white/45 focus:border-white/40"
              />
              <textarea
                name="address"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Delivery address / note"
                aria-label="Delivery address or note"
                autoComplete="street-address"
                rows={2}
                className="w-full rounded-2xl border border-white/15 bg-navy-800 px-5 py-3 text-sm outline-none transition placeholder:text-white/45 focus:border-white/40"
              />
            </div>

            <dl className="mt-5 space-y-2 text-sm">
              <div className="flex justify-between text-white/60">
                <dt>Subtotal</dt>
                <dd>{lkr(subtotal)}</dd>
              </div>
              <div className="flex justify-between text-white/60">
                <dt>Delivery</dt>
                <dd>{delivery === 0 ? "Free" : lkr(delivery)}</dd>
              </div>
              <div className="flex justify-between border-t border-white/10 pt-2 font-semibold">
                <dt>Total</dt>
                <dd>{lkr(total)}</dd>
              </div>
            </dl>

            {error && (
              <p role="alert" className="mt-4 rounded-xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-xs text-red-200">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={busy || items.length === 0}
              className="mt-6 flex w-full items-center justify-center gap-2 rounded-full bg-accent py-3.5 text-xs font-bold uppercase tracking-[0.25em] text-ink transition disabled:opacity-50"
            >
              {busy ? <Loader2 size={14} className="animate-spin" /> : <>Place order <ArrowRight size={14} /></>}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
