import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { isAdmin } from "@/lib/admin/auth";
import { hasDatabase } from "@/lib/db";
import { listTemplates } from "@/lib/tickets/templates";
import { getEvents } from "@/lib/store";
import { safeDecode } from "@/lib/safe-decode";
import { uploadTemplateAction, toggleTemplateAction, deleteTemplateAction } from "../actions";
import {
  Empty,
  Field,
  Notice,
  PageHeader,
  Panel,
  Pill,
  buttonClass,
  inputClass,
  selectClass,
} from "@/components/admin/ui";
import { ImageUp, Trash2 } from "lucide-react";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Ticket designs",
  robots: { index: false, follow: false },
};

export default async function TemplatesPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; ok?: string }>;
}) {
  if (!(await isAdmin())) redirect("/admin?next=/admin/templates");
  if (!hasDatabase()) redirect("/admin?error=database");

  const { error, ok } = await searchParams;
  const [templates, events] = await Promise.all([listTemplates(), getEvents()]);

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-10 lg:py-10">
      <PageHeader
        eyebrow="Tickets"
        title="Ticket designs"
        description="Upload the artwork the customer receives. Leave a solid white square where the QR belongs — the code is detected and pasted in automatically."
      />

      <div className="mt-6 space-y-3">
        {ok && <Notice tone="ok">Saved “{safeDecode(ok)}”. New bookings use it.</Notice>}
        {error && <Notice tone="error">{safeDecode(error)}</Notice>}
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,340px)_minmax(0,1fr)]">
        {/* ---------------- upload ---------------- */}
        <Panel title="Upload a design">
          <form action={uploadTemplateAction} className="space-y-4">
            <Field label="Design name">
              <input name="name" required placeholder="Big Match 2027" className={inputClass} />
            </Field>

            <Field label="Event" hint="blank = all events">
              <select name="event" defaultValue="" className={selectClass}>
                <option value="">All events (default)</option>
                {events.map((e) => (
                  <option key={e.slug} value={e.slug}>
                    {e.title}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Slug" hint="optional">
              <input name="slug" placeholder="big-match-2027" className={inputClass} />
            </Field>

            <Field label="Image" hint="PNG · JPEG · WebP, 8 MB">
              <input
                type="file"
                name="design"
                accept="image/png,image/jpeg,image/webp"
                required
                className={`${inputClass} file:mr-3 file:rounded-md file:border-0 file:bg-gold file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-navy-950`}
              />
            </Field>

            <button type="submit" className={`${buttonClass("primary")} w-full`}>
              <ImageUp className="h-4 w-4" /> Upload and detect the square
            </button>
          </form>

          <div className="mt-5 space-y-2 border-t border-navy-700 pt-4 text-xs leading-relaxed text-white/65">
            <p>
              <span className="text-white/70">The square matters.</span> Equal width and height, at
              least 160px, pure white (no off-white, no transparency).
            </p>
            <p>
              The QR fills about 80% of it, so a thin margin stays white and the code still scans.
            </p>
          </div>
        </Panel>

        {/* ---------------- existing ---------------- */}
        <Panel
          title="Uploaded designs"
          description={`${templates.length} on file. The newest design for an event wins.`}
        >
          {templates.length === 0 ? (
            <Empty>Nothing uploaded yet — tickets fall back to a plain generated design.</Empty>
          ) : (
            <ul className="space-y-3">
              {templates.map((t) => (
                <li
                  key={t.id}
                  className="flex flex-wrap items-center gap-4 rounded-lg border border-navy-700 bg-navy-950 p-3"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={t.file}
                    alt={t.name}
                    className="h-20 w-28 flex-none rounded-md border border-navy-700 object-cover"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-center gap-2 text-sm text-white">
                      {t.name}
                      {t.isActive ? <Pill tone="ok">live</Pill> : <Pill>off</Pill>}
                    </p>
                    <p className="mt-1 text-xs text-white/60">
                      {t.event ?? "all events"} · {t.width}×{t.height} · QR {t.qrSize}px
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <form action={toggleTemplateAction}>
                      <input type="hidden" name="id" value={t.id} />
                      <input type="hidden" name="active" value={String(!t.isActive)} />
                      <button type="submit" className={`${buttonClass("ghost")} !px-3 !py-1.5 !text-xs`}>
                        {t.isActive ? "Turn off" : "Turn on"}
                      </button>
                    </form>
                    <form action={deleteTemplateAction}>
                      <input type="hidden" name="id" value={t.id} />
                      <button type="submit" className={`${buttonClass("danger")} !px-3 !py-1.5 !text-xs`}>
                        <Trash2 className="h-3.5 w-3.5" /> Delete
                      </button>
                    </form>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </div>
  );
}
