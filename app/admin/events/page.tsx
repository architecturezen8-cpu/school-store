import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { isAdmin } from "@/lib/admin/auth";
import { databaseProblem } from "@/lib/admin/db-guard";
import { databaseDown, hasDatabase } from "@/lib/db";
import { listAllEvents } from "@/lib/events";
import { safeDecode } from "@/lib/safe-decode";
import { toggleEventFeaturedAction, toggleEventPublishedAction } from "../actions";
import {
  Empty,
  Eyebrow,
  Notice,
  PageHeader,
  Pill,
  buttonClass,
} from "@/components/admin/ui";
import { CalendarPlus, ExternalLink, Pencil, Star } from "lucide-react";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Events",
  robots: { index: false, follow: false },
};

/**
 * The events list.
 *
 * Newest-first is wrong here: an admin is usually looking for the next event, so
 * the order is the one the shop uses (position, then date), and each row says what
 * the shop is doing with the event right now — on sale, draft, or the big one.
 */
export default async function AdminEventsPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  if (!(await isAdmin())) redirect("/admin?next=/admin/events");
  if (!hasDatabase()) redirect("/admin?error=database");

  const { ok, error } = await searchParams;
  const problem = databaseProblem();
  const events = databaseDown() ? [] : await listAllEvents();

  return (
    <div className="space-y-3">
      <section className="rounded-2xl bg-panel p-6">
        <PageHeader
          eyebrow="Events"
          title="Events"
          description="Every event in the shop, what its page says, and what it costs. The spotlights at the top of /tickets are chosen here."
          actions={
            <Link href="/admin/events/new" className={buttonClass("primary")}>
              <CalendarPlus className="h-4 w-4" /> New event
            </Link>
          }
        />
        {problem && (
          <div className="mt-4">
            <Notice tone="warn">{problem}</Notice>
          </div>
        )}
        {(ok || error) && (
          <div className="mt-4 space-y-2">
            {ok && <Notice tone="ok">{safeDecode(ok)}</Notice>}
            {error && <Notice tone="error">{safeDecode(error)}</Notice>}
          </div>
        )}
      </section>

      {events.length === 0 ? (
        <div className="rounded-2xl bg-panel p-6">
          <Empty>
            No events yet. “New event” creates one — it appears on /tickets as soon as it is
            published and has a ticket type.
          </Empty>
        </div>
      ) : (
        <ul className="grid gap-3 xl:grid-cols-2">
          {events.map((e) => (
            <li key={e.slug} className="flex flex-col rounded-2xl bg-panel p-4">
              <div className="flex items-start gap-4">
                <div className="relative h-24 w-36 shrink-0 overflow-hidden rounded-xl bg-well">
                  {(e.heroImage || e.image) && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={e.heroImage || e.image}
                      alt=""
                      className={`h-full w-full object-cover ${e.published ? "" : "opacity-50"}`}
                    />
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="min-w-0 truncate font-display text-[15px] font-semibold text-strong">
                      {e.title || e.slug}
                    </p>
                    {e.featured && <Pill tone="ok">in the spotlight</Pill>}
                    {!e.published && <Pill>draft</Pill>}
                  </div>
                  <p className="mt-1 text-[11.5px] text-muted">
                    {e.startsAt
                      ? new Date(e.startsAt).toLocaleString("en-GB", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })
                      : "no date"}
                    {e.venue ? ` · ${e.venue}` : ""}
                  </p>
                  <p className="mt-2 text-[11px] text-faint">
                    {e.tierCount} ticket {e.tierCount === 1 ? "type" : "types"} ·{" "}
                    {e.rules.length} rules · {e.gallery.length} photos · {e.links.length} links
                  </p>

                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <Link
                      href={`/admin/events/${e.slug}`}
                      className={`${buttonClass("secondary")} !px-3 !py-1.5 !text-xs`}
                    >
                      <Pencil className="h-3.5 w-3.5" /> Edit
                    </Link>
                    <Link
                      href={`/events/${e.slug}`}
                      target="_blank"
                      className={`${buttonClass("ghost")} !px-3 !py-1.5 !text-xs`}
                    >
                      <ExternalLink className="h-3.5 w-3.5" /> Page
                    </Link>
                    <form action={toggleEventFeaturedAction}>
                      <input type="hidden" name="slug" value={e.slug} />
                      <input type="hidden" name="featured" value={String(!e.featured)} />
                      <button
                        type="submit"
                        className={`${buttonClass("ghost")} !px-3 !py-1.5 !text-xs`}
                      >
                        <Star className="h-3.5 w-3.5" />
                        {e.featured ? "Unfeature" : "Feature"}
                      </button>
                    </form>
                    <form action={toggleEventPublishedAction}>
                      <input type="hidden" name="slug" value={e.slug} />
                      <input type="hidden" name="published" value={String(!e.published)} />
                      <button
                        type="submit"
                        className={`${buttonClass("ghost")} !px-3 !py-1.5 !text-xs`}
                      >
                        {e.published ? "Hide" : "Publish"}
                      </button>
                    </form>
                  </div>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      <section className="rounded-2xl bg-panel p-6">
        <Eyebrow>Where this shows</Eyebrow>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted">
          A published event appears on <code className="text-strong">/tickets</code> as a card
          and gets its own page at{" "}
          <code className="text-strong">/events/&lt;address&gt;</code>. Anything in the spotlight
          also gets a full-width hero with its own countdown — add as many as you like; they
          stack in list order.
        </p>
      </section>
    </div>
  );
}
