import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { isAdmin } from "@/lib/admin/auth";
import { databaseProblem } from "@/lib/admin/db-guard";
import { hasDatabase } from "@/lib/db";
import { blankDraft, listAllEvents } from "@/lib/events";
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
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "New event",
  robots: { index: false, follow: false },
};

export default async function NewEventPage() {
  if (!(await isAdmin())) redirect("/admin?next=/admin/events/new");
  if (!hasDatabase()) redirect("/admin?error=database");

  const problem = databaseProblem();
  const existing = await listAllEvents();

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
            title="New event"
            description="Fill in what you have — a name and a date is enough to start. Everything below the essentials shows on the event page once it has content."
          />
        </div>
        {problem && (
          <div className="mt-4">
            <Notice tone="warn">{problem}</Notice>
          </div>
        )}
      </section>

      <EventEditor
        initial={blankDraft()}
        mode="create"
        takenSlugs={existing.map((e) => e.slug)}
        saveAction={saveEventAction}
        uploadAction={uploadEventImageAction}
        featureAction={featureEventAction}
        deleteAction={deleteEventAction}
        designs={[]}
        uploadDesignAction={uploadEventDesignAction}
        toggleDesignAction={setEventDesignActiveAction}
        deleteDesignAction={deleteEventDesignAction}
      />
    </div>
  );
}
