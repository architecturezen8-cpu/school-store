import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { isAdmin } from "@/lib/admin/auth";
import { hasDatabase } from "@/lib/db";
import { listTemplates } from "@/lib/tickets/templates";
import { getEvents } from "@/lib/store";
import { uploadTemplateAction, toggleTemplateAction, deleteTemplateAction } from "../actions";
import { ArrowLeft, Check, ImageUp, Trash2 } from "lucide-react";

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
    <section className="mx-auto max-w-4xl px-6 pb-20 pt-32 md:pt-36">
      <Link href="/admin" className="inline-flex items-center gap-2 text-sm text-white/65 hover:text-white">
        <ArrowLeft className="h-4 w-4" /> Admin
      </Link>

      <h1 className="mt-4 font-display text-3xl font-semibold text-white">Ticket designs</h1>
      <p className="mt-2 max-w-2xl text-sm text-white/70">
        Upload the artwork the customer will receive. Leave a{" "}
        <strong className="text-white/80">solid white square</strong> where the QR code
        belongs — that is the only instruction. The square needs equal width and
        height and at least 160px. The QR is pasted inside it, using about 80% of
        its area, so a little breathing room is built in.
      </p>

      {ok && (
        <p className="mt-6 flex items-center gap-2 rounded-xl border border-emerald-400/40 bg-emerald-500/10 p-3 text-sm text-emerald-200">
          <Check className="h-4 w-4" /> Saved “{decodeURIComponent(ok)}”. New bookings use it.
        </p>
      )}
      {error && (
        <p className="mt-6 rounded-xl border border-red-400/40 bg-red-500/10 p-3 text-sm text-red-200">
          {decodeURIComponent(error)}
        </p>
      )}

      {/* ---------- upload ---------- */}
      <form
        action={uploadTemplateAction}
        className="mt-8 space-y-4 rounded-2xl border border-white/10 bg-white/[0.03] p-6"
      >
        <h2 className="flex items-center gap-2 font-display text-lg text-white">
          <ImageUp className="h-5 w-5 text-gold" /> Upload a design
        </h2>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="text-[11px] uppercase tracking-[0.2em] text-white/65">Design name</span>
            <input
              name="name"
              required
              placeholder="Big Match 2027"
              className="mt-1 w-full rounded-xl border border-white/15 bg-white/[0.04] px-4 py-3 text-sm text-white outline-none focus:border-gold/60"
            />
          </label>

          <label className="block">
            <span className="text-[11px] uppercase tracking-[0.2em] text-white/65">
              Event (blank = all events)
            </span>
            <select
              name="event"
              defaultValue=""
              className="mt-1 w-full rounded-xl border border-white/15 bg-navy-900 px-4 py-3 text-sm text-white outline-none focus:border-gold/60"
            >
              <option value="">All events (default)</option>
              {events.map((e) => (
                <option key={e.slug} value={e.slug}>
                  {e.title}
                </option>
              ))}
            </select>
          </label>
        </div>

        <label className="block">
          <span className="text-[11px] uppercase tracking-[0.2em] text-white/65">
            Slug (optional — generated from the name)
          </span>
          <input
            name="slug"
            placeholder="big-match-2027"
            className="mt-1 w-full rounded-xl border border-white/15 bg-white/[0.04] px-4 py-3 text-sm text-white outline-none focus:border-gold/60"
          />
        </label>

        <label className="block">
          <span className="text-[11px] uppercase tracking-[0.2em] text-white/65">
            Image (PNG, JPEG or WebP · max 8 MB)
          </span>
          <input
            type="file"
            name="design"
            accept="image/png,image/jpeg,image/webp"
            required
            className="mt-1 w-full rounded-xl border border-white/15 bg-white/[0.04] px-4 py-3 text-sm text-white/80 file:mr-3 file:rounded-lg file:border-0 file:bg-gold file:px-3 file:py-1.5 file:text-navy-950"
          />
        </label>

        <button
          type="submit"
          className="w-full rounded-xl bg-gold px-4 py-3 text-sm font-semibold text-navy-950"
        >
          Upload and detect the square
        </button>
      </form>

      {/* ---------- existing ---------- */}
      <section className="mt-10">
        <h2 className="font-display text-xl text-white">Uploaded designs</h2>
        {templates.length === 0 ? (
          <p className="mt-3 text-sm text-white/65">
            Nothing uploaded yet — new tickets fall back to a plain generated design.
          </p>
        ) : (
          <ul className="mt-4 space-y-3">
            {templates.map((t) => (
              <li
                key={t.id}
                className="flex flex-wrap items-center gap-4 rounded-2xl border border-white/10 bg-white/[0.02] p-4"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={t.file}
                  alt={t.name}
                  className="h-20 w-32 flex-none rounded-lg border border-white/10 object-cover"
                />
                <div className="min-w-0 flex-1">
                  <p className="text-white">
                    {t.name}{" "}
                    {!t.isActive && (
                      <span className="ml-2 rounded-full bg-white/10 px-2 py-0.5 text-[11px] text-white/60">
                        off
                      </span>
                    )}
                  </p>
                  <p className="text-xs text-white/65">
                    {t.event ?? "all events"} · {t.width}×{t.height} · QR{" "}
                    {t.qrSize}px at {t.qrX},{t.qrY}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <form action={toggleTemplateAction}>
                    <input type="hidden" name="id" value={t.id} />
                    <input type="hidden" name="active" value={String(!t.isActive)} />
                    <button
                      type="submit"
                      className="rounded-lg border border-white/15 px-3 py-2 text-xs text-white/70"
                    >
                      {t.isActive ? "Turn off" : "Turn on"}
                    </button>
                  </form>
                  <form action={deleteTemplateAction}>
                    <input type="hidden" name="id" value={t.id} />
                    <button
                      type="submit"
                      className="inline-flex items-center gap-1 rounded-lg border border-red-400/30 px-3 py-2 text-xs text-red-300"
                    >
                      <Trash2 className="h-3.5 w-3.5" /> Delete
                    </button>
                  </form>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </section>
  );
}
