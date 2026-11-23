import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Minus,
  Plus,
  X,
} from "lucide-react";
import { lkr } from "../data";
import {
  bookingRef,
  fullDate,
  type CollegeEvent,
  type Tier,
} from "../events";

const STEPS = ["Tickets", "Details", "Confirmed"];

export default function TicketBooking({
  event,
  onClose,
}: {
  event: CollegeEvent | null;
  onClose: () => void;
}) {
  const [step, setStep] = useState(1);
  const [qty, setQty] = useState<Record<string, number>>({});
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [ref, setRef] = useState("");

  // reset whenever a new event opens
  useEffect(() => {
    if (!event) return;
    setStep(1);
    setName("");
    setEmail("");
    setPhone("");
    setRef("");
    setQty({ [event.tiers[0]?.id ?? ""]: 1 });
  }, [event]);

  useEffect(() => {
    if (!event) return;
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
  }, [event, onClose]);

  const total = useMemo(
    () =>
      event
        ? event.tiers.reduce((sum, t) => sum + (qty[t.id] ?? 0) * t.price, 0)
        : 0,
    [event, qty]
  );

  const count = useMemo(
    () => event?.tiers.reduce((n, t) => n + (qty[t.id] ?? 0), 0) ?? 0,
    [event, qty]
  );

  const chosen = useMemo(
    () =>
      event
        ? event.tiers.filter((t) => (qty[t.id] ?? 0) > 0)
        : [],
    [event, qty]
  );

  if (!event) return null;

  const bump = (t: Tier, delta: number) =>
    setQty((q) => ({
      ...q,
      [t.id]: Math.max(0, Math.min(8, (q[t.id] ?? 0) + delta)),
    }));

  const advance = () => {
    if (step === 1) {
      if (count === 0) return;
      setStep(2);
      return;
    }
    if (step === 2) {
      if (!name.trim() || !email.trim()) return;
      setRef(bookingRef());
      setStep(3);
    }
  };

  const bars = ref.split("").map((c) => (c.charCodeAt(0) % 4) + 1);

  return createPortal(
    <div
      className="fixed inset-0 z-[999] flex items-center justify-center px-4 py-8"
      role="dialog"
      aria-modal="true"
    >
      <div className="absolute inset-0 bg-ink/90" onClick={onClose} />

      <div className="relative max-h-[92vh] w-full max-w-xl overflow-y-auto rounded-[1.75rem] border border-white/10 bg-ink shadow-[0_40px_120px_rgba(0,0,0,0.85)]">
        {/* header */}
        <div className="border-b border-white/8 px-7 pb-5 pt-7">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.26em] text-gold">
                Book Tickets
              </p>
              <h3 className="mt-2.5 font-display text-2xl font-semibold leading-tight tracking-tight">
                {event.title}
              </h3>
              <p className="mt-1.5 text-[13px] text-white/45">
                {fullDate(event.date)} · {event.venue}, {event.city}
              </p>
            </div>
            <button
              onClick={onClose}
              aria-label="Close booking"
              className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-white/55 transition-colors hover:bg-navy-900 hover:text-white"
            >
              <X size={17} />
            </button>
          </div>

          {/* step indicator */}
          <div className="mt-6 flex items-center gap-2">
            {STEPS.map((label, i) => {
              const n = i + 1;
              const done = step > n;
              const active = step === n;
              return (
                <div key={label} className="flex flex-1 items-center gap-2">
                  <span
                    className={`grid h-6 w-6 shrink-0 place-items-center rounded-full text-[10px] font-bold transition-colors ${
                      done
                        ? "bg-gold text-ink"
                        : active
                          ? "bg-white text-ink"
                          : "bg-navy-900 text-white/40"
                    }`}
                  >
                    {done ? <Check size={11} /> : n}
                  </span>
                  <span
                    className={`text-[11px] font-semibold uppercase tracking-[0.14em] ${
                      active ? "text-white" : "text-white/35"
                    }`}
                  >
                    {label}
                  </span>
                  {i < STEPS.length - 1 && (
                    <span className="h-px flex-1 bg-white/10" />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* ---------------- step 1 : tickets ---------------- */}
        {step === 1 && (
          <div className="px-7 py-6">
            <div className="space-y-3">
              {event.tiers.map((t) => {
                const on = (qty[t.id] ?? 0) > 0;
                return (
                  <div
                    key={t.id}
                    className={`rounded-2xl border p-5 transition-colors duration-300 ${
                      on
                        ? "border-white/25 bg-navy-900"
                        : "border-white/8 bg-navy-950 hover:border-white/20"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <button
                        onClick={() =>
                          setQty((q) => ({ ...q, [t.id]: on ? 0 : 1 }))
                        }
                        className="flex flex-1 items-start gap-3.5 text-left"
                      >
                        <span
                          className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full border transition-colors ${
                            on
                              ? "border-white bg-white text-ink"
                              : "border-white/25"
                          }`}
                        >
                          {on && <Check size={11} />}
                        </span>
                        <span>
                          <span className="flex flex-wrap items-center gap-2">
                            <span className="font-display text-[17px] font-semibold text-white">
                              {t.name}
                            </span>
                            {t.note && (
                              <span className="rounded-full bg-gold px-2.5 py-0.5 text-[9px] font-bold uppercase tracking-[0.12em] text-ink">
                                {t.note}
                              </span>
                            )}
                          </span>
                          <span className="mt-2 block space-y-1">
                            {t.perks.map((p) => (
                              <span
                                key={p}
                                className="flex items-start gap-2 text-[12.5px] leading-snug text-white/50"
                              >
                                <span className="mt-[0.4rem] h-1 w-1 shrink-0 rounded-full bg-white/25" />
                                {p}
                              </span>
                            ))}
                          </span>
                        </span>
                      </button>

                      <div className="shrink-0 text-right">
                        <p className="font-display text-[15px] font-semibold text-white">
                          {t.price === 0 ? "Free" : lkr(t.price)}
                        </p>
                        {on && (
                          <div className="mt-3 flex items-center rounded-full bg-navy-800">
                            <button
                              onClick={() => bump(t, -1)}
                              aria-label="Remove one"
                              className="grid h-8 w-8 place-items-center rounded-l-full text-white/60 transition hover:text-white"
                            >
                              <Minus size={13} />
                            </button>
                            <span className="min-w-6 text-center text-[13px] font-semibold">
                              {qty[t.id] ?? 0}
                            </span>
                            <button
                              onClick={() => bump(t, 1)}
                              aria-label="Add one"
                              className="grid h-8 w-8 place-items-center rounded-r-full text-white/60 transition hover:text-white"
                            >
                              <Plus size={13} />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="mt-6 flex items-center justify-between border-t border-white/8 pt-5">
              <span className="text-[13px] text-white/45">
                {count} ticket{count === 1 ? "" : "s"}
              </span>
              <span className="font-display text-xl font-semibold">
                {total === 0 ? "Free" : lkr(total)}
              </span>
            </div>

            <button
              onClick={advance}
              disabled={count === 0}
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-full bg-gold py-4 text-[11px] font-extrabold uppercase tracking-[0.22em] text-ink transition-all duration-300 disabled:cursor-not-allowed disabled:opacity-30 enabled:hover:shadow-[0_0_36px_rgba(255,212,68,0.28)]"
            >
              Continue <ArrowRight size={14} />
            </button>
          </div>
        )}

        {/* ---------------- step 2 : details ---------------- */}
        {step === 2 && (
          <div className="px-7 py-6">
            <div className="rounded-2xl bg-navy-950 p-5">
              <div className="flex items-center justify-between text-[13px]">
                <span className="text-white/45">
                  {count} ticket{count === 1 ? "" : "s"}
                  {chosen.length > 0 && ` · ${chosen[0].name}`}
                  {chosen.length > 1 && ` +${chosen.length - 1}`}
                </span>
                <span className="font-semibold text-white">{lkr(total)}</span>
              </div>
            </div>

            <div className="mt-6 space-y-3">
              <Field
                label="Full name"
                value={name}
                onChange={setName}
                placeholder="A. B. Perera"
                type="text"
              />
              <Field
                label="Email"
                value={email}
                onChange={setEmail}
                placeholder="you@example.lk"
                type="email"
              />
              <Field
                label="Phone"
                value={phone}
                onChange={setPhone}
                placeholder="+94 7X XXX XXXX"
                type="tel"
              />
            </div>

            <p className="mt-4 text-[12px] leading-relaxed text-white/35">
              E-tickets are emailed instantly. Show the booking reference at the
              gate.
            </p>

            <div className="mt-6 flex gap-3">
              <button
                onClick={() => setStep(1)}
                className="grid w-12 shrink-0 place-items-center rounded-full border border-white/15 text-white/60 transition-colors hover:border-white/40 hover:text-white"
                aria-label="Back"
              >
                <ArrowLeft size={15} />
              </button>
              <button
                onClick={advance}
                className="flex flex-1 items-center justify-center gap-2 rounded-full bg-gold py-4 text-[11px] font-extrabold uppercase tracking-[0.22em] text-ink transition-all duration-300 hover:shadow-[0_0_36px_rgba(255,212,68,0.28)]"
              >
                Confirm booking <ArrowRight size={14} />
              </button>
            </div>
          </div>
        )}

        {/* ---------------- step 3 : confirmed ---------------- */}
        {step === 3 && (
          <div className="px-7 py-7">
            <div className="flex items-center gap-3">
              <span className="grid h-10 w-10 place-items-center rounded-full bg-gold text-ink">
                <Check size={18} />
              </span>
              <div>
                <p className="font-display text-xl font-semibold">Booked.</p>
                <p className="text-[13px] text-white/45">
                  Sent to {email || "your email"}
                </p>
              </div>
            </div>

            {/* the ticket itself */}
            <div className="relative mt-7 overflow-hidden rounded-2xl bg-white text-ink">
              <div className="px-6 pb-5 pt-6">
                <p className="text-[9px] font-bold uppercase tracking-[0.3em] text-ink/45">
                  St. Thomas’ College Matale
                </p>
                <p className="mt-2.5 font-display text-[1.45rem] font-semibold leading-tight tracking-tight">
                  {event.title}
                </p>
                <p className="mt-1 text-[12px] text-ink/55">{event.subtitle}</p>

                <div className="mt-5 grid grid-cols-2 gap-x-4 gap-y-4 text-[12px]">
                  <div>
                    <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-ink/40">
                      Date
                    </p>
                    <p className="mt-1 font-semibold">{fullDate(event.date)}</p>
                  </div>
                  <div>
                    <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-ink/40">
                      Venue
                    </p>
                    <p className="mt-1 font-semibold">
                      {event.venue}, {event.city}
                    </p>
                  </div>
                  <div>
                    <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-ink/40">
                      Tickets
                    </p>
                    <p className="mt-1 font-semibold">
                      {chosen.map((t) => `${qty[t.id]} × ${t.name}`).join(", ")}
                    </p>
                  </div>
                  <div>
                    <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-ink/40">
                      Doors
                    </p>
                    <p className="mt-1 font-semibold">{event.doors}</p>
                  </div>
                </div>
              </div>

              {/* perforation */}
              <div className="relative">
                <div className="border-t border-dashed border-ink/25" />
                <span className="absolute -left-3 -top-3 h-6 w-6 rounded-full bg-ink" />
                <span className="absolute -right-3 -top-3 h-6 w-6 rounded-full bg-ink" />
              </div>

              <div className="flex items-center justify-between gap-4 px-6 py-5">
                <div>
                  <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-ink/40">
                    Booking reference
                  </p>
                  <p className="mt-1 font-display text-lg font-bold tracking-[0.08em]">
                    {ref}
                  </p>
                  <p className="mt-1 text-[11px] text-ink/55">
                    {total === 0 ? "Free admission" : `Total paid · ${lkr(total)}`}
                  </p>
                </div>
                <div className="flex h-11 items-end gap-[2px]">
                  {bars.map((w, i) => (
                    <span
                      key={i}
                      style={{ width: `${w}px` }}
                      className="h-full bg-ink/85"
                    />
                  ))}
                </div>
              </div>
            </div>

            <button
              onClick={onClose}
              className="mt-6 w-full rounded-full bg-white py-4 text-[11px] font-bold uppercase tracking-[0.22em] text-ink transition-all duration-300 hover:shadow-[0_0_36px_rgba(255,255,255,0.2)]"
            >
              Done
            </button>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  type,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  type: string;
}) {
  return (
    <label className="block">
      <span className="text-[10px] font-bold uppercase tracking-[0.26em] text-white/45">
        {label}
      </span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="mt-2 w-full rounded-xl bg-navy-900 px-5 py-3.5 text-sm text-white outline-none transition placeholder:text-white/25 focus:bg-navy-800"
      />
    </label>
  );
}
