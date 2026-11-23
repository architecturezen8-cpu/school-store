"use client";

import { useEffect, useState } from "react";
import { ChevronDown, Search, ShoppingBag } from "lucide-react";
import CrestLogo from "@/components/CrestLogo";
import { useCart } from "@/components/context/CartContext";
import { href, ILink, withBase } from "@/lib/nav";

type NavChild = { label: string; href: string; note: string };
type NavLink = {
  label: string;
  href?: string;
  children?: NavChild[];
  action?: "track";
};

const navLinks: NavLink[] = [
  { label: "Home", href: href.home },
  {
    label: "Shop",
    href: href.shop,
    children: [
      { label: "Merchandise", href: href.shop, note: "Browse everything the store sells" },
      { label: "Event Tickets", href: href.tickets, note: "Big Match, Prize Day & the Ball" },
    ],
  },
  { label: "Contact", href: "#contact" },
  { label: "Track my order", action: "track" },
];

/** Horizontal crest + wordmark lockup (mobile & tablet) */
function BrandLockup() {
  // No aria-label: the visible wordmark ("St.Thomas' College") *is* the
  // accessible name. Labelling it "Home" would hide the college name from
  // screen readers and fail label-in-name.
  return (
    <a href={withBase(href.home)} className="flex items-center gap-3">
      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-white shadow-[0_8px_26px_rgba(0,0,0,0.45)]">
        <CrestLogo className="h-7 w-7 text-ink" decorative />
      </span>
      <span className="flex flex-col leading-none">
        <span className="font-display text-[15px] font-semibold tracking-tight text-white">
          St.Thomas&apos; College
        </span>
        <span className="mt-1.5 text-[8.5px] font-bold uppercase tracking-[0.3em] text-white/60">
          Matale. Est.1873.
        </span>
      </span>
    </a>
  );
}

/** Hamburger that morphs into an X */
function MenuToggle({
  open,
  onClick,
}: {
  open: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      aria-label={open ? "Close menu" : "Open menu"}
      aria-expanded={open}
      className="relative grid h-10 w-10 place-items-center rounded-full transition-colors duration-300 hover:bg-navy-800"
    >
      <span className="relative block h-3.5 w-[18px]">
        <span
          className={`absolute left-0 top-0 block h-[1.5px] w-full rounded-full bg-white transition-all duration-400 ease-[cubic-bezier(0.22,1,0.36,1)] ${
            open ? "top-1/2 -translate-y-1/2 rotate-45" : ""
          }`}
        />
        <span
          className={`absolute bottom-0 left-0 block h-[1.5px] w-full rounded-full bg-white transition-all duration-400 ease-[cubic-bezier(0.22,1,0.36,1)] ${
            open ? "bottom-1/2 translate-y-1/2 -rotate-45" : ""
          }`}
        />
      </span>
    </button>
  );
}

