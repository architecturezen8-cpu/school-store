import { ArrowUp, Mail, MapPin, Phone } from "lucide-react";
import CrestLogo from "@/components/CrestLogo";
import Reveal from "@/components/Reveal";

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
  { label: "Facebook", icon: FacebookIcon, href: "#/" },
  { label: "Instagram", icon: InstagramIcon, href: "#/" },
  { label: "YouTube", icon: YoutubeIcon, href: "#/" },
];

const explore = [
  { label: "Home", href: "#/" },
  { label: "The Shop", href: "#/shop" },
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

const contact = [
  { icon: Phone, label: "+94 66 222 1873", href: "tel:+94662221873" },
  { icon: Mail, label: "store@stcmatale.lk", href: "mailto:store@stcmatale.lk" },
  { icon: MapPin, label: "Matale, Central Province", href: null },
];

/** Small uppercase column title with a gold rule, so the three columns share one baseline. */
function ColumnTitle({ children }: { children: string }) {
  return (
    <p className="flex items-center gap-2.5 text-[10px] font-bold uppercase tracking-[0.3em] text-white/60">
      <span className="h-px w-5 bg-gold/70" aria-hidden />
      {children}
    </p>
  );
}

export default function Footer() {
  return (
    <footer
      id="contact"
      className="relative overflow-hidden border-t border-white/[0.08] bg-navy-950"
    >
      {/* soft crest glow behind the brand column */}
      <div className="pointer-events-none absolute -left-24 top-0 h-[340px] w-[340px] rounded-full bg-[radial-gradient(closest-side,rgba(22,36,74,0.55),transparent)]" />

      <div className="relative mx-auto max-w-[1400px] px-5 pb-8 pt-14 md:pt-16 lg:px-10">
        {/* ---------- three columns on one 12-col grid ---------- */}
        <div className="grid grid-cols-1 gap-12 sm:grid-cols-2 lg:grid-cols-12 lg:gap-10">
          {/* 1 — brand */}
          <Reveal className="sm:col-span-2 lg:col-span-5 lg:pr-10">
            <div className="flex items-center gap-4">
              <span className="grid h-14 w-14 shrink-0 place-items-center rounded-full bg-white shadow-[0_0_44px_rgba(255,255,255,0.18)]">
                <CrestLogo className="h-9 w-9 text-ink" />
              </span>
              <div className="min-w-0">
                <p className="font-display text-xl font-semibold leading-tight tracking-tight">
                  St. Thomas’ College
                </p>
                <p className="mt-1.5 text-[10px] font-bold uppercase leading-4 tracking-[0.24em] text-white/60">
                  The Official Store · Est. 1873
                </p>
              </div>
            </div>

            <p className="mt-6 max-w-sm text-sm leading-relaxed text-white/60">
              Every purchase carries the crest — and every rupee goes back into
              the college we love.
            </p>

            <div className="mt-7 flex items-center gap-3">
              {socials.map(({ label, icon: Icon, href }) => (
                <a
                  key={label}
                  href={href}
                  aria-label={label}
                  className="grid h-10 w-10 place-items-center rounded-full border border-white/10 bg-navy-900 text-white/60 transition-all duration-300 hover:-translate-y-0.5 hover:bg-white hover:text-ink"
                >
                  <Icon />
                </a>
              ))}
            </div>
          </Reveal>

          {/* 2 — explore */}
          <div className="lg:col-span-3">
            <Reveal delay={100}>
              <ColumnTitle>Explore</ColumnTitle>
            </Reveal>
            <Reveal delay={100}>
              <ul className="mt-5 space-y-3">
                {explore.map((l) => (
                  <li key={l.label}>
                    <a
                      href={l.href}
                      className="group inline-flex items-center gap-2 text-[13px] leading-5 text-white/60 transition-colors hover:text-white"
                    >
                      <span className="h-px w-0 bg-gold transition-all duration-300 group-hover:w-3.5" />
                      {l.label}
                    </a>
                  </li>
                ))}
              </ul>
            </Reveal>
          </div>

          {/* 3 — collections */}
          <div className="lg:col-span-4">
            <Reveal delay={170}>
              <ColumnTitle>Collections</ColumnTitle>
            </Reveal>
            <Reveal delay={170}>
              <ul className="mt-5 space-y-3">
                {collections.map((l) => (
                  <li key={l.slug}>
                    <a
                      href={`#/shop/${l.slug}`}
                      className="group inline-flex items-center gap-2 text-[13px] leading-5 text-white/60 transition-colors hover:text-white"
                    >
                      <span className="h-px w-0 bg-gold transition-all duration-300 group-hover:w-3.5" />
                      {l.label}
                    </a>
                  </li>
                ))}
              </ul>
            </Reveal>
          </div>
        </div>

        {/* ---------- contact row, aligned to the same 12-col grid ---------- */}
        <div className="mt-14 border-t border-white/[0.08] pt-8">
          <div className="grid grid-cols-1 gap-x-10 gap-y-5 sm:grid-cols-3">
            {contact.map(({ icon: Icon, label, href }) => {
              const inner = (
                <>
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-white/10 bg-navy-900 text-white/60 transition-colors group-hover:border-gold/40 group-hover:text-gold">
                    <Icon size={14} />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-[9px] font-bold uppercase tracking-[0.24em] text-white/50">
                      {href?.startsWith("tel:")
                        ? "Call the store"
                        : href?.startsWith("mailto:")
                          ? "Email us"
                          : "Visit"}
                    </span>
                    <span className="mt-1 block truncate text-[13px] leading-5 text-white/75 transition-colors group-hover:text-white">
                      {label}
                    </span>
                  </span>
                </>
              );

              return href ? (
                <a key={label} href={href} className="group flex items-center gap-3">
                  {inner}
                </a>
              ) : (
                <div key={label} className="group flex items-center gap-3">
                  {inner}
                </div>
              );
            })}
          </div>
        </div>

        {/* ---------- bottom bar ---------- */}
        <div className="mt-10 flex flex-col items-center gap-4 border-t border-white/[0.08] pt-7 sm:flex-row sm:justify-between">
          <p className="order-2 text-[11px] tracking-wide text-white/50 sm:order-1">
            © {new Date().getFullYear()} St. Thomas’ College Matale · All rights reserved
          </p>

          <a
            href="#/"
            className="group order-1 inline-flex items-center gap-2 rounded-full border border-white/10 px-4 py-2 text-[10px] font-bold uppercase tracking-[0.2em] text-white/60 transition-colors hover:border-white/25 hover:text-white sm:order-2"
          >
            Back to top
            <ArrowUp
              size={12}
              className="transition-transform duration-300 group-hover:-translate-y-0.5"
            />
          </a>
        </div>
      </div>
    </footer>
  );
}
