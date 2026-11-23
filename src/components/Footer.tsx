import { Mail, MapPin, Phone } from "lucide-react";
import CrestLogo from "./CrestLogo";
import Reveal from "./Reveal";

function FacebookIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M13.5 21v-7.2h2.42l.36-2.8H13.5V9.2c0-.81.22-1.36 1.39-1.36h1.48V5.36c-.26-.03-1.13-.11-2.15-.11-2.13 0-3.59 1.3-3.59 3.68V11H8.2v2.8h2.43V21h2.87Z" />
    </svg>
  );
}

function InstagramIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
      <rect x="3.5" y="3.5" width="17" height="17" rx="4.5" />
      <circle cx="12" cy="12" r="3.8" />
      <circle cx="17" cy="7" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}

function YoutubeIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M21.6 7.2a2.5 2.5 0 0 0-1.76-1.77C18.28 5 12 5 12 5s-6.28 0-7.84.43A2.5 2.5 0 0 0 2.4 7.2 26.2 26.2 0 0 0 2 12a26.2 26.2 0 0 0 .4 4.8 2.5 2.5 0 0 0 1.76 1.77C5.72 19 12 19 12 19s6.28 0 7.84-.43a2.5 2.5 0 0 0 1.76-1.77A26.2 26.2 0 0 0 22 12a26.2 26.2 0 0 0-.4-4.8ZM10 15.2V8.8l5.2 3.2-5.2 3.2Z" />
    </svg>
  );
}

const socials = [
  { label: "Facebook", icon: FacebookIcon },
  { label: "Instagram", icon: InstagramIcon },
  { label: "YouTube", icon: YoutubeIcon },
];

const explore = [
  { label: "Home", href: "#/" },
  { label: "Event Tickets", href: "#/tickets" },
  { label: "Track my order", href: "#track" },
];

const collections = [
  { label: "Badges", slug: "badges" },
  { label: "Uniforms", slug: "uniforms" },
  { label: "Event Clothings", slug: "event-clothings" },
  { label: "Exam Writing Papers", slug: "exam-writing-papers" },
  { label: "Batch Shirts", slug: "batch-shirts" },
];

export default function Footer() {
  return (
    <footer
      id="contact"
      className="relative border-t border-white/[0.08] bg-navy-950 pb-6 pt-14 md:pt-16"
    >
      <div className="pointer-events-none absolute left-1/2 top-0 h-[300px] w-[min(90vw,680px)] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(closest-side,rgba(22,36,74,0.45),transparent)]" />

      <div className="relative mx-auto max-w-[1400px] px-5 lg:px-10">
        {/* ---------- upper: brand · explore · collections ---------- */}
        <div className="grid gap-12 lg:grid-cols-[1.15fr_auto_auto] lg:gap-16 xl:gap-24">
          {/* brand */}
          <Reveal className="max-w-sm">
            <div className="flex items-center gap-4">
              <span className="grid h-14 w-14 shrink-0 place-items-center rounded-full bg-white shadow-[0_0_44px_rgba(255,255,255,0.18)]">
                <CrestLogo className="h-9 w-9 text-ink" />
              </span>
              <div>
                <p className="font-display text-xl font-semibold leading-tight tracking-tight">
                  St. Thomas’ College
                </p>
                <p className="mt-1.5 text-[10px] font-bold uppercase tracking-[0.28em] text-white/60">
                  The Official Store · Est. 1873
                </p>
              </div>
            </div>

            <p className="mt-6 text-sm leading-relaxed text-white/60">
              Every purchase carries the crest — and every rupee goes back into
              the college we love.
            </p>

            <div className="mt-7 flex items-center gap-3">
              {socials.map(({ label, icon: Icon }) => (
                <a
                  key={label}
                  href="#/"
                  aria-label={label}
                  className="grid h-10 w-10 place-items-center rounded-full border border-white/10 bg-navy-900 text-white/55 transition-all duration-300 hover:bg-white hover:text-ink"
                >
                  <Icon />
                </a>
              ))}
            </div>
          </Reveal>

          {/* explore */}
          <Reveal delay={100}>
            <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-white/65">
              Explore
            </p>
            <ul className="mt-5 space-y-3.5">
              {explore.map((l) => (
                <li key={l.label}>
                  <a
                    href={l.href}
                    className="group flex items-center gap-2 text-[13px] text-white/55 transition-colors hover:text-white"
                  >
                    <span className="h-px w-0 bg-white transition-all duration-300 group-hover:w-3.5" />
                    {l.label}
                  </a>
                </li>
              ))}
            </ul>
          </Reveal>

          {/* collections */}
          <Reveal delay={170}>
            <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-white/65">
              Collections
            </p>
            <ul className="mt-5 space-y-3.5">
              {collections.map((l) => (
                <li key={l.slug}>
                  <a
                    href={`#/shop/${l.slug}`}
                    className="group flex items-center gap-2 whitespace-nowrap text-[13px] text-white/55 transition-colors hover:text-white"
                  >
                    <span className="h-px w-0 bg-white transition-all duration-300 group-hover:w-3.5" />
                    {l.label}
                  </a>
                </li>
              ))}
            </ul>
          </Reveal>
        </div>

        {/* ---------- contact strip ---------- */}
        <Reveal delay={220}>
          <div className="mt-14 flex flex-col gap-4 border-t border-white/[0.08] pt-8 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
            <a
              href="tel:+94662221873"
              className="flex items-center gap-2.5 text-sm text-white/65 transition-colors hover:text-white"
            >
              <Phone size={15} className="text-white/60" />
              +94 66 222 1873
            </a>
            <a
              href="mailto:store@stcmatale.lk"
              className="flex items-center gap-2.5 text-sm text-white/65 transition-colors hover:text-white"
            >
              <Mail size={15} className="text-white/60" />
              store@stcmatale.lk
            </a>
            <span className="flex items-center gap-2.5 text-sm text-white/65">
              <MapPin size={15} className="text-white/60" />
              Matale, Central Province
            </span>
          </div>
        </Reveal>

        {/* ---------- bottom bar ---------- */}
        <div className="mt-8 flex flex-col gap-2 border-t border-white/[0.08] py-7 text-xs text-white/60 sm:flex-row sm:items-center sm:justify-between">
          <p>© {new Date().getFullYear()} St. Thomas’ College Matale</p>
          <p className="font-display text-[12px] tracking-[0.24em] text-white/60">
            ANIMO ET FIDE
          </p>
        </div>
      </div>
    </footer>
  );
}