export default function Navbar({
  onSearch,
  onTrack,
  active,
}: {
  onSearch: () => void;
  onTrack: () => void;
  active?: string;
}) {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [shopExpanded, setShopExpanded] = useState(false);
  const { count, setOpen } = useCart();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <>
      {/* dim the page while the bar is expanded */}
      <div
        onClick={() => setMenuOpen(false)}
        className={`fixed inset-0 z-40 bg-black/60 transition-opacity duration-500 lg:hidden ${
          menuOpen ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
        aria-hidden={!menuOpen}
      />

      <header
        className={`fixed inset-x-0 top-0 z-50 overflow-visible transition-colors duration-500 lg:hidden ${
          menuOpen || scrolled ? "bg-ink" : "bg-transparent"
        }`}
      >
        <div
          className={`absolute inset-x-0 bottom-0 h-px bg-white/10 transition-opacity duration-500 ${
            menuOpen || scrolled ? "opacity-100" : "opacity-0"
          } ${menuOpen ? "opacity-0" : ""}`}
        />

        <div className="mx-auto max-w-[1440px] px-5">
          {/* ---------- top row ---------- */}
          <div
            className={`flex items-center justify-between transition-all duration-500 ${
              menuOpen ? "py-4" : scrolled ? "py-3" : "py-5"
            }`}
          >
            <BrandLockup />

            <div className="flex items-center gap-2">
              {/* search collapses away while the drawer is open */}
              <button
                onClick={onSearch}
                aria-label="Search the store"
                className={`grid h-10 place-items-center overflow-hidden rounded-full text-white/65 transition-all duration-400 ease-out hover:bg-navy-800 hover:text-white ${
                  menuOpen ? "w-0 scale-50 opacity-0" : "w-10 scale-100 opacity-100"
                }`}
              >
                <Search size={17} />
              </button>
              <MenuToggle
                open={menuOpen}
                onClick={() => setMenuOpen((v) => !v)}
              />
            </div>
          </div>

          {/* ---------- expanding drawer ---------- */}
          <div
            className={`grid transition-[grid-template-rows,opacity] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] ${
              menuOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
            }`}
          >
            <div className="overflow-hidden">
              <nav
                className="flex min-h-[calc(100svh-5.25rem)] flex-col overflow-y-auto pb-8 pt-6"
                aria-label="Mobile"
              >
                <ul>
                  {navLinks.map((link, i) => (
                    <li
                      key={link.label}
                      className={`border-b border-white/5 transition-all duration-500 last:border-b-0 ${
                        menuOpen ? "translate-y-0 opacity-100" : "translate-y-3 opacity-0"
                      }`}
                      style={{ transitionDelay: menuOpen ? `${120 + i * 55}ms` : "0ms" }}
                    >
                      {link.children ? (
                        <div>
                          <button
                            onClick={() => setShopExpanded((v) => !v)}
                            className="flex w-full items-center justify-between py-3.5 text-left"
                          >
                            <span className="font-display text-[18px] font-medium text-white/90">
                              {link.label}
                            </span>
                            <ChevronDown
                              size={15}
                              className={`text-white/60 transition-transform duration-300 ${
                                shopExpanded ? "rotate-180" : ""
                              }`}
                            />
                          </button>
                          <div
                            className={`grid transition-[grid-template-rows,opacity] duration-400 ease-out ${
                              shopExpanded
                                ? "grid-rows-[1fr] opacity-100"
                                : "grid-rows-[0fr] opacity-0"
                            }`}
                          >
                            <div className="overflow-hidden">
                              <div className="pb-2">
                                {link.children.map((c) => (
                                  <ILink
                                    key={c.label}
                                    href={c.href}
                                    onClick={() => setMenuOpen(false)}
                                    className="flex items-center gap-3 py-2 pl-1 text-white/55 transition-colors hover:text-white"
                                  >
                                    <span className="h-1 w-1 rounded-full bg-white/30" />
                                    <span className="text-[13.5px] tracking-wide">
                                      {c.label}
                                    </span>
                                  </ILink>
                                ))}
                              </div>
                            </div>
                          </div>
                        </div>
                      ) : link.action === "track" ? (
                        <button
                          onClick={() => {
                            setMenuOpen(false);
                            onTrack();
                          }}
                          className="flex w-full items-center justify-between py-3.5 text-left font-display text-[18px] font-medium text-white/90 transition-colors hover:text-white"
                        >
                          {link.label}
                        </button>
                      ) : (
                        <ILink
                          href={link.href ?? "#"}
                          onClick={() => setMenuOpen(false)}
                          className={`flex items-center justify-between py-3.5 font-display text-[18px] font-medium transition-colors ${
                            active === "home" && link.label === "Home"
                              ? "text-gold"
                              : "text-white/90 hover:text-white"
                          }`}
                        >
                          {link.label}
                        </ILink>
                      )}
                    </li>
                  ))}

                  {/* My Account */}
                  <li
                    className={`transition-all duration-500 ${
                      menuOpen ? "translate-y-0 opacity-100" : "translate-y-3 opacity-0"
                    }`}
                    style={{
                      transitionDelay: menuOpen ? `${120 + navLinks.length * 55}ms` : "0ms",
                    }}
                  >
                    <a
                      href="#contact"
                      onClick={() => setMenuOpen(false)}
                      className="flex items-center justify-between py-3.5 font-display text-[18px] font-medium text-white/90 transition-colors hover:text-white"
                    >
                      My Account
                    </a>
                  </li>
                </ul>

                {/* bag — pinned to the bottom of the expanded drawer */}
                <div
                  className={`mt-auto pt-6 transition-all duration-500 ${
                    menuOpen ? "translate-y-0 opacity-100" : "translate-y-3 opacity-0"
                  }`}
                  style={{
                    transitionDelay: menuOpen ? `${180 + navLinks.length * 55}ms` : "0ms",
                  }}
                >
                  <button
                    onClick={() => {
                      setMenuOpen(false);
                      setOpen(true);
                    }}
                    className="mx-auto flex w-full max-w-xs items-center justify-center gap-2.5 rounded-full bg-white py-3.5 text-[11px] font-extrabold uppercase tracking-[0.24em] text-ink transition hover:shadow-[0_0_36px_rgba(255,255,255,0.22)]"
                  >
                    <ShoppingBag size={15} />
                    Bag{count > 0 ? ` (${count})` : ""}
                  </button>
                </div>
              </nav>
            </div>
          </div>
        </div>
      </header>

      {/* ---------- desktop bar ---------- */}
      <DesktopBar onSearch={onSearch} onTrack={onTrack} active={active} />
    </>
  );
}

function DesktopBar({
  onSearch,
  onTrack,
  active,
}: {
  onSearch: () => void;
  onTrack: () => void;
  active?: string;
}) {
  const [scrolled, setScrolled] = useState(false);
  const { count, setOpen } = useCart();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={`fixed inset-x-0 top-0 z-50 hidden transition-all duration-500 lg:block ${
        scrolled
          ? "border-b border-white/5 bg-ink py-3"
          : "border-b border-transparent bg-transparent py-5"
      }`}
    >
      <div className="relative mx-auto flex max-w-[1440px] items-center justify-between px-10">
        {/* left */}
        <nav className="flex items-center gap-8" aria-label="Primary">
          {navLinks.map((link) =>
            link.children ? (
              <div key={link.label} className="group relative">
                <ILink
                  href={link.href ?? "#"}
                  className="flex items-center gap-1.5 py-2 text-[12px] font-semibold uppercase tracking-[0.18em] text-white/55 transition-colors duration-300 hover:text-white"
                >
                  {link.label}
                  <ChevronDown
                    size={13}
                    className="transition-transform duration-300 group-hover:rotate-180"
                  />
                </ILink>

                {/* dropdown — opens under the link, left aligned */}
                <div className="invisible absolute left-0 top-full z-50 w-64 translate-y-2 pt-3 opacity-0 transition-all duration-300 ease-out group-hover:visible group-hover:translate-y-0 group-hover:opacity-100">
                  <div className="overflow-hidden rounded-xl bg-navy-900 shadow-[0_24px_60px_rgba(0,0,0,0.6)]">
                    {link.children.map((child) => (
                      <ILink
                        key={child.label}
                        href={child.href}
                        className="flex items-center gap-3 border-b border-white/5 px-5 py-3.5 transition-colors duration-300 last:border-b-0 hover:bg-navy-800"
                      >
                        <span className="h-1 w-1 shrink-0 rounded-full bg-white/25" />
                        <span>
                          <span className="block font-display text-[14px] font-medium leading-tight text-white">
                            {child.label}
                          </span>
                          <span className="mt-1 block text-[11px] leading-snug text-white/60">
                            {child.note}
                          </span>
                        </span>
                      </ILink>
                    ))}
                  </div>
                </div>
              </div>
            ) : link.action === "track" ? (
              <button
                key={link.label}
                onClick={onTrack}
                className="py-2 text-[12px] font-semibold uppercase tracking-[0.18em] text-white/55 transition-colors duration-300 hover:text-white"
              >
                {link.label}
              </button>
            ) : (
              <ILink
                key={link.label}
                href={link.href ?? "#"}
                className={`group relative py-2 text-[12px] font-semibold uppercase tracking-[0.18em] transition-colors duration-300 ${
                  active === "home" && link.label === "Home"
                    ? "text-gold"
                    : "text-white/55 hover:text-white"
                }`}
              >
                {link.label}
                <span
                  className={`absolute inset-x-0 -bottom-0.5 h-px origin-left transition-transform duration-300 ${
                    active === "home" && link.label === "Home"
                      ? "scale-x-100 bg-gold"
                      : "scale-x-0 bg-white group-hover:scale-x-100"
                  }`}
                />
              </ILink>
            )
          )}
        </nav>

        {/* center logo */}
        {/* The crest is decorative art; the link still needs a name, so the
            label is real text (visually hidden) rather than an aria-label. */}
        <a
          href={withBase(href.home)}
          className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
        >
          <span className="sr-only">The Thomian Store — home</span>
          <span className="grid h-14 w-14 place-items-center rounded-full bg-white shadow-[0_15px_45px_rgba(0,0,0,0.5)] transition-transform duration-500 hover:scale-105">
            <CrestLogo className="h-9 w-9 text-ink" decorative />
          </span>
        </a>

        {/* right */}
        <div className="flex items-center gap-2">
          <button
            onClick={onSearch}
            aria-label="Search the store"
            className="grid h-10 w-10 place-items-center rounded-full text-white/65 transition-colors duration-300 hover:bg-navy-800 hover:text-white"
          >
            <Search size={17} />
          </button>
          <button
            onClick={() => {
              const target = document.getElementById("contact");
              if (target) target.scrollIntoView({ behavior: "smooth" });
            }}
            aria-label="My account"
            className="hidden h-10 w-10 place-items-center rounded-full text-white/65 transition-colors duration-300 hover:bg-navy-800 hover:text-white md:grid"
          >
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
              <circle cx="12" cy="7" r="4" />
            </svg>
          </button>
          <button
            onClick={() => setOpen(true)}
            aria-label="Open shopping bag"
            className="relative grid h-10 w-10 place-items-center rounded-full text-white/65 transition-colors duration-300 hover:bg-navy-800 hover:text-white"
          >
            <ShoppingBag size={17} />
            {count > 0 && (
              <span className="absolute -right-0.5 -top-0.5 grid h-[18px] min-w-[18px] place-items-center rounded-full bg-gold px-1 text-[10px] font-extrabold text-ink">
                {count}
              </span>
            )}
          </button>
        </div>
      </div>
    </header>
  );
}
