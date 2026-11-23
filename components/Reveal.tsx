"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

type RevealProps = {
  children: ReactNode;
  delay?: number;
  y?: number;
  className?: string;
};

/**
 * Scroll-reveal wrapper.
 *
 * NOTE: we deliberately never keep a transform / will-change on the
 * element after it has animated in. A lingering `transform` or
 * `will-change: transform` would turn this wrapper into a containing
 * block + stacking context, which silently breaks `position: fixed`
 * modals and z-index layering for anything rendered inside it.
 */
export default function Reveal({
  children,
  delay = 0,
  y = 28,
  className = "",
}: RevealProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    // No IntersectionObserver (very old browser, or a crawler/preview that
    // strips it): show the content immediately instead of leaving it at
    // opacity 0 forever — a blank page is far worse than a missing animation.
    const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
    if (typeof IntersectionObserver === "undefined" || reduced) {
      setVisible(true);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.12, rootMargin: "0px 0px -40px 0px" }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={className}
      style={
        visible
          ? { opacity: 1, transform: "none" }
          : {
              opacity: 0,
              transform: `translateY(${y}px)`,
              transition: `opacity 0.9s cubic-bezier(0.22,1,0.36,1) ${delay}ms, transform 0.9s cubic-bezier(0.22,1,0.36,1) ${delay}ms`,
            }
      }
    >
      {children}
    </div>
  );
}
