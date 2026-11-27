"use client";

import { useState } from "react";
import { ArrowRight, Clock, Users } from "lucide-react";
import { lkr } from "@/lib/format";
import type { CollegeEvent } from "@/data/seed";
import { dayNumber, fullDate, monthShort, weekdayShort } from "@/lib/dates";
import Countdown from "@/components/Countdown";
import TicketBooking from "@/components/TicketBooking";
import Link from "next/link";
import Reveal from "@/components/Reveal";
import { ticketsLeftLabel } from "@/lib/stock-core";

/* ---------------- event card ---------------- */
function EventCard({
  event,
  index,
  onBook,
}: {
  event: CollegeEvent;
  index: number;
  onBook: (e: CollegeEvent) => void;
}) {
  return (
    <Reveal delay={index * 90} className="h-full">
      <article className="group bento bento-lift relative flex h-full flex-col overflow-hidden">
        {/* image strip — the whole card is the link to the event page */}
        <div className="relative h-32 overflow-hidden">
          <img
            src={event.image}
            alt={event.title}
            className="h-full w-full object-cover transition-transform duration-[1200ms] ease-out group-hover:scale-[1.06]"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-navy-950 via-navy-950/35 to-transparent" />

          {/* date badge */}
          <div className="absolute bottom-3 left-5 flex items-end gap-1.5">
            <span className="font-display text-[2.1rem] font-semibold leading-none text-white drop-shadow-[0_2px_10px_rgba(0,0,0,0.6)]">
              {dayNumber(event.date)}
            </span>
            <div className="flex flex-col pb-1">
              <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-gold">
                {monthShort(event.date)}
              </span>
              <span className="text-[9px] font-semibold uppercase tracking-[0.14em] text-white/50">
                {weekdayShort(event.date)}
              </span>
            </div>
          </div>

          {event.tag && (
            <span className="absolute right-4 top-4 rounded-full bg-ink px-3 py-1.5 text-[9px] font-bold uppercase tracking-[0.14em] text-white/85">
              {event.tag}
            </span>
          )}
        </div>

        {/* body */}
        <div className="relative flex flex-1 flex-col p-6">
          {/* min-h keeps the money row on one baseline across the grid: a
              two-line title ("Inter-House Athletics Meet") otherwise pushes its
              BOOK button below the other three cards. */}
          {/* The title is the link, and its ::after covers the card, so a click
              anywhere on the card opens the event page while the Book button —
              which sits later in the DOM — stays on top of that hit area. */}
          <h3 className="min-h-[1.05em] font-display text-[1.35rem] font-semibold leading-tight tracking-tight md:min-h-[2.1em]">
            <Link
              href={`/events/${event.slug}`}
              className="text-white underline-offset-4 after:absolute after:inset-0 after:content-[''] hover:text-gold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold"
            >
              {event.title}
            </Link>
          </h3>
          <p className="mt-2 line-clamp-2 min-h-[2.6em] text-[13px] leading-relaxed text-white/65">
            {event.subtitle}
          </p>

          {/* meta */}
          <div className="mt-4 space-y-2 border-t border-white/[0.08] pt-4 text-[12px] text-white/65">
            <p className="flex items-center gap-2.5">
              <Clock size={13} className="shrink-0 text-white/50" />
              {event.doors}
            </p>
            <p className="flex items-center gap-2.5">
              <Users size={13} className="shrink-0 text-white/50" />
              {event.venue}, {event.city}
            </p>
          </div>

          {/* footer row */}
          <div className="mt-auto flex items-center justify-between gap-3 pt-6">
            <div>
              <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-white/50">
                From
              </p>
              <p className="mt-1 font-display text-[15px] font-semibold text-white">
                {lowestPrice(event) === 0 ? "Free" : lkr(lowestPrice(event))}
              </p>
            </div>
            <div className="relative flex items-center gap-1.5">
              {/* Books without leaving the page — the overlay is the shortcut. */}
              <button
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onBook(event);
                }}
                className="group/btn inline-flex items-center gap-2 rounded-full bg-white px-4 py-2.5 text-[10px] font-extrabold uppercase tracking-[0.18em] text-ink transition-all duration-300 hover:bg-gold"
              >
                Book
              </button>
            </div>
          </div>
        </div>
      </article>
    </Reveal>
  );
}

