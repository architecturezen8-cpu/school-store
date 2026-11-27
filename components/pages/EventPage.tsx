"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  CalendarDays,
  Check,
  Clock,
  Info,
  MapPin,
  Ticket as TicketIcon,
  Users,
} from "lucide-react";
import Countdown from "@/components/Countdown";
import TicketBooking from "@/components/TicketBooking";
import Reveal from "@/components/Reveal";
import { lkr } from "@/lib/format";
import { dayNumber, fullDate, monthShort, weekdayShort } from "@/lib/dates";
import { seatsLeft, ticketsLeftLabel } from "@/lib/stock-core";
import type { CollegeEvent } from "@/data/seed";

/**
 * One event, as a page.
 *
 * The shape is deliberate: the hero carries the date and the price so a visitor
 * knows in two seconds whether this is their evening; the rail beside it holds the
 * countdown and the one button that matters. Everything below is the material an
 * admin wrote — the story, the rules, the photographs, the links — laid out in
 * that order, because that is the order someone reads when deciding.
 *
 * Every section disappears when it has nothing in it. An event with just a title
 * and a date should look spare rather than broken.
 */

const lowest = (e: CollegeEvent) =>
  e.tiers.reduce((min, t) => Math.min(min, t.price), Number.POSITIVE_INFINITY);

/* A numbered section heading. Module scope on purpose — a component defined
   inside the render is a new type every render and React remounts the subtree. */
function SectionHead({ number, label }: { number?: string; label: string }) {
  return (
    <div className="flex scroll-mt-28 items-center gap-4">
      <h2 className="font-display text-[1.6rem] font-semibold tracking-tight text-white md:text-[2rem]">
        {number && <span className="mr-3 text-white/35">{number}</span>}
        {label}
      </h2>
      <span className="h-px flex-1 bg-white/10" />
    </div>
  );
}


