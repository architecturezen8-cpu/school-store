"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import CrestLogo from "@/components/CrestLogo";
import { signOut } from "@/app/admin/actions";
import {
  CalendarCheck,
  ExternalLink,
  LayoutDashboard,
  LayoutTemplate,
  LogOut,
  Mail,
  Menu,
  ScanLine,
  X,
} from "lucide-react";

/**
 * The admin frame: a fixed sidebar, a top bar, and the page.
 *
 * Solid colours only. Each surface is one flat colour with a hairline edge —
 * `bg-navy-950` for the rail, `bg-navy-900` for panels, `bg-navy-700` for the
 * active item, `bg-gold` for the one thing to press on a screen. No gradients,
 * no translucency, no blur: layers stay unambiguous at a glance on a phone at
 * the gate, in daylight, at an odd angle.
 */

const NAV = [
  { href: "/admin", label: "Overview", icon: LayoutDashboard },
  { href: "/admin/bookings", label: "Bookings", icon: CalendarCheck },
  { href: "/admin/templates", label: "Ticket designs", icon: LayoutTemplate },
  { href: "/admin/mail", label: "Ticket email", icon: Mail },
  { href: "/admin/gate", label: "Gate scanner", icon: ScanLine },
];

export default function AdminShell({
  signedIn,
  children,
}: {
  signedIn: boolean;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  // Signed out: the sign-in screen owns the whole viewport.
  if (!signedIn) {
    return <main className="min-h-screen bg-ink">{children}</main>;
  }

  const isActive = (href: string) =>
    href === "/admin" ? pathname === "/admin" : Boolean(pathname?.startsWith(href));
  const current = NAV.find((n) => isActive(n.href));

  return (
    <div className="min-h-screen bg-ink text-white lg:flex">
      {/* ---------- mobile top bar ---------- */}
      <header className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-navy-700 bg-navy-950 px-4 py-3 lg:hidden">
        <div className="flex min-w-0 items-center gap-3">
          <CrestLogo className="h-8 w-8 shrink-0 text-gold" decorative />
          <div className="min-w-0">
            <p className="truncate text-[10px] uppercase tracking-[0.22em] text-gold">
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
          className="grid h-10 w-10 shrink-0 place-items-center rounded-lg border border-navy-700 text-white/80"
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </header>

      {/* ---------- sidebar ---------- */}
      <aside
        id="admin-nav"
        className={`${
          open ? "block" : "hidden"
        } border-b border-navy-700 bg-navy-950 lg:sticky lg:top-0 lg:block lg:h-screen lg:w-64 lg:shrink-0 lg:border-b-0 lg:border-r`}
      >
        <div className="flex h-full flex-col">
          {/* the school, at the top */}
          <div className="hidden items-center gap-3 border-b border-navy-700 px-5 py-5 lg:flex">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-navy-800">
              <CrestLogo className="h-8 w-8 text-gold" decorative />
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold leading-tight">
                St. Thomas&apos; College
              </p>
              <p className="truncate text-[10px] uppercase tracking-[0.18em] text-white/60">
                Matale · Store admin
              </p>
            </div>
          </div>

          {/* sections */}
          <nav className="flex-1 overflow-y-auto px-3 py-4" aria-label="Admin sections">
            <p className="px-3 pb-2 text-[10px] uppercase tracking-[0.18em] text-white/50">
              Manage
            </p>
            <ul className="space-y-0.5">
              {NAV.map(({ href, label, icon: Icon }) => {
                const active = isActive(href);
                return (
                  <li key={href}>
                    <Link
                      href={href}
                      onClick={() => setOpen(false)}
                      aria-current={active ? "page" : undefined}
                      className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors ${
                        active
                          ? "bg-navy-700 font-medium text-white"
                          : "text-white/65 hover:bg-navy-800 hover:text-white"
                      }`}
                    >
                      <Icon className={`h-4 w-4 shrink-0 ${active ? "text-gold" : "text-white/65"}`} />
                      <span className="truncate">{label}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>

            <div className="mt-4 border-t border-navy-700 pt-3">
              <Link
                href="/"
                className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-white/65 transition-colors hover:bg-navy-800 hover:text-white"
              >
                <ExternalLink className="h-4 w-4 shrink-0 text-white/65" />
                View the store
              </Link>
            </div>
          </nav>

          {/* who is signed in */}
          <div className="border-t border-navy-700 p-3">
            <div className="flex items-center gap-3 rounded-lg bg-navy-900 p-3">
              <span
                aria-hidden
                className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-gold text-xs font-bold text-navy-950"
              >
                SA
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium leading-tight">Store admin</p>
                <p className="truncate text-[11px] text-white/60">St. Thomas&apos; College</p>
              </div>
              <form action={signOut}>
                <button
                  type="submit"
                  aria-label="Sign out"
                  title="Sign out"
                  className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-white/50 transition-colors hover:bg-navy-800 hover:text-white"
                >
                  <LogOut className="h-4 w-4" />
                </button>
              </form>
            </div>
          </div>
        </div>
      </aside>

      {/* ---------- page ---------- */}
      <main className="min-w-0 flex-1">{children}</main>
    </div>
  );
}
