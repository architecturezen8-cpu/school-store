"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Loader2, PackageSearch, X } from "lucide-react";
import { lkr } from "@/lib/format";
import { errorMessage } from "@/lib/errors";

type Order = {
  reference: string;
  status: string;
  total: number;
  createdAt: string;
  items: { name: string; qty: number; price: number }[];
};

const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
const STATIC_NOTE =
  "Order tracking needs the live store server. This is a read-only preview of the catalogue.";

const ORDER_STEPS = ["pending", "paid", "packed", "shipped", "delivered"] as const;
const STEP_LABEL: Record<string, string> = {
  pending: "Order placed",
  paid: "Payment received",
  packed: "Packed with care",
  shipped: "On the way",
  delivered: "Delivered",
};

export default function TrackOrderModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [orderId, setOrderId] = useState("");
  const [email, setEmail] = useState("");
  const [order, setOrder] = useState<Order | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
      setOrder(null);
      setOrderId("");
      setError(null);
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // focus the order-ID field as soon as the dialog opens
  useEffect(() => {
    if (open) {
      const t = window.setTimeout(() => inputRef.current?.focus(), 60);
      return () => window.clearTimeout(t);
    }
  }, [open]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[90] grid place-items-center px-4"
      role="dialog"
      aria-modal="true"
      aria-label="Track my order"
    >
      <div
        className="absolute inset-0 bg-black/80"
        onClick={onClose}
      />
      <div className="relative w-full max-w-md overflow-hidden rounded-[2rem] border border-white/10 bg-[#070b16] p-8 shadow-[0_40px_120px_rgba(0,0,0,0.7)]">
        <div className="pointer-events-none absolute -top-24 left-1/2 h-48 w-72 -translate-x-1/2 rounded-full bg-[radial-gradient(closest-side,rgba(255,255,255,0.10),transparent)]" />
        <button
          onClick={onClose}
          aria-label="Close"
          className="absolute right-5 top-5 grid h-9 w-9 place-items-center rounded-full border border-white/10 text-white/60 transition hover:bg-navy-800 hover:text-white"
        >
          <X size={15} />
        </button>

        <div className="grid h-12 w-12 place-items-center rounded-full border border-white/15 bg-navy-800 text-white">
          <PackageSearch size={20} />
        </div>
        <h3 className="mt-5 font-display text-3xl font-medium">Track my order</h3>
        <p className="mt-2 text-sm leading-relaxed text-white/50">
          Enter the order ID from your confirmation email, plus the email it was sent to.
        </p>

        {!order ? (
          <form
            aria-label="Track an order"
            className="mt-6"
            onSubmit={async (e) => {
              e.preventDefault();
              setError(null);
              if (!orderId.trim() || !email.includes("@")) {
                setError("Add the order ID and the email used at checkout.");
                return;
              }
              setBusy(true);
              try {
                const res = await fetch(
                  `${basePath}/api/orders/${encodeURIComponent(orderId.trim().toUpperCase())}?email=${encodeURIComponent(email.trim())}`,
                  { headers: { accept: "application/json" } }
                );
                // A static host answers unknown paths with its HTML 404 page;
                // tell the user the store is in preview mode instead of leaking
                // a JSON parse error.
                const isJson = res.headers.get("content-type")?.includes("application/json");
                if (!isJson) throw new Error(STATIC_NOTE);
                const data = await res.json();
                if (!res.ok) throw new Error(data?.error ?? "Order not found.");
                setOrder(data.order);
              } catch (err) {
                const message = errorMessage(err);
                setError(/not valid JSON|Failed to fetch|Unexpected token/i.test(message) ? STATIC_NOTE : message);
              } finally {
                setBusy(false);
              }
            }}
          >
            <input
              ref={inputRef}
              value={orderId}
              onChange={(e) => setOrderId(e.target.value)}
              placeholder="e.g. STC-01042"
              aria-label="Order ID"
              className="w-full rounded-full border border-white/15 bg-navy-800 px-5 py-3.5 text-sm tracking-wider text-white outline-none transition placeholder:text-white/50 focus:border-white/40 focus:bg-navy-700"
            />
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email used at checkout"
              aria-label="Email"
              type="email"
              className="mt-3 w-full rounded-full border border-white/15 bg-navy-800 px-5 py-3.5 text-sm text-white outline-none transition placeholder:text-white/50 focus:border-white/40 focus:bg-navy-700"
            />
            {error && (
              <p role="alert" className="mt-3 rounded-xl border border-red-400/30 bg-red-500/10 px-4 py-2.5 text-xs text-red-200">
                {error}
              </p>
            )}
            <button
              type="submit"
              disabled={busy}
              className="mt-3 flex w-full items-center justify-center gap-2 rounded-full bg-accent py-3.5 text-xs font-bold uppercase tracking-[0.25em] text-ink transition disabled:opacity-60 hover:shadow-[0_0_40px_rgba(255,255,255,0.10)]"
            >
              {busy ? <Loader2 size={14} className="animate-spin" /> : "Track order"}
            </button>
          </form>
        ) : (
          <div className="mt-6">
            <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-navy-800 px-4 py-3">
              <span className="text-[10px] font-bold uppercase tracking-[0.25em] text-white/60">
                Order
              </span>
              <span className="font-semibold tracking-widest text-white">
                {order.reference}
              </span>
            </div>
            <p className="mt-4 text-sm text-white/60">
              {order.items.reduce((n, i) => n + i.qty, 0)} item(s) ·{" "}
              <span className="text-white">{lkr(order.total)}</span>
            </p>

            <ol className="mt-7">
              {ORDER_STEPS.map((s, i) => {
                const current = ORDER_STEPS.indexOf(order.status as (typeof ORDER_STEPS)[number]);
                const done = current < 0 ? i === 0 : i < current;
                const active = current < 0 ? false : i === current;
                return (
                  <li
                    key={s}
                    className="relative flex gap-4 pb-7 last:pb-0"
                  >
                    {i < ORDER_STEPS.length - 1 && (
                      <span
                        className={`absolute left-[11px] top-7 h-[calc(100%-1.75rem)] w-px ${
                          done ? "bg-accent/60" : "bg-white/10"
                        }`}
                      />
                    )}
                    <span
                      className={`relative z-10 grid h-6 w-6 shrink-0 place-items-center rounded-full border ${
                        done
                          ? "border-white bg-white text-ink"
                          : active
                            ? "border-white bg-transparent text-white"
                            : "border-white/20 text-white/50"
                      }`}
                    >
                      {done ? (
                        <Check size={12} />
                      ) : (
                        <span
                          className={`h-1.5 w-1.5 rounded-full ${
                            active ? "animate-pulse bg-accent" : "bg-white/30"
                          }`}
                        />
                      )}
                    </span>
                    <div className="-mt-0.5 flex-1">
                      <p
                        className={`text-sm font-semibold ${
                          done || active ? "text-white" : "text-white/60"
                        }`}
                      >
                        {STEP_LABEL[s]}
                      </p>
                      <p className="mt-0.5 text-xs text-white/60">
                        {i === 0
                          ? new Intl.DateTimeFormat("en-GB", {
                              dateStyle: "medium",
                              timeStyle: "short",
                              timeZone: "Asia/Colombo",
                            }).format(new Date(order.createdAt))
                          : i === ORDER_STEPS.length - 1
                            ? "Expected within 3 working days"
                            : active
                              ? "Current stage"
                              : "Pending"}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ol>
            <button
              onClick={() => {
                setOrder(null);
                setOrderId("");
                setError(null);
              }}
              className="mt-7 w-full rounded-full border border-white/15 py-3 text-xs font-semibold uppercase tracking-[0.25em] text-white/60 transition hover:bg-navy-800 hover:text-white"
            >
              Track another
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