export default function EventPage({
  event,
  others,
}: {
  event: CollegeEvent;
  others: CollegeEvent[];
}) {
  const [booking, setBooking] = useState(false);

  const price = lowest(event);
  const soldOut = event.tiers.length === 0;
  const story = (event.story ?? "").split(/\n{2,}/).filter((p) => p.trim());
  const rules = event.rules ?? [];
  const gallery = event.gallery ?? [];
  const links = event.links ?? [];
  const hero = event.heroImage || event.image;

  /* Sections are numbered on screen ("01 · The day") only when there is more than
     one of them; a single section with "01" in front of it looks like a mistake. */
  const sections = [
    story.length ? "story" : "",
    event.tiers.length ? "tickets" : "",
    rules.length ? "rules" : "",
    gallery.length ? "gallery" : "",
    links.length ? "links" : "",
    others.length ? "more" : "",
  ].filter(Boolean);
  const numbered = sections.length > 1;
  const index = (id: string) => String(sections.indexOf(id) + 1).padStart(2, "0");


  return (
    <article className="pb-24">
      {/* ---------------- hero ---------------- */}
      <header className="relative min-h-[86vh] overflow-hidden">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={hero}
          alt=""
          aria-hidden="true"
          className="absolute inset-0 h-full w-full object-cover"
        />
        {/* Two washes: one so the words are legible, one so the photograph keeps
            its own colour at the top of the frame. */}
        <div className="absolute inset-0 bg-gradient-to-t from-ink via-ink/70 to-ink/25" />
        <div className="absolute inset-0 bg-[radial-gradient(120%_80%_at_50%_0%,transparent,rgba(4,6,13,0.55))]" />

        <div className="relative mx-auto flex min-h-[86vh] max-w-[1400px] flex-col justify-end px-5 pb-14 pt-32 lg:px-10 lg:pb-20">
          <Link
            href="/tickets"
            className="mb-auto inline-flex w-fit items-center gap-2 text-[11px] font-bold uppercase tracking-[0.2em] text-white/65 transition-colors hover:text-white"
          >
            <ArrowLeft size={13} /> All events
          </Link>

          <div className="grid items-end gap-10 lg:grid-cols-[minmax(0,1fr)_auto]">
            <div className="min-w-0">
              {event.tag && (
                <span className="inline-flex items-center gap-2 rounded-full bg-gold px-3.5 py-1.5 text-[9px] font-extrabold uppercase tracking-[0.18em] text-ink">
                  {event.tag}
                </span>
              )}
              {event.heroKicker && (
                <p className="mt-5 text-[11px] font-bold uppercase tracking-[0.34em] text-gold">
                  {event.heroKicker}
                </p>
              )}

              {/* Date block + title, so the day is as loud as the name. */}
              <div className="mt-4 flex items-start gap-6">
                <div className="hidden shrink-0 flex-col items-center rounded-2xl bg-white/[0.07] px-4 py-3 backdrop-blur-sm sm:flex">
                  <span className="font-display text-[2.4rem] font-semibold leading-none text-white">
                    {dayNumber(event.date)}
                  </span>
                  <span className="mt-1 text-[10px] font-bold uppercase tracking-[0.18em] text-gold">
                    {monthShort(event.date)}
                  </span>
                  <span className="text-[9px] font-semibold uppercase tracking-[0.14em] text-white/55">
                    {weekdayShort(event.date)}
                  </span>
                </div>

                <div className="min-w-0">
                  <h1 className="font-display text-[2.4rem] font-semibold leading-[1.03] tracking-tight text-white sm:text-[3.2rem] lg:text-[4.1rem]">
                    {event.title}
                  </h1>
                  {event.subtitle && (
                    <p className="mt-4 max-w-xl text-[15px] leading-relaxed text-white/70">
                      {event.subtitle}
                    </p>
                  )}
                </div>
              </div>

              <ul className="mt-8 flex flex-wrap items-center gap-x-7 gap-y-2.5 text-[13px] text-white/70">
                <li className="flex items-center gap-2">
                  <CalendarDays size={14} className="text-gold" />
                  {fullDate(event.date)}
                </li>
                {event.doors && (
                  <li className="flex items-center gap-2">
                    <Clock size={14} className="text-gold" />
                    {event.doors}
                  </li>
                )}
                {(event.venue || event.city) && (
                  <li className="flex items-center gap-2">
                    <MapPin size={14} className="text-gold" />
                    {[event.venue, event.city].filter(Boolean).join(", ")}
                  </li>
                )}
              </ul>
            </div>

            {/* ---------------- the rail ---------------- */}
            <div className="w-full rounded-[1.6rem] bg-ink/75 p-6 backdrop-blur-md lg:w-[340px] lg:shrink-0">
              <Countdown target={event.date} />

              <div className="mt-6 flex items-end justify-between gap-3 border-t border-white/10 pt-5">
                <div>
                  <p className="text-[9px] font-bold uppercase tracking-[0.22em] text-white/55">
                    {event.tiers.length > 1 ? "From" : "Tickets"}
                  </p>
                  <p className="mt-1 font-display text-2xl font-semibold text-white">
                    {event.tiers.length === 0
                      ? "—"
                      : price === 0
                        ? "Free"
                        : lkr(price)}
                  </p>
                </div>
                {event.tiers.length > 0 && (
                  <p className="text-[11px] text-white/55">
                    {event.tiers.length} {event.tiers.length === 1 ? "type" : "types"}
                  </p>
                )}
              </div>

              <button
                onClick={() => setBooking(true)}
                disabled={soldOut}
                className="group mt-5 inline-flex w-full items-center justify-center gap-2.5 rounded-full bg-gold px-6 py-3.5 text-[11px] font-extrabold uppercase tracking-[0.2em] text-ink transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_12px_40px_rgba(255,212,68,0.32)] disabled:cursor-not-allowed disabled:bg-white/15 disabled:text-white/50 disabled:hover:translate-y-0 disabled:hover:shadow-none"
              >
                {soldOut ? "Not on sale" : "Book tickets"}
                {!soldOut && (
                  <ArrowRight
                    size={13}
                    className="transition-transform duration-300 group-hover:translate-x-1"
                  />
                )}
              </button>

              <p className="mt-3 flex items-start gap-2 text-[11px] leading-relaxed text-white/50">
                <Info size={12} className="mt-0.5 shrink-0" />
                One QR per seat, each scanned once at the gate. Emailed instantly.
              </p>
            </div>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-[1400px] px-5 lg:px-10">
        {/* ---------------- the story ---------------- */}
        {story.length > 0 && (
          <Reveal>
            <section className="mt-20 scroll-mt-24" aria-labelledby="story-head">
              <div id="story-head">
                <SectionHead number={numbered ? index("story") : undefined} label="The day" />
              </div>
              <div className="mt-8 grid gap-10 lg:grid-cols-[minmax(0,1fr)_320px]">
                <div className="space-y-5">
                  {/* The first paragraph is set larger: it is the lede, and an
                      admin's opening line is usually the one worth reading. */}
                  {story.map((p, i) => (
                    <p
                      key={i}
                      className={
                        i === 0
                          ? "max-w-2xl text-[16px] leading-[1.75] text-white/80 md:text-[17px]"
                          : "max-w-2xl text-[14.5px] leading-[1.8] text-white/60"
                      }
                    >
                      {p}
                    </p>
                  ))}
                </div>

                {(event.description || event.tagline) && (
                  <aside className="h-fit rounded-2xl bg-navy-950 p-6 lg:sticky lg:top-28">
                    <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-gold">
                      In short
                    </p>
                    <p className="mt-3 text-[13.5px] leading-relaxed text-white/70">
                      {event.tagline || event.description}
                    </p>
                    <ul className="mt-5 space-y-2.5 border-t border-white/10 pt-5 text-[12.5px] text-white/60">
                      <li className="flex items-start gap-2.5">
                        <CalendarDays size={13} className="mt-0.5 shrink-0 text-white/40" />
                        {fullDate(event.date)}
                      </li>
                      {event.venue && (
                        <li className="flex items-start gap-2.5">
                          <MapPin size={13} className="mt-0.5 shrink-0 text-white/40" />
                          {[event.venue, event.city].filter(Boolean).join(", ")}
                        </li>
                      )}
                      {event.doors && (
                        <li className="flex items-start gap-2.5">
                          <Clock size={13} className="mt-0.5 shrink-0 text-white/40" />
                          {event.doors}
                        </li>
                      )}
                      <li className="flex items-start gap-2.5">
                        <Users size={13} className="mt-0.5 shrink-0 text-white/40" />
                        {event.tiers.length || "No"} ticket{" "}
                        {event.tiers.length === 1 ? "type" : "types"}
                      </li>
                    </ul>
                  </aside>
                )}
              </div>
            </section>
          </Reveal>
        )}

        {/* ---------------- tickets ---------------- */}
        {event.tiers.length > 0 && (
          <Reveal delay={60}>
            <section className="mt-20 scroll-mt-24" aria-labelledby="tickets-head">
              <div id="tickets-head">
                <SectionHead number={numbered ? index("tickets") : undefined} label="Tickets" />
              </div>
              <ul className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {event.tiers.map((t) => {
                  const left = seatsLeft(t);
                  const gone = left !== null && left <= 0;
                  return (
                  <li key={t.id} className="bento flex flex-col p-6">
                    <div className="flex items-start justify-between gap-3">
                      <h3 className="font-display text-lg font-semibold text-white">{t.name}</h3>
                      <p className="shrink-0 font-display text-lg text-gold">
                        {t.price === 0 ? "Free" : lkr(t.price)}
                      </p>
                    </div>
                    {left !== null && (
                      <p
                        className={`mt-2 text-[10px] font-bold uppercase tracking-[0.16em] ${
                          gone ? "text-red-300" : left <= 5 ? "text-gold" : "text-white/40"
                        }`}
                      >
                        {gone ? "Sold out" : ticketsLeftLabel(t)}
                      </p>
                    )}
                    {(t.perks ?? []).length > 0 && (
                      <ul className="mt-4 space-y-2">
                        {(t.perks ?? []).map((p, i) => (
                          <li key={i} className="flex items-start gap-2 text-[12.5px] text-white/60">
                            <Check size={13} className="mt-0.5 shrink-0 text-gold/80" />
                            {p}
                          </li>
                        ))}
                      </ul>
                    )}
                    {t.note && (
                      <p className="mt-4 text-[11.5px] leading-relaxed text-white/45">{t.note}</p>
                    )}
                    <button
                      onClick={() => setBooking(true)}
                      disabled={gone}
                      className="mt-5 inline-flex w-fit items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-[10px] font-extrabold uppercase tracking-[0.18em] text-white transition-colors hover:bg-gold hover:text-ink disabled:cursor-not-allowed disabled:bg-white/5 disabled:text-white/35 disabled:hover:bg-white/5 disabled:hover:text-white/35"
                    >
                      <TicketIcon size={12} /> {gone ? "Sold out" : "Choose"}
                    </button>
                  </li>
                  );
                })}
              </ul>
            </section>
          </Reveal>
        )}

        {/* ---------------- rules ---------------- */}
        {rules.length > 0 && (
          <Reveal delay={60}>
            <section className="mt-20 scroll-mt-24" aria-labelledby="rules-head">
              <div id="rules-head">
                <SectionHead number={numbered ? index("rules") : undefined} label="Rules & entry" />
              </div>
              <ol className="mt-8 grid gap-4 md:grid-cols-2">
                {rules.map((r, i) => (
                  <li key={i} className="flex gap-4 rounded-2xl bg-navy-950 p-5">
                    <span className="font-display text-xl leading-none text-gold/70">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <div className="min-w-0">
                      {r.title && (
                        <h3 className="text-[14px] font-semibold text-white">{r.title}</h3>
                      )}
                      {r.body && (
                        <p className="mt-1.5 text-[13px] leading-relaxed text-white/60">{r.body}</p>
                      )}
                    </div>
                  </li>
                ))}
              </ol>
            </section>
          </Reveal>
        )}

        {/* ---------------- gallery ---------------- */}
        {gallery.length > 0 && (
          <Reveal delay={60}>
            <section className="mt-20 scroll-mt-24" aria-labelledby="gallery-head">
              <div id="gallery-head">
                <SectionHead number={numbered ? index("gallery") : undefined} label="From last year" />
              </div>
              {/* One wide frame, then a row of equal ones. A row-span on the
                  first cell would leave a hole whenever the count is not a
                  multiple of the columns. */}
              <div className="mt-8 space-y-4">
                <figure className="relative h-[300px] overflow-hidden rounded-2xl bg-navy-950 md:h-[420px]">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={gallery[0].url}
                    alt=""
                    className="h-full w-full object-cover"
                  />
                  {gallery[0].caption && (
                    <figcaption className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-ink/90 to-transparent px-6 pb-4 pt-12 text-[13px] text-white/90">
                      {gallery[0].caption}
                    </figcaption>
                  )}
                </figure>

                {gallery.length > 1 && (
                  <ul className="grid grid-cols-2 gap-4 md:grid-cols-3">
                    {gallery.slice(1).map((g, i) => (
                      <li
                        key={`${g.url}-${i}`}
                        className="group relative h-[190px] overflow-hidden rounded-2xl bg-navy-950"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={g.url}
                          alt=""
                          className="h-full w-full object-cover transition-transform duration-[1400ms] ease-out group-hover:scale-[1.05]"
                        />
                        {g.caption && (
                          <p className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-ink/90 to-transparent px-4 pb-3 pt-8 text-[12px] text-white/85">
                            {g.caption}
                          </p>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </section>
          </Reveal>
        )}

        {/* ---------------- links ---------------- */}
        {links.length > 0 && (
          <Reveal delay={60}>
            <section className="mt-20 scroll-mt-24" aria-labelledby="links-head">
              <div id="links-head">
                <SectionHead number={numbered ? index("links") : undefined} label="More about this event" />
              </div>
              <ul className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {links.map((l, i) => {
                  const external = /^https?:/i.test(l.url);
                  const Wrapper = external ? "a" : Link;
                  return (
                    <li key={`${l.url}-${i}`}>
                      <Wrapper
                        {...(external
                          ? { href: l.url, target: "_blank", rel: "noreferrer" }
                          : { href: l.url })}
                        className="group flex items-center justify-between gap-3 rounded-2xl bg-navy-950 px-5 py-4 transition-colors hover:bg-navy-900"
                      >
                        <span className="text-[13.5px] font-medium text-white">{l.label}</span>
                        <ArrowUpRight
                          size={15}
                          className="shrink-0 text-white/40 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-gold"
                        />
                      </Wrapper>
                    </li>
                  );
                })}
              </ul>
            </section>
          </Reveal>
        )}

        {/* ---------------- onwards ---------------- */}
        {others.length > 0 && (
          <Reveal delay={60}>
            <section className="mt-20 scroll-mt-24 border-t border-white/10 pt-12" aria-labelledby="more-head">
              <div className="flex items-center justify-between gap-4">
                <h2
                  id="more-head"
                  className="font-display text-[1.4rem] font-semibold tracking-tight md:text-[1.7rem]"
                >
                  Also coming up
                </h2>
                <Link
                  href="/tickets"
                  className="inline-flex items-center gap-1.5 text-[12px] text-white/55 transition-colors hover:text-white"
                >
                  All events <ArrowRight size={12} />
                </Link>
              </div>

              <ul className="mt-6 grid gap-4 sm:grid-cols-3">
                {others.map((e) => (
                  <li key={e.slug}>
                    <Link
                      href={`/events/${e.slug}`}
                      className="group block overflow-hidden rounded-2xl bg-navy-950"
                    >
                      <span className="relative block h-32 overflow-hidden">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={e.image}
                          alt=""
                          aria-hidden="true"
                          className="h-full w-full object-cover transition-transform duration-[1200ms] group-hover:scale-[1.06]"
                        />
                        <span className="absolute inset-0 bg-gradient-to-t from-navy-950 to-transparent" />
                      </span>
                      <span className="block p-5">
                        <span className="block text-[10px] font-bold uppercase tracking-[0.18em] text-gold">
                          {dayNumber(e.date)} {monthShort(e.date)}
                        </span>
                        <span className="mt-1.5 block font-display text-[15px] font-semibold text-white">
                          {e.title}
                        </span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          </Reveal>
        )}
      </div>

      <TicketBooking
        event={booking ? event : null}
        onClose={() => setBooking(false)}
      />
    </article>
  );
}
