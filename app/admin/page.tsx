import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { adminConfigured, isAdmin } from "@/lib/admin/auth";
import { hasDatabase } from "@/lib/db";
import { signIn, signOut } from "./actions";
import { listBookings } from "@/lib/bookings";
import { lkr } from "@/lib/format";
import { LayoutTemplate, ScanLine, Ticket, Mail } from "lucide-react";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Admin",
  robots: { index: false, follow: false },
};

const ERRORS: Record<string, string> = {
  password: "That password is not right.",
  session: "Your session expired. Sign in again.",
  database: "No database is configured, so there is nothing to administer.",
};

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; next?: string }>;
}) {
  const { error, next } = await searchParams;
  const signedIn = await isAdmin();

  if (!signedIn) {
    return (
      <section className="mx-auto flex min-h-[80vh] max-w-md flex-col justify-center px-6 py-32">
        <p className="text-[11px] uppercase tracking-[0.3em] text-gold">St. Thomas&apos; College Matale</p>
        <h1 className="mt-3 font-display text-3xl font-semibold text-white">Store admin</h1>

        {!adminConfigured() && (
          <div className="mt-5 rounded-xl border border-amber-400/40 bg-amber-500/10 p-4 text-sm text-amber-100">
            <p className="font-semibold">Admin is not configured yet.</p>
            <p className="mt-1 text-amber-100/80">
              Add <code className="rounded bg-black/30 px-1">ADMIN_PASSWORD</code> to{" "}
              <code className="rounded bg-black/30 px-1">.env.local</code>, then restart{" "}
              <code className="rounded bg-black/30 px-1">npm run dev</code>.
            </p>
          </div>
        )}

        {error && ERRORS[error] && (
          <p className="mt-5 rounded-xl border border-red-400/40 bg-red-500/10 p-3 text-sm text-red-200">
            {ERRORS[error]}
          </p>
        )}

        <form action={signIn} className="mt-6 space-y-3">
          <input type="hidden" name="next" value={next ?? "/admin"} />
          <label className="block">
            <span className="text-[11px] uppercase tracking-[0.2em] text-white/65">Password</span>
            <input
              type="password"
              name="password"
              autoComplete="current-password"
              required
              className="mt-1 w-full rounded-xl border border-white/15 bg-white/[0.04] px-4 py-3 text-white outline-none focus:border-gold/60"
            />
          </label>
          <button
            type="submit"
            className="w-full rounded-xl bg-gold px-4 py-3 text-sm font-semibold text-navy-950"
          >
            Sign in
          </button>
        </form>
      </section>
    );
  }

  const bookings = hasDatabase() ? await listBookings(8) : [];
  const admitted = bookings.filter((b) => b.admittedAt).length;

  return (
    <section className="mx-auto max-w-4xl px-6 pb-20 pt-32 md:pt-36">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[11px] uppercase tracking-[0.3em] text-gold">St. Thomas&apos; College Matale</p>
          <h1 className="mt-2 font-display text-3xl font-semibold text-white">Store admin</h1>
        </div>
        <form action={signOut}>
          <button type="submit" className="rounded-lg border border-white/15 px-4 py-2 text-sm text-white/70">
            Sign out
          </button>
        </form>
      </div>

      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        <Link
          href="/admin/templates"
          className="group rounded-2xl border border-white/10 bg-white/[0.03] p-6 transition-colors hover:border-gold/40"
        >
          <LayoutTemplate className="h-6 w-6 text-gold" />
          <p className="mt-3 font-display text-lg text-white">Ticket designs</p>
          <p className="mt-1 text-sm text-white/70">
            Upload artwork with a white square; the QR is pasted into it automatically.
          </p>
        </Link>

        <Link
          href="/gate"
          className="group rounded-2xl border border-white/10 bg-white/[0.03] p-6 transition-colors hover:border-gold/40"
        >
          <ScanLine className="h-6 w-6 text-gold" />
          <p className="mt-3 font-display text-lg text-white">Gate scanner</p>
          <p className="mt-1 text-sm text-white/70">
            Scan a ticket to admit one entry. Works on a phone camera.
          </p>
        </Link>

        <Link
          href="/admin/mail"
          className="group rounded-2xl border border-white/10 bg-white/[0.03] p-6 transition-colors hover:border-gold/40"
        >
          <Mail className="h-6 w-6 text-gold" />
          <p className="mt-3 font-display text-lg text-white">Ticket email</p>
          <p className="mt-1 text-sm text-white/70">
            Customise the subject and message customers receive.
          </p>
        </Link>

        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
          <Ticket className="h-6 w-6 text-gold" />
          <p className="mt-3 font-display text-lg text-white">Recent bookings</p>
          <p className="mt-1 text-sm text-white/70">
            {bookings.length} shown · {admitted} admitted
          </p>
        </div>
      </div>

      <section className="mt-10">
        <h2 className="font-display text-xl text-white">Latest bookings</h2>
        {bookings.length === 0 ? (
          <p className="mt-3 text-sm text-white/65">
            No bookings yet. They appear here the moment someone reserves a ticket.
          </p>
        ) : (
          <ul className="mt-4 space-y-2">
            {bookings.map((b) => (
              <li
                key={b.reference}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/10 px-4 py-3 text-sm"
              >
                <div className="min-w-0">
                  <p className="truncate text-white">{b.name}</p>
                  <p className="truncate text-white/65">
                    {b.eventTitle} · {b.reference}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-white/60">{lkr(b.total)}</span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[11px] ${
                      b.admittedAt
                        ? "bg-emerald-500/15 text-emerald-300"
                        : "bg-white/10 text-white/60"
                    }`}
                  >
                    {b.admittedAt ? "admitted" : "not scanned"}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
        <Link href="/admin/bookings" className="mt-4 inline-block text-sm text-gold">
          See all bookings →
        </Link>
      </section>
    </section>
  );
}