const lowestPrice = (e: CollegeEvent) =>
  e.tiers.reduce((min, t) => Math.min(min, t.price), Number.POSITIVE_INFINITY);

/* ---------------- spotlight ----------------
   One block per featured event. The admin decides how many there are, so the
   first one gets the full hero treatment and any others stack below it — the
   same design, in a slightly tighter frame so the page does not turn into a
   wall of identical panels. */
function Spotlight({
  event,
  lead,
  onBook,
}: {
  event: CollegeEvent;
  lead: boolean;
  onBook: (e: CollegeEvent) => void;
}) {
  return (
    <div className="grid overflow-hidden rounded-[2rem] bg-navy-950 ring-1 ring-white/10 lg:grid-cols-2">
      <div className={`relative min-h-[300px] ${lead ? "lg:min-h-[520px]" : "lg:min-h-[440px]"}`}>
        <img
          src={event.heroImage || event.image}
          alt={event.title}
          className="absolute inset-0 h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-ink/85 via-ink/25 to-transparent lg:bg-gradient-to-r lg:from-transparent lg:via-ink/20 lg:to-ink/70" />
        <span className="absolute left-6 top-6 rounded-lg bg-ink px-3.5 py-2 text-[10px] font-bold uppercase tracking-[0.16em] text-white">
          {lead ? event.tag || "Flagship event" : event.tag || "Also featured"}
        </span>
      </div>

      <div className={`flex flex-col justify-center px-7 ${lead ? "py-9 md:px-10 md:py-12" : "py-8 md:px-10 md:py-10"}`}>
        <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-white/65">
          {fullDate(event.date)}
        </p>
        <h2
          className={`mt-4 font-display font-semibold leading-tight tracking-tight ${
            lead ? "text-[2.1rem] md:text-[2.6rem]" : "text-[1.7rem] md:text-[2.1rem]"
          }`}
        >
          {event.title}
        </h2>
        {event.subtitle && (
          <p className="mt-3 text-[14px] text-gold">{event.subtitle}</p>
        )}
        <p className="mt-5 max-w-md text-sm leading-relaxed text-white/55">
          {event.description}
        </p>

        <div className="mt-7 flex flex-wrap items-center gap-x-6 gap-y-2 text-[13px] text-white/65">
          <span className="flex items-center gap-2">
            <Clock size={14} className="text-white/50" />
            {event.doors}
          </span>
          <span className="flex items-center gap-2">
            <Users size={14} className="text-white/50" />
            {event.venue}, {event.city}
          </span>
        </div>

        {/* Countdown draws its own "Gates open in" label — don't add a second. */}
        <div className="mt-8">
          <Countdown target={event.date} />
        </div>

        {event.tiers.length > 0 && (
          <div className="mt-8 flex flex-wrap gap-2">
            {event.tiers.map((t) => (
              <span
                key={t.id}
                className="rounded-full bg-navy-900 px-4 py-2 text-[11px] font-semibold text-white/65 transition-colors duration-300 hover:text-white"
              >
                {t.name} · <span className="text-white">{t.price === 0 ? "Free" : lkr(t.price)}</span>
                {ticketsLeftLabel(t) && (
                  <span className="ml-1.5 text-white/40">· {ticketsLeftLabel(t)}</span>
                )}
              </span>
            ))}
          </div>
        )}

        <div className="mt-8 flex flex-wrap items-center gap-3">
          <button
            onClick={() => onBook(event)}
            className="group inline-flex w-fit items-center gap-3 rounded-full bg-gold px-8 py-4 text-[11px] font-extrabold uppercase tracking-[0.24em] text-ink transition-all duration-500 hover:-translate-y-0.5 hover:shadow-[0_12px_50px_rgba(255,212,68,0.35)]"
          >
            Book tickets
            <ArrowRight size={14} className="transition-transform duration-300 group-hover:translate-x-1" />
          </button>
          <Link
            href={`/events/${event.slug}`}
            className="inline-flex items-center gap-2 rounded-full bg-white/10 px-6 py-4 text-[11px] font-extrabold uppercase tracking-[0.24em] text-white transition-colors hover:bg-white/20"
          >
            Event details
            <ArrowRight size={13} />
          </Link>
        </div>
      </div>
    </div>
  );
}

