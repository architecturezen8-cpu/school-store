import type { Metadata } from "next";
import Link from "next/link";
import { isAdmin, adminConfigured } from "@/lib/admin/auth";
import { databaseProblem } from "@/lib/admin/db-guard";
import { databaseDown, hasDatabase } from "@/lib/db";
import { signIn } from "./actions";
import { listBookings } from "@/lib/bookings";
import { listAdminCategories, listAdminProducts } from "@/lib/catalog";
import { lkr } from "@/lib/format";
import SubmitButton from "@/components/SubmitButton";
import { Eyebrow, Notice, Pill, Stat, buttonClass, inputClass } from "@/components/admin/ui";
import AdminImage from "@/components/admin/AdminImage";
import { ArrowUpRight, CalendarCheck, CalendarDays, Package, ScanLine } from "lucide-react";

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
    href: "/admin/shop",
    icon: Package,
    title: "Products",
    body: "The shelf: pictures, prices, colours and sizes. What the shop sells.",
  },
  {
    href: "/admin/bookings",
    icon: CalendarCheck,
    title: "Bookings",
    body: "Every ticket sold, who paid, and who has walked through the gate.",
  },
  {
    href: "/admin/events",
    icon: CalendarDays,
    title: "Events",
    body: "Every college event: the page, the rules, the photos, the ticket artwork.",
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
      <div className="flex min-h-screen items-center justify-center bg-page px-4 py-16">
        <div className="w-full max-w-sm rounded-3xl bg-panel p-7">
          <p className="text-[11px] uppercase tracking-[0.28em] text-muted">
            St. Thomas&apos; College Matale
          </p>
          <h1 className="mt-2 font-display text-3xl font-semibold text-strong">Store admin</h1>
          <p className="mt-2 text-sm text-muted">
            Sign in to manage tickets, designs and the gate.
          </p>

          <div className="mt-6 space-y-2">
            {!adminConfigured() && (
              <Notice tone="warn">
                Add <code className="rounded-md bg-page px-1.5 py-0.5">ADMIN_PASSWORD</code> to{" "}
                <code className="rounded-md bg-page px-1.5 py-0.5">.env.local</code>, then
                restart <code className="rounded-md bg-page px-1.5 py-0.5">npm run dev</code>.
              </Notice>
            )}
            {error && ERRORS[error] && <Notice tone="error">{ERRORS[error]}</Notice>}
          </div>

          <form action={signIn} className="mt-5 space-y-3">
            <input type="hidden" name="next" value={next ?? "/admin"} />
            <label className="block">
              <span className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted">
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
            <SubmitButton
              pending="Signing in…"
              className={`${buttonClass("primary")} w-full`}
            >
              Sign in
            </SubmitButton>
          </form>

          <Link href="/" className="mt-6 inline-block text-sm text-muted hover:text-strong">
            ← Back to the store
          </Link>
        </div>
      </div>
    );
  }

  /* ---------------- signed in: the bento tray ---------------- */
  const problem = databaseProblem();
  const live = hasDatabase() && !databaseDown();
  const bookings = live ? await listBookings(200) : [];
  // The shelf, as pictures: the overview's job is to answer "is the shop all
  // right?" at a glance, and a shop is judged with the eyes.
  const [categories, products] = live
    ? await Promise.all([listAdminCategories(), listAdminProducts()])
    : [[], []];
  const shelf = products.filter((p) => p.active);
  const featured = shelf.filter((p) => p.isFeatured).slice(0, 4);
  const lumpy = shelf.filter((p) => !p.image).length + shelf.filter((p) => p.price <= 0).length;
  const admitted = bookings.filter((b) => b.admittedAt).length;
  const taken = bookings.reduce((n, b) => n + b.total, 0);
  const seats = bookings.reduce((n, b) => n + b.seats, 0);
  const latest = bookings.slice(0, 5);
  const outstanding = bookings.length - admitted;

  return (
    /* A single 4-column grid owns the whole page, and every child states its
       span. That is what stops the "one blob": the hero and the live list share
       row one, four equal stats share row two, three equal sections share row
       three. Each row starts and ends on a grid line, and cards in a row are the
       same height because the grid stretches them. */
    <div className="grid gap-3 xl:grid-cols-4 xl:content-start">
      {/* row 1 — the headline, with the live list beside it */}
      <section className="rounded-2xl bg-panel p-6 sm:p-8 xl:col-span-3">
        <div className="flex flex-wrap items-center gap-2">
          <Eyebrow>Overview</Eyebrow>
          <Pill tone="invert">
            {bookings.length ? `${outstanding} still to come` : "no bookings yet"}
          </Pill>
        </div>
        <h1 className="mt-3 font-display text-3xl font-semibold text-strong sm:text-4xl">
          Today at the store
        </h1>
        <p className="mt-3 max-w-lg text-sm leading-relaxed text-muted">
          Tickets sold, money taken and who is through the gate. Everything else is in the
          sidebar.
        </p>
      </section>

      <div className="flex flex-col rounded-2xl bg-panel p-5 xl:col-span-1">
        <Eyebrow>Latest</Eyebrow>
        <div className="mt-3 flex-1">
          {latest.length === 0 ? (
            <p className="text-sm leading-relaxed text-muted">
              No bookings yet — they appear the moment someone reserves a ticket.
            </p>
          ) : (
            <ul className="space-y-2.5">
              {latest.slice(0, 3).map((b) => (
                <li key={b.reference} className="flex items-center justify-between gap-2">
                  <span className="min-w-0">
                    <span className="block truncate text-sm text-strong">{b.name}</span>
                    <span className="block truncate font-mono text-[11px] text-muted">
                      {b.reference}
                    </span>
                  </span>
                  <Pill tone={b.admittedAt ? "ok" : "muted"}>
                    {b.admittedAt ? "in" : "out"}
                  </Pill>
                </li>
              ))}
            </ul>
          )}
        </div>
        <Link
          href="/admin/bookings"
          className="mt-4 inline-flex items-center gap-1.5 text-sm text-muted hover:text-strong"
        >
          All bookings <ArrowUpRight className="h-3.5 w-3.5" />
        </Link>
      </div>

      {problem && (
        <Notice tone="warn" className="sm:col-span-2 xl:col-span-4">
          {problem}
        </Notice>
      )}

      {/* row 2 — four numbers, four equal cells */}
      <dl className="grid grid-cols-2 gap-3 xl:col-span-4 xl:grid-cols-4">
        <Stat label="Bookings" value={String(bookings.length)} note={`${seats} seats`} />
        <Stat label="Admitted" value={String(admitted)} note={`${outstanding} still to come`} />
        <Stat label="Taken" value={lkr(taken)} note="ticket sales" tone="invert" />
        <Stat
          label="Average booking"
          value={bookings.length ? lkr(Math.round(taken / bookings.length)) : lkr(0)}
          note="per booking"
        />
      </dl>

      {/* row 3 — the shop, as pictures. Four collections, four cards: the same
          grid the storefront uses, at admin size. */}
      {categories.length > 0 && (
        <section className="rounded-2xl bg-panel p-5 xl:col-span-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <Eyebrow>The shop</Eyebrow>
              <p className="mt-1 font-display text-lg text-strong">
                {shelf.length} products in {categories.length} collections
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {lumpy > 0 && (
                <Pill tone="stop">
                  {lumpy} card{lumpy === 1 ? "" : "s"} missing a picture or price
                </Pill>
              )}
              <Link href="/admin/shop" className={`${buttonClass("secondary")} !py-1.5 !text-xs`}>
                <Package className="h-3.5 w-3.5" /> Products
              </Link>
              <Link
                href="/admin/shop/categories"
                className={`${buttonClass("ghost")} !py-1.5 !text-xs`}
              >
                Categories
              </Link>
              <Link href="/admin/shop/filters" className={`${buttonClass("ghost")} !py-1.5 !text-xs`}>
                Filters
              </Link>
            </div>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {categories.slice(0, 4).map((c) => (
              <Link
                key={c.slug}
                href={`/admin/shop?category=${encodeURIComponent(c.slug)}`}
                className="group relative block overflow-hidden rounded-xl bg-well"
              >
                <div className="aspect-[16/9] overflow-hidden">
                  {c.image ? (
                    <AdminImage
                      src={c.image}
                      className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.04]"
                    />
                  ) : (
                    <span className="grid h-full place-items-center text-[11px] text-muted">
                      no picture
                    </span>
                  )}
                </div>
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-ink/90 to-transparent p-3">
                  <p className="truncate text-sm font-medium text-white">{c.title}</p>
                  <p className="text-[11px] text-white/70">
                    {c.items} {c.items === 1 ? "item" : "items"}
                  </p>
                </div>
              </Link>
            ))}
          </div>

          {featured.length > 0 && (
            <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {featured.map((p) => (
                <Link
                  key={p.slug}
                  href={`/admin/shop/products/${p.slug}`}
                  className="flex items-center gap-3 rounded-xl bg-well p-2 transition-colors hover:bg-panel-2"
                >
                  <AdminImage
                    src={p.image || "/images/cat-uniform.jpg"}
                    className="h-12 w-12 shrink-0 rounded-lg object-cover"
                  />
                  <span className="min-w-0">
                    <span className="block truncate text-xs text-strong">{p.name}</span>
                    <span className="block text-[11px] text-muted">{lkr(p.price)}</span>
                  </span>
                </Link>
              ))}
            </div>
          )}
        </section>
      )}

      {/* row 4 — the three sections, side by side on a desktop.
          Four sections, four columns: the row is filled exactly, every card the
          same size, and nothing wraps onto a ragged second row. */}
      {SECTIONS.map(({ href, icon: Icon, title, body }, i) => (
        <Link
          key={href}
          href={href}
          className={`group flex min-h-[12rem] flex-col rounded-2xl p-5 transition-colors sm:col-span-2 xl:col-span-1 ${
            i === 0 ? "bg-gold text-black hover:bg-gold-bright" : "bg-panel text-strong hover:bg-panel-2"
          }`}
        >
          <div className="flex items-start justify-between gap-3">
            <span
              className={`grid h-10 w-10 place-items-center rounded-xl ${
                i === 0 ? "bg-page text-strong" : "bg-panel-2 text-strong"
              }`}
            >
              <Icon className="h-5 w-5" />
            </span>
            <ArrowUpRight
              className={`h-4 w-4 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5 ${
                i === 0 ? "text-black/55" : "text-muted"
              }`}
            />
          </div>
          <p className="mt-6 font-display text-lg">{title}</p>
          <p className={`mt-1 text-sm leading-relaxed ${i === 0 ? "text-black/70" : "text-muted"}`}>
            {body}
          </p>
        </Link>
      ))}
    </div>
  );
}
