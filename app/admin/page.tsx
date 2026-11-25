import type { Metadata } from "next";
import Link from "next/link";
import { isAdmin, adminConfigured } from "@/lib/admin/auth";
import { hasDatabase } from "@/lib/db";
import { signIn } from "./actions";
import { listBookings } from "@/lib/bookings";
import { lkr } from "@/lib/format";
import {
  Empty,
  Notice,
  PageHeader,
  Panel,
  Pill,
  Stat,
  buttonClass,
  inputClass,
} from "@/components/admin/ui";
import { ArrowRight, CalendarCheck, LayoutTemplate, Mail, ScanLine } from "lucide-react";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Overview",
  robots: { index: false, follow: false },
};

const ERRORS: Record<string, string> = {
  password: "That password is not right.",
  session: "Your session expired. Sign in again.",
  database: "No database is configured, so there is nothing to administer.",
};

const SECTIONS = [
  {
    href: "/admin/bookings",
    icon: CalendarCheck,
    title: "Bookings",
    body: "Every ticket sold, who paid, and who has walked through the gate.",
  },
  {
    href: "/admin/templates",
    icon: LayoutTemplate,
    title: "Ticket designs",
    body: "Upload the artwork with a white square; the QR is pasted into it.",
  },
  {
    href: "/admin/mail",
    icon: Mail,
    title: "Ticket email",
    body: "The message, and a preview of the exact mail a buyer receives.",
  },
  {
    href: "/admin/gate",
    icon: ScanLine,
    title: "Gate scanner",
    body: "Scan at the door. One scan, one admission — the same code twice is refused.",
  },
];

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; next?: string }>;
}) {
  const { error, next } = await searchParams;
  const signedIn = await isAdmin();

  /* ---------------- signed out: the door ---------------- */
  if (!signedIn) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-ink px-4 py-16">
        <div className="w-full max-w-sm">
          <p className="text-[11px] uppercase tracking-[0.28em] text-gold">
            St. Thomas&apos; College Matale
          </p>
          <h1 className="mt-2 font-display text-3xl font-semibold text-white">Store admin</h1>
          <p className="mt-2 text-sm text-white/65">
            Sign in to manage tickets, designs and the gate.
          </p>

          <div className="mt-6 space-y-3">
            {!adminConfigured() && (
              <Notice tone="warn">
                Add <code className="rounded bg-black/30 px-1">ADMIN_PASSWORD</code> to{" "}
                <code className="rounded bg-black/30 px-1">.env.local</code>, then restart{" "}
                <code className="rounded bg-black/30 px-1">npm run dev</code>.
              </Notice>
            )}
            {error && ERRORS[error] && <Notice tone="error">{ERRORS[error]}</Notice>}
          </div>

          <form action={signIn} className="mt-5 space-y-3">
            <input type="hidden" name="next" value={next ?? "/admin"} />
            <label className="block">
              <span className="text-[11px] font-medium uppercase tracking-[0.16em] text-white/65">
                Password
              </span>
              <input
                type="password"
                name="password"
                autoComplete="current-password"
                required
                autoFocus
                className={inputClass}
              />
            </label>
            <button type="submit" className={`${buttonClass("primary")} w-full`}>
              Sign in
            </button>
          </form>

          <Link href="/" className="mt-6 inline-block text-sm text-white/65 hover:text-white">
            ← Back to the store
          </Link>
        </div>
      </div>
    );
  }

  /* ---------------- signed in: the overview ---------------- */
  const bookings = hasDatabase() ? await listBookings(200) : [];
  const admitted = bookings.filter((b) => b.admittedAt).length;
  const taken = bookings.reduce((n, b) => n + b.total, 0);
  const seats = bookings.reduce((n, b) => n + b.seats, 0);
  const latest = bookings.slice(0, 6);

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-10 lg:py-10">
      <PageHeader
        eyebrow="Overview"
        title="Today at the store"
        description="Tickets sold, money taken and who is through the gate. Everything else is in the sidebar."
      />

      <dl className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Bookings" value={String(bookings.length)} note={`${seats} seats`} />
        <Stat label="Admitted" value={String(admitted)} note={`${bookings.length - admitted} still to come`} />
        <Stat label="Taken" value={lkr(taken)} note="ticket sales" />
        <Stat
          label="Paid per booking"
          value={bookings.length ? lkr(Math.round(taken / bookings.length)) : lkr(0)}
          note="average"
        />
      </dl>

      <div className="mt-8 grid gap-3 sm:grid-cols-2">
        {SECTIONS.map(({ href, icon: Icon, title, body }) => (
          <Link
            key={href}
            href={href}
            className="group flex items-start gap-4 rounded-xl border border-navy-700 bg-navy-900 p-5 transition-colors hover:border-navy-600 hover:bg-navy-800"
          >
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-navy-800 text-gold group-hover:bg-navy-700">
              <Icon className="h-5 w-5" />
            </span>
            <span className="min-w-0">
              <span className="flex items-center gap-2 text-white">
                <span className="font-display text-lg">{title}</span>
                <ArrowRight className="h-4 w-4 text-white/30 transition-transform group-hover:translate-x-0.5 group-hover:text-gold" />
              </span>
              <span className="mt-1 block text-sm leading-relaxed text-white/65">{body}</span>
            </span>
          </Link>
        ))}
      </div>

      <Panel
        className="mt-8"
        title="Latest bookings"
        description="Newest first."
        actions={
          <Link href="/admin/bookings" className={buttonClass("ghost")}>
            All bookings
          </Link>
        }
      >
        {latest.length === 0 ? (
          <Empty>No bookings yet — they appear the moment someone reserves a ticket.</Empty>
        ) : (
          <ul className="divide-y divide-navy-700">
            {latest.map((b) => (
              <li key={b.reference} className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
                <div className="min-w-0">
                  <p className="truncate text-sm text-white">{b.name}</p>
                  <p className="truncate text-xs text-white/60">
                    {b.eventTitle} · <span className="font-mono">{b.reference}</span>
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm text-white/70">{lkr(b.total)}</span>
                  <Pill tone={b.admittedAt ? "ok" : "muted"}>
                    {b.admittedAt ? "admitted" : "not scanned"}
                  </Pill>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}
