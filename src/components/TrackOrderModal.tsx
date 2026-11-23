import { useEffect, useState } from "react";
import { Check, PackageSearch, X } from "lucide-react";

const steps = [
  { label: "Order placed", time: "Mon, 10:24 AM" },
  { label: "Packed with care", time: "Mon, 4:02 PM" },
  { label: "On the way", time: "Tue, 9:15 AM" },
  { label: "Delivered", time: "Expected Wednesday" },
];

export default function TrackOrderModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [orderId, setOrderId] = useState("");
  const [trackedId, setTrackedId] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
      setTrackedId(null);
      setOrderId("");
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

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[90] grid place-items-center px-4">
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
          Enter the order ID from your confirmation email.
        </p>

        {!trackedId ? (
          <form
            className="mt-6"
            onSubmit={(e) => {
              e.preventDefault();
              if (orderId.trim()) setTrackedId(orderId.trim().toUpperCase());
            }}
          >
            <input
              value={orderId}
              onChange={(e) => setOrderId(e.target.value)}
              placeholder="e.g. STC-1873"
              className="w-full rounded-full border border-white/15 bg-navy-800 px-5 py-3.5 text-sm tracking-wider text-white outline-none transition placeholder:text-white/25 focus:border-white/40 focus:bg-navy-700"
            />
            <button
              type="submit"
              className="mt-3 w-full rounded-full bg-accent py-3.5 text-xs font-bold uppercase tracking-[0.25em] text-ink transition hover:shadow-[0_0_40px_rgba(255,255,255,0.10)]"
            >
              Track order
            </button>
          </form>
        ) : (
          <div className="mt-6">
            <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-navy-800 px-4 py-3">
              <span className="text-[10px] font-bold uppercase tracking-[0.25em] text-white/40">
                Order
              </span>
              <span className="font-semibold tracking-widest text-white">
                {trackedId}
              </span>
            </div>
            <ol className="mt-7">
              {steps.map((s, i) => {
                const done = i < 2;
                const active = i === 2;
                return (
                  <li
                    key={s.label}
                    className="relative flex gap-4 pb-7 last:pb-0"
                  >
                    {i < steps.length - 1 && (
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
                            : "border-white/20 text-white/30"
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
                          done || active ? "text-white" : "text-white/35"
                        }`}
                      >
                        {s.label}
                      </p>
                      <p className="mt-0.5 text-xs text-white/35">{s.time}</p>
                    </div>
                  </li>
                );
              })}
            </ol>
            <button
              onClick={() => {
                setTrackedId(null);
                setOrderId("");
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