/* ---------------- page ---------------- */
export default function TicketsPage({ events }: { events: CollegeEvent[] }) {
  const [booking, setBooking] = useState<CollegeEvent | null>(null);
  const spotlight = events.filter((e) => e.featured);
  const featured = spotlight.length ? spotlight : events.slice(0, 1);
  const upcoming = events.filter((e) => !featured.some((f) => f.slug === e.slug));

  if (featured.length === 0) {
    return (
      <section className="flex min-h-[70vh] items-center justify-center px-5 pt-32 text-center">
        <p className="text-sm text-white/65">No events are on sale right now.</p>
      </section>
    );
  }

  return (
    <section className="relative pb-24 pt-32 md:pt-40">
      <div className="pointer-events-none absolute left-1/2 top-0 h-[420px] w-[min(90vw,760px)] -translate-x-1/2 -translate-y-1/3 rounded-full bg-[radial-gradient(closest-side,rgba(19,34,80,0.4),transparent)]" />

      <div className="relative mx-auto max-w-[1400px] px-5 lg:px-10">
        {/* ---------- header ---------- */}
        <Reveal>
          <div className="flex items-center gap-4">
            <span className="h-px w-10 bg-gold/60" />
            <span className="text-[11px] font-bold uppercase tracking-[0.4em] text-gold">
              Event Tickets
            </span>
          </div>
          <h1 className="mt-5 max-w-2xl font-display text-[2.2rem] font-semibold leading-[1.1] tracking-tight md:text-5xl">
            Be there when it matters.
          </h1>
          <p className="mt-4 max-w-xl text-sm leading-relaxed text-white/50 md:text-[15px]">
            The Big Match, Prize Day, the Ball — book your place at every college
            occasion. E-tickets are emailed instantly.
          </p>
        </Reveal>

        {/* ---------- featured spotlights ---------- */}
        {featured.map((e, i) => (
          <Reveal key={e.slug} delay={100 + i * 40}>
            <div className={i === 0 ? "mt-12" : "mt-6"}>
              <Spotlight event={e} lead={i === 0} onBook={setBooking} />
            </div>
          </Reveal>
        ))}

        {/* ---------- upcoming events ---------- */}
        <Reveal delay={140}>
          <div className="mt-20 flex items-center gap-4">
            <h2 className="font-display text-2xl font-semibold tracking-tight md:text-3xl">
              Upcoming events
            </h2>
            <span className="h-px flex-1 bg-white/10" />
            <span className="text-xs text-white/50">
              {upcoming.length} events
            </span>
          </div>
        </Reveal>

        <div className="mt-8 grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
          {upcoming.map((e, i) => (
            <EventCard key={e.slug} event={e} index={i} onBook={setBooking} />
          ))}
        </div>

        {/* ---------- quiet info row ---------- */}
        <Reveal delay={160}>
          <div className="mt-16 border-t border-white/10 pt-9">
            <ul className="grid gap-7 sm:grid-cols-3 sm:gap-6">
              {[
                {
                  icon: Clock,
                  title: "Emailed instantly",
                  desc: "Your e-ticket arrives the moment you book.",
                },
                {
                  icon: Users,
                  title: "Scan at the gate",
                  desc: "Show the booking reference — no printing needed.",
                },
                {
                  icon: ArrowRight,
                  title: "Student discount",
                  desc: "20% off with a valid school ID at collection.",
                },
              ].map((f) => (
                <li key={f.title} className="flex items-start gap-3.5">
                  <f.icon size={17} className="mt-0.5 shrink-0 text-white/65" />
                  <div>
                    <p className="text-[13.5px] font-semibold text-white">
                      {f.title}
                    </p>
                    <p className="mt-1.5 text-[12.5px] leading-relaxed text-white/65">
                      {f.desc}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </Reveal>
      </div>

      <TicketBooking event={booking} onClose={() => setBooking(null)} />
    </section>
  );
}
