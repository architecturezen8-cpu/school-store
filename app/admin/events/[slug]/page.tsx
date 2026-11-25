import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { isAdmin } from "@/lib/admin/auth";
import { databaseProblem } from "@/lib/admin/db-guard";
import { hasDatabase } from "@/lib/db";
import { getEventDraft, listAllEvents } from "@/lib/events";
import { listTemplates } from "@/lib/tickets/templates";
import { databaseDown } from "@/lib/db";
import { safeDecode } from "@/lib/safe-decode";
import {
  deleteEventAction,
  deleteEventDesignAction,
  featureEventAction,
  saveEventAction,
  setEventDesignActiveAction,
  uploadEventDesignAction,
  uploadEventImageAction,
} from "../../actions";
import EventEditor from "@/components/admin/EventEditor";
import { Notice, PageHeader } from "@/components/admin/ui";
import { ArrowLeft } from "lucide-react";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Edit event",
  robots: { index: false, follow: false },
};

export default async function EditEventPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ ok?: string }>;
}) {
  if (!(await isAdmin())) redirect("/admin?next=/admin/events");
  if (!hasDatabase()) redirect("/admin?error=database");

  const { slug } = await params;
  const { ok } = await searchParams;
  const problem = databaseProblem();
  const event = await getEventDraft(slug);
  if (!event) notFound();

  const others = (await listAllEvents()).filter((e) => e.slug !== slug);
  // Designs for this event only — a design made for another event is not this
  // event's artwork, and showing it here would invite editing the wrong one.
  const designs = databaseDown()
    ? []
    : (await listTemplates())
        .filter((t) => t.event === slug)
        .map((t) => ({ id: t.id, name: t.name, file: t.file, isActive: t.isActive }));

  return (
    <div className="space-y-3">
      <section className="rounded-2xl bg-panel p-6">
        <Link
          href="/admin/events"
          className="inline-flex items-center gap-1.5 text-[11px] uppercase tracking-[0.16em] text-white/55 hover:text-white"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Events
        </Link>
        <div className="mt-3">
          <PageHeader
            eyebrow="Events"
            title={event.title || event.slug}
            description="The essentials fill the card on /tickets; everything else builds the event page. Changes appear on the shop the next time it revalidates."
          />
        </div>
        {problem && (
          <div className="mt-4">
            <Notice tone="warn">{problem}</Notice>
          </div>
        )}
        {ok && (
          <div className="mt-4">
            <Notice tone="ok">{safeDecode(ok) === "1" ? "Event created — this is it." : safeDecode(ok)}</Notice>
          </div>
        )}
      </section>

      <EventEditor
        initial={event}
        mode="update"
        takenSlugs={others.map((e) => e.slug)}
        saveAction={saveEventAction}
        uploadAction={uploadEventImageAction}
        featureAction={featureEventAction}
        deleteAction={deleteEventAction}
        designs={designs}
        uploadDesignAction={uploadEventDesignAction}
        toggleDesignAction={setEventDesignActiveAction}
        deleteDesignAction={deleteEventDesignAction}
      />
    </div>
  );
}
