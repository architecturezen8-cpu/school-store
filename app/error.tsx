"use client";

import { useEffect } from "react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <section className="flex min-h-[80vh] flex-col items-center justify-center px-5 pt-32 text-center">
      <p className="text-[11px] font-bold uppercase tracking-[0.4em] text-gold">Something broke</p>
      <h1 className="mt-5 font-display text-4xl font-semibold">We could not load this page</h1>
      <p className="mt-3 max-w-md text-sm leading-relaxed text-white/60">
        The store hit an unexpected error. Trying again usually fixes it.
      </p>
      <button
        onClick={reset}
        className="mt-8 rounded-full bg-accent px-7 py-3.5 text-[11px] font-bold uppercase tracking-[0.24em] text-ink"
      >
        Try again
      </button>
    </section>
  );
}
