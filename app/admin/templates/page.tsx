import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { isAdmin } from "@/lib/admin/auth";
import { databaseProblem } from "@/lib/admin/db-guard";
import { databaseDown } from "@/lib/db";
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
  const problem = databaseProblem();
  // The design list is the one read here that has no seed fallback, so a dead
  // database would otherwise mean an empty page with no explanation.
  const [templates, events] = await Promise.all([
    databaseDown() ? Promise.resolve([]) : listTemplates(),
    getEvents(),
  ]);

  return (
    <div className="space-y-3">
      <section className="rounded-2xl bg-panel p-6">
        <PageHeader
          eyebrow="Tickets"
          title="Ticket designs"
          description="Upload the artwork the customer receives. Leave a solid white square where the QR belongs — the code is detected and pasted in automatically."
        />
        {problem && (
          <div className="mt-4">
            <Notice tone="warn">{problem}</Notice>
          </div>
        )}

        {(ok || error) && (
          <div className="mt-4 space-y-2">
            {ok && <Notice tone="ok">Saved “{safeDecode(ok)}”. New bookings use it.</Notice>}
            {error && <Notice tone="error">{safeDecode(error)}</Notice>}
          </div>
        )}
      </section>

      <div className="grid gap-3 xl:grid-cols-[minmax(0,360px)_minmax(0,1fr)]">
        {/* ---------------- upload ---------------- */}
        <div className="space-y-3">
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
                  className={`${inputClass} file:mr-3 file:rounded-lg file:border-0 file:bg-white file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-black`}
                />
              </Field>

              <button type="submit" className={`${buttonClass("primary")} w-full`}>
                <ImageUp className="h-4 w-4" /> Upload and detect the square
              </button>
            </form>
          </Panel>

          <Panel title="The square matters" tone="sunken">
            <ul className="space-y-3 text-xs leading-relaxed text-white/65">
              <li>
                <span className="text-white/80">Shape.</span> Equal width and height, at least
                160px, pure white — no off-white, no transparency.
              </li>
              <li>
                <span className="text-white/80">Fit.</span> The QR fills about 80% of it, so a thin
                white margin stays around the code.
              </li>
              <li>
                <span className="text-white/80">Nothing on top.</span> No logo, no text and no
                texture inside the square.
              </li>
            </ul>
          </Panel>
        </div>

        {/* ---------------- existing ---------------- */}
        <Panel
          title="Uploaded designs"
          description={`${templates.length} on file. The newest design for an event wins.`}
        >
          {templates.length === 0 ? (
            <Empty>Nothing uploaded yet — tickets fall back to a plain generated design.</Empty>
          ) : (
            <ul className="grid gap-3 sm:grid-cols-2">
              {templates.map((t) => (
                <li key={t.id} className="flex flex-col rounded-xl bg-well p-3">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={t.file}
                    alt={t.name}
                    className="h-28 w-full rounded-lg object-cover"
                  />
                  <div className="mt-3 flex items-start justify-between gap-2">
                    <p className="min-w-0 truncate text-sm text-white">{t.name}</p>
                    {t.isActive ? <Pill tone="ok">live</Pill> : <Pill>off</Pill>}
                  </div>
                  <p className="mt-1 text-[11px] text-white/65">
                    {t.event ?? "all events"} · {t.width}×{t.height} · QR {t.qrSize}px
                  </p>
                  <div className="mt-3 flex items-center gap-2">
                    <form action={toggleTemplateAction}>
                      <input type="hidden" name="id" value={t.id} />
                      <input type="hidden" name="active" value={String(!t.isActive)} />
                      <button
                        type="submit"
                        className={`${buttonClass("secondary")} !px-3 !py-1.5 !text-xs`}
                      >
                        {t.isActive ? "Turn off" : "Turn on"}
                      </button>
                    </form>
                    <form action={deleteTemplateAction}>
                      <input type="hidden" name="id" value={t.id} />
                      <button
                        type="submit"
                        className={`${buttonClass("danger")} !px-3 !py-1.5 !text-xs`}
                      >
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
