"use client";

import { useEffect, useState } from "react";
import { ArrowRight, Minus, Plus, ShoppingBag, Trash2, X } from "lucide-react";
import { useCart } from "@/components/context/CartContext";
import { lkr } from "@/data/seed";
import CheckoutForm from "@/components/CheckoutForm";
import Link from "next/link";

const FREE_SHIPPING = 5000;

export default function CartDrawer() {
  const [checkout, setCheckout] = useState(false);
  const { items, isOpen, setOpen, setQty, remove, subtotal, count } = useCart();

  useEffect(() => {
    document.body.style.overflow = isOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  // An aria-hidden container must not hold focusable elements (axe
  // aria-hidden-focus). Use `inert` while the drawer is closed so the
  // panel stays mounted for its slide animation but is untabbable.
  const inertProps = isOpen ? {} : ({ inert: true } as const);

  const remaining = Math.max(0, FREE_SHIPPING - subtotal);
  const pct = Math.min(100, (subtotal / FREE_SHIPPING) * 100);

  return (
    <div
      className={`fixed inset-0 z-[80] ${isOpen ? "" : "pointer-events-none"}`}
      aria-hidden={!isOpen}
      {...inertProps}
    >
      <div
        onClick={() => setOpen(false)}
        className={`absolute inset-0 bg-black/80 transition-opacity duration-500 ${
          isOpen ? "opacity-100" : "opacity-0"
        }`}
      />
      <aside
        className={`absolute right-0 top-0 flex h-full w-full max-w-md flex-col border-l border-white/10 bg-[#05070f] transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] ${
          isOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        {/* header */}
        <div className="flex items-center justify-between border-b border-white/5 px-6 py-5">
          <div>
            <h3 className="font-display text-2xl font-medium">Your Bag</h3>
            <p className="text-xs text-white/60">
              {count === 0 ? "No items yet" : `${count} item${count > 1 ? "s" : ""}`}
            </p>
          </div>
          <button
            onClick={() => setOpen(false)}
            aria-label="Close bag"
            className="grid h-9 w-9 place-items-center rounded-full border border-white/10 text-white/70 transition hover:bg-navy-800 hover:text-white"
          >
            <X size={16} />
          </button>
        </div>

        {items.length > 0 ? (
          <>
            {/* free shipping meter */}
            <div className="border-b border-white/5 px-6 py-4">
              {remaining > 0 ? (
                <p className="text-xs text-white/50">
                  You’re{" "}
                  <span className="font-semibold text-white">{lkr(remaining)}</span>{" "}
                  away from free island-wide shipping
                </p>
              ) : (
                <p className="text-xs font-semibold text-white">
                  You’ve unlocked free island-wide shipping
                </p>
              )}
              <div className="mt-2.5 h-1 overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full rounded-full bg-accent transition-all duration-700"
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>

            {/* items */}
            <div className="flex-1 overflow-y-auto px-6 py-4">
              <ul className="divide-y divide-white/5">
                {items.map((item) => (
                  <li key={item.slug} className="flex gap-4 py-5">
                    <img
                      src={item.image}
                      alt={item.name}
                      className="h-20 w-20 rounded-2xl border border-white/10 object-cover"
                    />
                    <div className="flex min-w-0 flex-1 flex-col">
                      <div className="flex items-start justify-between gap-2">
                        <p className="font-display text-lg leading-snug text-white">
                          {item.name}
                        </p>
                        <button
                          onClick={() => remove(item.slug)}
                          aria-label={`Remove ${item.name}`}
                          className="text-white/50 transition hover:text-red-400"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                      <p className="mt-0.5 text-sm font-semibold text-white">
                        {lkr(item.price)}
                      </p>
                      <div className="mt-auto flex items-center gap-3 pt-2">
                        <button
                          onClick={() => setQty(item.slug, item.qty - 1)}
                          aria-label="Decrease quantity"
                          className="grid h-7 w-7 place-items-center rounded-full border border-white/15 text-white/60 transition hover:bg-navy-800 hover:text-white"
                        >
                          <Minus size={12} />
                        </button>
                        <span className="min-w-4 text-center text-sm font-semibold">
                          {item.qty}
                        </span>
                        <button
                          onClick={() => setQty(item.slug, item.qty + 1)}
                          aria-label="Increase quantity"
                          className="grid h-7 w-7 place-items-center rounded-full border border-white/15 text-white/60 transition hover:bg-navy-800 hover:text-white"
                        >
                          <Plus size={12} />
                        </button>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </div>

            {/* footer */}
            <div className="border-t border-white/10 px-6 py-6">
              <div className="flex items-center justify-between text-sm">
                <span className="text-white/50">Subtotal</span>
                <span className="text-base font-semibold text-white">
                  {lkr(subtotal)}
                </span>
              </div>
              <p className="mt-1 text-xs text-white/50">
                Shipping &amp; taxes calculated at checkout.
              </p>
              <button
                onClick={() => setCheckout(true)}
                className="mt-5 flex w-full items-center justify-center gap-2 rounded-full bg-accent py-4 text-xs font-bold uppercase tracking-[0.25em] text-ink transition hover:shadow-[0_0_45px_rgba(255,255,255,0.10)]"
              >
                Checkout <ArrowRight size={14} />
              </button>
            </div>
          </>
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center px-8 text-center">
            <span className="grid h-16 w-16 place-items-center rounded-full border border-white/10 text-white/50">
              <ShoppingBag size={24} />
            </span>
            <p className="mt-5 font-display text-2xl text-white/85">
              Your bag is empty
            </p>
            <p className="mt-2 text-sm text-white/60">
              Crests, scarves &amp; tickets await — go on, be a proud Thomian.
            </p>
            <Link
              href="/shop"
              onClick={() => setOpen(false)}
              className="mt-7 rounded-full bg-accent px-7 py-3.5 text-[11px] font-bold uppercase tracking-[0.25em] text-ink transition hover:shadow-[0_0_40px_rgba(255,255,255,0.10)]"
            >
              Explore the store
            </Link>
          </div>
        )}
      </aside>

      {checkout && (
        <CheckoutForm
          onClose={() => {
            setCheckout(false);
            setOpen(false);
          }}
        />
      )}
    </div>
  );
}
