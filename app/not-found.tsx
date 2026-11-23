import Link from "next/link";
import { href } from "@/lib/links";

export default function NotFound() {
  return (
    <section className="flex min-h-[80vh] flex-col items-center justify-center px-5 pt-32 text-center">
      <p className="text-[11px] font-bold uppercase tracking-[0.4em] text-gold">404</p>
      <h1 className="mt-5 font-display text-4xl font-semibold">Page not found</h1>
      <p className="mt-3 max-w-md text-sm leading-relaxed text-white/60">
        That page has moved or never existed. Everything the store sells is one click away.
      </p>
      <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
        <Link
          href={href.shop}
          className="rounded-full bg-accent px-7 py-3.5 text-[11px] font-bold uppercase tracking-[0.24em] text-ink"
        >
          Browse the store
        </Link>
        <Link
          href={href.home}
          className="rounded-full border border-white/15 px-7 py-3.5 text-[11px] font-bold uppercase tracking-[0.24em] text-white/70"
        >
          Back home
        </Link>
      </div>
    </section>
  );
}
