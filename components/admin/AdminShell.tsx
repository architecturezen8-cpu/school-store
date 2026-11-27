"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import LogoBadge from "@/components/LogoBadge";
import { ToastProvider } from "@/components/admin/Toasts";
import { signOut } from "@/app/admin/actions";
import {
  Boxes,
  CalendarCheck,
  CalendarDays,
  ExternalLink,
  LayoutDashboard,
  LogOut,
  LayoutGrid,
  Images,
  Mail,
  Menu,
  Package,
  ScanLine,
  SlidersHorizontal,
  Send,
  Settings,
  X,
} from "lucide-react";

/**
 * The admin frame, bento-style.
 *
 * The whole panel floats in a black tray with a gap around it: the sidebar is
 * its own rounded tile, every page is a tray of rounded tiles. Nothing has a
 * border — separation comes from the fill and the gutter.
 *
 * Navy, white and black only. No gradients, no glass, no blur.
 */

/**
 * The sidebar, grouped by the job rather than by the page.
 *
 * Seven flat links became thirteen with the shop, and a flat list of thirteen
 * is a list nobody reads — the thing you want is never where you look first.
 * The groups are the four things this panel is for: selling things, selling
 * seats, talking to people, and the one setting.
 */
const NAV: { title: string; items: { href: string; label: string; icon: typeof Mail }[] }[] = [
  {
    title: "Overview",
    items: [{ href: "/admin", label: "Overview", icon: LayoutDashboard }],
  },
  {
    title: "The shop",
    items: [
      { href: "/admin/shop", label: "Products", icon: Package },
      { href: "/admin/stock", label: "Stocks", icon: Boxes },
      { href: "/admin/shop/categories", label: "Categories", icon: LayoutGrid },
      { href: "/admin/shop/filters", label: "Filters", icon: SlidersHorizontal },
    ],
  },
  {
    title: "Tickets",
    items: [
      { href: "/admin/events", label: "Events", icon: CalendarDays },
      { href: "/admin/bookings", label: "Bookings", icon: CalendarCheck },
      { href: "/admin/gate", label: "Gate scanner", icon: ScanLine },
    ],
  },
  {
    title: "Messages",
    items: [
      { href: "/admin/mail", label: "Ticket email", icon: Mail },
      { href: "/admin/mail/log", label: "Email log", icon: Send },
    ],
  },
  {
    title: "The website",
    items: [{ href: "/admin/hero", label: "Hero slideshow", icon: Images }],
  },
  {
    title: "Settings",
    items: [{ href: "/admin/settings", label: "Logo & tab icon", icon: Settings }],
  },
];

const ALL_NAV = NAV.flatMap((g) => g.items);

export default function AdminShell({
  signedIn,
  logo = "",
  logoScale,
  children,
}: {
  signedIn: boolean;
  /** The uploaded school logo, or "" for the built-in crest. */
  logo?: string;
  /** How much of the white circle it fills, as set on the School logo page. */
  logoScale?: number;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  // Signed out: the sign-in screen owns the whole viewport.
  if (!signedIn) {
    return <main className="min-h-screen bg-page">{children}</main>;
  }

  // The longest matching section wins, so /admin/mail/log lights "Email log" and
  // not "Ticket email" as well — two gold tiles would say the admin is in two
  // places at once.
  const section = ALL_NAV.filter((n) =>
    n.href === "/admin" ? pathname === "/admin" : Boolean(pathname?.startsWith(n.href))
  ).sort((a, b) => b.href.length - a.href.length)[0];
  const isActive = (href: string) => href === section?.href;
  const current = section;

  const navTile = (
    <div className="flex h-full flex-col rounded-2xl bg-panel p-3">
      {/* the school, at the top */}
      <div className="flex items-center gap-3 px-2 py-2">
        <LogoBadge src={logo} size={44} scale={logoScale} />
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold leading-tight text-strong">
            St. Thomas&apos; College
          </p>
          <p className="truncate text-[10px] uppercase tracking-[0.18em] text-muted">
            Matale · Store admin
          </p>
        </div>
      </div>

      {/* sections */}
      <nav id="admin-sidebar" className="mt-3 flex-1 overflow-y-auto" aria-label="Admin sections">
        {NAV.map((group) => (
          <div key={group.title} className="mb-3">
            <p className="px-3 pb-1.5 text-[10px] font-medium uppercase tracking-[0.18em] text-faint">
              {group.title}
            </p>
            <ul className="space-y-0.5">
              {group.items.map(({ href, label, icon: Icon }) => {
                const active = isActive(href);
                return (
                  <li key={href}>
                    <Link
                      href={href}
                      onClick={() => setOpen(false)}
                      aria-current={active ? "page" : undefined}
                      className={`flex items-center gap-3 rounded-xl px-3 py-2 text-sm transition-colors ${
                        active
                          ? "bg-gold font-semibold text-black"
                          : "text-body hover:bg-panel-2 hover:text-strong"
                      }`}
                    >
                      <Icon className={`h-4 w-4 shrink-0 ${active ? "" : "text-faint"}`} />
                      <span className="truncate">{label}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}

        <div className="mt-4">
          <Link
            href="/"
            className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-muted transition-colors hover:bg-panel-2 hover:text-strong"
          >
            <ExternalLink className="h-4 w-4 shrink-0" />
            View the store
          </Link>
        </div>
      </nav>

      {/* who is signed in */}
      <div className="mt-4 rounded-xl bg-well p-3">
        <div className="flex items-center gap-3">
          <span
            aria-hidden
            className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-strong text-xs font-bold text-page"
          >
            SA
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium leading-tight text-strong">Store admin</p>
            <p className="truncate text-[11px] text-muted">St. Thomas&apos; College</p>
          </div>
          <form action={signOut}>
            <button
              type="submit"
              aria-label="Sign out"
              title="Sign out"
              className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-muted transition-colors hover:bg-panel-2 hover:text-strong"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </form>
        </div>
      </div>
    </div>
  );

  return (
    <ToastProvider>
    <div className="min-h-screen bg-page text-strong lg:flex lg:gap-3 lg:p-3">
      {/* ---------- mobile top bar ---------- */}
      <header className="sticky top-0 z-30 flex items-center justify-between gap-3 bg-page px-4 py-3 lg:hidden">
        <div className="flex min-w-0 items-center gap-3">
          <LogoBadge src={logo} size={36} scale={logoScale} />
          <div className="min-w-0">
            <p className="truncate text-[10px] uppercase tracking-[0.22em] text-muted">
              Store admin
            </p>
            <p className="truncate text-sm font-semibold">{current?.label ?? "Overview"}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-label={open ? "Close menu" : "Open menu"}
          aria-expanded={open}
          aria-controls="admin-nav"
          className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-panel text-strong"
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </header>

      {/* ---------- sidebar ---------- */}
      <aside
        id="admin-nav"
        className={`${open ? "block" : "hidden"} px-3 pb-3 lg:sticky lg:top-3 lg:block lg:h-[calc(100vh-1.5rem)] lg:w-64 lg:shrink-0 lg:px-0 lg:pb-0`}
      >
        {navTile}
      </aside>

        {/* ---------- page ---------- */}
        <main className="min-w-0 flex-1 px-3 pb-6 lg:px-0 lg:pb-0 lg:pr-1">{children}</main>
      </div>
    </ToastProvider>
  );
}
