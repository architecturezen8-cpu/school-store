"use client";

import { useEffect, useState } from "react";

/**
 * The countdown, in one place.
 *
 * It starts at `null` so the server and the first client render agree — reading
 * `Date.now()` during render is the classic hydration mismatch, and a countdown
 * is the single easiest place to trip it. The real value arrives after mount.
 *
 * `size` is the only variation the two callers need: the hero on /tickets shows
 * big cells, an event page's rail shows them smaller.
 */
export function useCountdown(target: Date) {
  const [left, setLeft] = useState<number | null>(null);

  useEffect(() => {
    const tick = () => setLeft(target.getTime() - Date.now());
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [target]);

  const clamped = left === null ? 0 : Math.max(0, left);
  const s = Math.floor(clamped / 1000);
  return {
    days: Math.floor(s / 86400),
    hours: Math.floor((s % 86400) / 3600),
    minutes: Math.floor((s % 3600) / 60),
    seconds: s % 60,
    /** True only after mount, so callers can avoid rendering a misleading 00:00:00. */
    ready: left !== null,
    past: left !== null && left <= 0,
  };
}

export default function Countdown({
  target,
  size = "lg",
  label = "Gates open in",
}: {
  target: Date;
  size?: "lg" | "sm";
  label?: string;
}) {
  const { days, hours, minutes, seconds, past } = useCountdown(target);

  const cells = [
    { v: days, l: "Days" },
    { v: hours, l: "Hrs" },
    { v: minutes, l: "Min" },
    { v: seconds, l: "Sec" },
  ];

  return (
    <div>
      <p
        className={
          size === "lg"
            ? "text-[10px] font-bold uppercase tracking-[0.28em] text-white/65"
            : "text-[9px] font-bold uppercase tracking-[0.22em] text-white/60"
        }
      >
        {past ? "Under way" : label}
      </p>
      <div className={`mt-3 flex ${size === "lg" ? "gap-2.5" : "gap-1.5"}`}>
        {cells.map((c) => (
          <div
            key={c.l}
            className={`min-w-0 rounded-xl bg-navy-950 text-center ${
              size === "lg" ? "min-w-[3.75rem] px-3 py-2.5" : "px-2 py-1.5"
            }`}
          >
            <p
              className={`font-display font-semibold leading-none tabular-nums ${
                size === "lg" ? "text-xl" : "text-sm"
              }`}
            >
              {String(c.v).padStart(2, "0")}
            </p>
            <p
              className={`font-bold uppercase tracking-[0.18em] text-white/65 ${
                size === "lg" ? "mt-1.5 text-[9px]" : "mt-1 text-[8px]"
              }`}
            >
              {c.l}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
