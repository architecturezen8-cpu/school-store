"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowUpRight,
  CalendarClock,
  ExternalLink,
  ImagePlus,
  Loader2,
  Plus,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { Field, Notice, buttonClass, inputClass, labelClass } from "@/components/admin/ui";
import EventDesign, { type DesignSummary } from "@/components/admin/EventDesign";
import type { AdminEvent, EventDraft } from "@/lib/events";
import type { EventImage, EventLink, EventRule } from "@/data/seed";

/**
 * The event editor.
 *
 * A server action could not do this job. The parts an event needs — rules, gallery
 * photos, links, ticket tiers — are lists of unknown length, and a form made of
 * index-suffixed fields (`rules[2][title]`) is a parser and a half, with silent
 * drops the moment a row is added by the client. So the editor holds the draft in
 * state, shows the event as it will look while you type, and sends the whole thing
 * to one action as JSON, where it is validated again on the server.
 *
 * Photos upload one at a time as they are chosen (each is a `FormData` POST to an
 * action that returns the URL), so a 3 MB photo never has to survive a round trip
 * inside the form payload.
 */

type Props = {
  /** The event being edited, or a blank draft for a new one. */
  initial: EventDraft;
  mode: "create" | "update";
  /** Every slug already in use, for the "this address is taken" hint. */
  takenSlugs: string[];
  saveAction: (payload: string) => Promise<{ ok: boolean; error?: string; slug?: string }>;
  uploadAction: (formData: FormData) => Promise<{ ok: boolean; url?: string; error?: string }>;
  featureAction: (slug: string, on: boolean) => Promise<{ ok: boolean; error?: string }>;
  designs: DesignSummary[];
  uploadDesignAction: (formData: FormData) => Promise<{ ok: boolean; error?: string }>;
  toggleDesignAction: (id: string, active: boolean) => Promise<{ ok: boolean; error?: string }>;
  deleteDesignAction: (id: string) => Promise<{ ok: boolean; error?: string }>;
  deleteAction: (slug: string) => Promise<{ ok: boolean; error?: string }>;
  published?: boolean;
};

const blankRule = (): EventRule => ({ title: "", body: "" });
const blankLink = (): EventLink => ({ label: "", url: "" });

export default function EventEditor({
  initial,
  mode,
  takenSlugs,
  saveAction,
  uploadAction,
  featureAction,
  designs,
  uploadDesignAction,
  toggleDesignAction,
  deleteDesignAction,
  deleteAction,
}: Props) {
  const router = useRouter();
  const [draft, setDraft] = useState<EventDraft>(initial);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [uploading, setUploading] = useState<string | null>(null);

  const set = <K extends keyof EventDraft>(key: K, value: EventDraft[K]) =>
    setDraft((d) => ({ ...d, [key]: value }));

  /* ---------- lists ---------------------------------------------------- */

  const updateList = <T,>(key: "rules" | "gallery" | "links" | "tiers", i: number, patch: Partial<T>) =>
    setDraft((d) => {
      const list = [...(d[key] as unknown as T[])];
      list[i] = { ...list[i], ...patch };
      return { ...d, [key]: list } as EventDraft;
    });

  const removeAt = (key: "rules" | "gallery" | "links" | "tiers", i: number) =>
    setDraft((d) => {
      const list = [...(d[key] as unknown as unknown[])];
      list.splice(i, 1);
      return { ...d, [key]: list } as EventDraft;
    });

  const append = <T,>(key: "rules" | "gallery" | "links" | "tiers", item: T) =>
    setDraft((d) => ({ ...d, [key]: [...(d[key] as unknown as T[]), item] }) as EventDraft);

  /* ---------- uploads -------------------------------------------------- */

  const slugTaken =
    mode === "create" && Boolean(draft.slug) && takenSlugs.includes(draft.slug);

  /* What stops a save, said out loud next to the button. A disabled button with
     no reason is the single worst form of validation. */
  const blockers = [
    !draft.title.trim() ? "the event needs a name" : "",
    !draft.startsAt ? "set a start date and time" : "",
    !draft.slug ? "the web address is empty" : "",
    slugTaken ? `the address “${draft.slug}” is already used` : "",
    draft.tiers.some((t) => !t.name.trim()) ? "every ticket type needs a name" : "",
  ].filter(Boolean);

  async function upload(file: File, where: string): Promise<string | null> {
    setUploading(where);
    setError(null);
    try {
      const body = new FormData();
      body.set("image", file);
      const result = await uploadAction(body);
      if (!result.ok || !result.url) {
        setError(result.error ?? "That image could not be uploaded.");
        return null;
      }
      return result.url;
    } catch (err) {
      setError((err as Error).message || "That image could not be uploaded.");
      return null;
    } finally {
      setUploading(null);
    }
  }

  /* ---------- save ----------------------------------------------------- */

  function save() {
    setError(null);
    setNotice(null);
    startTransition(async () => {
      const result = await saveAction(JSON.stringify({ draft, mode }));
      if (!result.ok) {
        setError(result.error ?? "Could not save.");
        window.scrollTo({ top: 0, behavior: "smooth" });
        return;
      }
      setNotice(mode === "create" ? "Event created." : "Saved.");
      // A new event gets its own page; an edit stays put but refetches, so the
      // form shows what was actually written rather than what was typed.
      if (mode === "create" && result.slug) {
        router.push(`/admin/events/${result.slug}?ok=1`);
      } else {
        router.refresh();
      }
    });
  }

  function feature() {
    startTransition(async () => {
      const on = !draft.featured;
      const result = await featureAction(draft.slug, on);
      if (!result.ok) setError(result.error ?? "Could not change the spotlight.");
      else {
        // `draft` is seeded from props and never re-synced, so the label has to
        // follow the switch here or it lies until the page is reloaded.
        set("featured", on);
        setNotice(
          on
            ? "Added to the spotlight on /tickets."
            : "Removed from the spotlight on /tickets."
        );
        router.refresh();
      }
    });
  }

  function remove() {
    if (!confirm(`Delete “${draft.title || draft.slug}”? This cannot be undone.`)) return;
    startTransition(async () => {
      const result = await deleteAction(draft.slug);
      if (!result.ok) setError(result.error ?? "Could not delete that event.");
      else router.push("/admin/events");
    });
  }

  /* ---------- a small live preview of the card ------------------------- */

  const preview = useMemo(
    () => ({
      title: draft.title || "Untitled event",
      subtitle: draft.subtitle,
      date: draft.startsAt ? new Date(draft.startsAt) : null,
      image: draft.heroImage || draft.image,
      price: draft.tiers.length
        ? Math.min(...draft.tiers.map((t) => Number(t.price) || 0))
        : null,
    }),
    [draft.title, draft.subtitle, draft.startsAt, draft.heroImage, draft.image, draft.tiers]
  );

  return (
    <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_340px]">
      {/* ---------------- the form ---------------- */}
      <div className="space-y-3">
        {(error || notice) && (
          <div className="space-y-2">
            {error && <Notice tone="error">{error}</Notice>}
            {notice && <Notice tone="ok">{notice}</Notice>}
          </div>
        )}

        {/* ---- the facts ---- */}
        <section className="rounded-2xl bg-panel p-6">
          <h2 className="font-display text-lg font-semibold text-white">The essentials</h2>
          <p className="mt-1 text-sm text-white/60">
            These four lines are what the card on /tickets shows.
          </p>

          <div className="mt-5 space-y-4">
            <Field label="Event name">
              <input
                value={draft.title}
                onChange={(e) => set("title", e.target.value)}
                placeholder="The Big Match"
                className={inputClass}
              />
            </Field>

            <Field label="One-line teaser" hint="under the title on the card">
              <input
                value={draft.subtitle}
                onChange={(e) => set("subtitle", e.target.value)}
                placeholder="St. Thomas' College Matale vs St. Anthony's College Kandy"
                className={inputClass}
              />
            </Field>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Starts">
                <input
                  type="datetime-local"
                  value={draft.startsAt}
                  onChange={(e) => set("startsAt", e.target.value)}
                  className={inputClass}
                />
              </Field>
              <Field label="Ends" hint="optional">
                <input
                  type="datetime-local"
                  value={draft.endsAt}
                  onChange={(e) => set("endsAt", e.target.value)}
                  className={inputClass}
                />
              </Field>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Venue">
                <input
                  value={draft.venue}
                  onChange={(e) => set("venue", e.target.value)}
                  placeholder="College Grounds"
                  className={inputClass}
                />
              </Field>
              <Field label="City">
                <input
                  value={draft.city}
                  onChange={(e) => set("city", e.target.value)}
                  placeholder="Matale"
                  className={inputClass}
                />
              </Field>
            </div>

            <Field label="Doors / gate line" hint="shown beside the date">
              <input
                value={draft.doors}
                onChange={(e) => set("doors", e.target.value)}
                placeholder="Gates open 8:00 AM"
                className={inputClass}
              />
            </Field>
          </div>
        </section>

        {/* ---- the hero ---- */}
        <section className="rounded-2xl bg-panel p-6">
          <h2 className="font-display text-lg font-semibold text-white">The hero</h2>
          <p className="mt-1 text-sm text-white/60">
            The top of the event page. Upload a photograph — it is resized for you.
          </p>

          <div className="mt-5 space-y-4">
            <ImageField
              label="Hero photograph"
              hint="landscape works best"
              value={draft.heroImage}
              fallback={draft.image}
              busy={uploading === "hero"}
              onPick={async (file) => {
                const url = await upload(file, "hero");
                if (url) set("heroImage", url);
              }}
              onClear={() => set("heroImage", "")}
            />

            <Field label="Kicker" hint="the small line above the title">
              <input
                value={draft.heroKicker}
                onChange={(e) => set("heroKicker", e.target.value)}
                placeholder="Round 71 · One day only"
                className={inputClass}
              />
            </Field>

            <Field label="Tag" hint="the badge on the card">
              <input
                value={draft.tag}
                onChange={(e) => set("tag", e.target.value)}
                placeholder="Flagship Event"
                className={inputClass}
              />
            </Field>

            <Field label="Short summary" hint="the “In short” card">
              <textarea
                value={draft.tagline}
                onChange={(e) => set("tagline", e.target.value)}
                rows={3}
                placeholder="A full day of cricket — the stands, the tent, the band."
                className={`${inputClass} resize-y leading-relaxed`}
              />
            </Field>
          </div>
        </section>

        {/* ---- the story ---- */}
        <section className="rounded-2xl bg-panel p-6">
          <h2 className="font-display text-lg font-semibold text-white">The story</h2>
          <p className="mt-1 text-sm text-white/60">
            A blank line starts a new paragraph. The first one is set larger.
          </p>
          <textarea
            value={draft.story}
            onChange={(e) => set("story", e.target.value)}
            rows={10}
            placeholder={"The 71st encounter. A full day of cricket at the college grounds…\n\nBring a hat. Bring a friend. The band starts at ten."}
            className={`${inputClass} mt-4 resize-y leading-relaxed`}
          />
        </section>

        {/* ---- rules ---- */}
        <section className="rounded-2xl bg-panel p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="font-display text-lg font-semibold text-white">Rules & entry</h2>
              <p className="mt-1 text-sm text-white/60">
                Numbered on the page, in this order.
              </p>
            </div>
            <button
              type="button"
              onClick={() => append<EventRule>("rules", blankRule())}
              className={`${buttonClass("secondary")} !px-3 !py-1.5 !text-xs`}
            >
              <Plus className="h-3.5 w-3.5" /> Add a rule
            </button>
          </div>

          {draft.rules.length === 0 ? (
            <p className="mt-4 rounded-xl bg-well px-4 py-6 text-center text-sm text-white/50">
              No rules yet. Nothing is shown on the page until you add one.
            </p>
          ) : (
            <ul className="mt-4 space-y-3">
              {draft.rules.map((r, i) => (
                <li key={i} className="rounded-xl bg-well p-4">
                  <div className="flex items-start gap-3">
                    <span className="mt-2 font-display text-sm text-gold/70">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <div className="min-w-0 flex-1 space-y-2">
                      <input
                        value={r.title}
                        onChange={(e) => updateList<EventRule>("rules", i, { title: e.target.value })}
                        placeholder="No glass bottles"
                        aria-label={`Rule ${i + 1} title`}
                        className={inputClass}
                      />
                      <textarea
                        value={r.body}
                        onChange={(e) => updateList<EventRule>("rules", i, { body: e.target.value })}
                        rows={2}
                        placeholder="Anything in a bottle goes in a cup at the gate."
                        aria-label={`Rule ${i + 1} detail`}
                        className={`${inputClass} resize-y leading-relaxed`}
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => removeAt("rules", i)}
                      aria-label={`Remove rule ${i + 1}`}
                      className="mt-1 grid h-8 w-8 shrink-0 place-items-center rounded-lg text-white/50 hover:bg-white/10 hover:text-white"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* ---- gallery ---- */}
        <section className="rounded-2xl bg-panel p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="font-display text-lg font-semibold text-white">Gallery</h2>
              <p className="mt-1 text-sm text-white/60">
                Photographs from previous years. Three or more fills the grid.
              </p>
            </div>
            <label
              className={`${buttonClass("secondary")} cursor-pointer !px-3 !py-1.5 !text-xs ${
                uploading === "gallery" ? "opacity-60" : ""
              }`}
            >
              {uploading === "gallery" ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <ImagePlus className="h-3.5 w-3.5" />
              )}
              Add photo
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                aria-label="Add a gallery photo"
                className="sr-only"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  e.target.value = "";
                  if (!file) return;
                  const url = await upload(file, "gallery");
                  if (url) append<EventImage>("gallery", { url });
                }}
              />
            </label>
          </div>

          {draft.gallery.length === 0 ? (
            <p className="mt-4 rounded-xl bg-well px-4 py-6 text-center text-sm text-white/50">
              No photographs yet.
            </p>
          ) : (
            <ul className="mt-4 grid gap-3 sm:grid-cols-2">
              {draft.gallery.map((g, i) => (
                <li key={`${g.url}-${i}`} className="rounded-xl bg-well p-3">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={g.url} alt="" className="h-28 w-full rounded-lg object-cover" />
                  <div className="mt-2 flex items-center gap-2">
                    <input
                      value={g.caption ?? ""}
                      onChange={(e) =>
                        updateList<EventImage>("gallery", i, { caption: e.target.value })
                      }
                      placeholder="Caption (optional)"
                      aria-label={`Caption for photo ${i + 1}`}
                      className={inputClass}
                    />
                    <button
                      type="button"
                      onClick={() => {
                        removeAt("gallery", i);
                      }}
                      aria-label={`Remove photo ${i + 1}`}
                      className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-white/50 hover:bg-white/10 hover:text-white"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* ---- links ---- */}
        <section className="rounded-2xl bg-panel p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="font-display text-lg font-semibold text-white">Links</h2>
              <p className="mt-1 text-sm text-white/60">
                The schedule, a map, the old boys&apos; page — anywhere else to look.
              </p>
            </div>
            <button
              type="button"
              onClick={() => append<EventLink>("links", blankLink())}
              className={`${buttonClass("secondary")} !px-3 !py-1.5 !text-xs`}
            >
              <Plus className="h-3.5 w-3.5" /> Add a link
            </button>
          </div>

          {draft.links.length === 0 ? (
            <p className="mt-4 rounded-xl bg-well px-4 py-6 text-center text-sm text-white/50">
              No links yet.
            </p>
          ) : (
            <ul className="mt-4 space-y-3">
              {draft.links.map((l, i) => (
                <li key={i} className="flex items-start gap-2">
                  <div className="grid min-w-0 flex-1 gap-2 sm:grid-cols-2">
                    <input
                      value={l.label}
                      onChange={(e) => updateList<EventLink>("links", i, { label: e.target.value })}
                      placeholder="Match schedule"
                      aria-label={`Link ${i + 1} label`}
                      className={inputClass}
                    />
                    <input
                      value={l.url}
                      onChange={(e) => updateList<EventLink>("links", i, { url: e.target.value })}
                      placeholder="https://… or /shop"
                      aria-label={`Link ${i + 1} address`}
                      className={inputClass}
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => removeAt("links", i)}
                    aria-label={`Remove link ${i + 1}`}
                    className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-white/50 hover:bg-white/10 hover:text-white"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* ---- tiers ---- */}
        <section className="rounded-2xl bg-panel p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="font-display text-lg font-semibold text-white">
                Ticket types & the design
              </h2>
              <p className="mt-1 text-sm text-white/60">
                Each type is its own price. Sold-out types cannot be removed — the
                bookings still point at them.
              </p>
            </div>
            <button
              type="button"
              onClick={() =>
                append("tiers", {
                  id: `tier-${Date.now().toString(36)}`,
                  name: "",
                  price: 0,
                  perks: [],
                })
              }
              className={`${buttonClass("secondary")} !px-3 !py-1.5 !text-xs`}
            >
              <Plus className="h-3.5 w-3.5" /> Add a type
            </button>
          </div>

          {draft.tiers.length === 0 ? (
            <p className="mt-4 rounded-xl bg-well px-4 py-6 text-center text-sm text-white/50">
              No ticket types — the event cannot be booked.
            </p>
          ) : (
            <ul className="mt-4 space-y-3">
              {draft.tiers.map((t, i) => (
                <li key={t.id} className="rounded-xl bg-well p-4">
                  <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_120px_auto] sm:items-center">
                    <input
                      value={t.name}
                      onChange={(e) => updateList<"tiers">("tiers", i, { name: e.target.value } as never)}
                      placeholder="Grandstand"
                      aria-label={`Ticket type ${i + 1} name`}
                      className={inputClass}
                    />
                    <input
                      type="number"
                      min={0}
                      step={50}
                      value={t.price}
                      onChange={(e) =>
                        updateList<"tiers">("tiers", i, { price: Number(e.target.value) } as never)
                      }
                      aria-label={`Ticket type ${i + 1} price`}
                      className={inputClass}
                    />
                    <button
                      type="button"
                      onClick={() => removeAt("tiers", i)}
                      aria-label={`Remove ticket type ${i + 1}`}
                      className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-white/50 hover:bg-white/10 hover:text-white"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                  <input
                    value={(t.perks ?? []).join(", ")}
                    onChange={(e) =>
                      updateList<"tiers">(
                        "tiers",
                        i,
                        { perks: e.target.value.split(",").map((p) => p.trim()).filter(Boolean) } as never
                      )
                    }
                    placeholder="Perks, comma separated — shaded seat, free programme"
                    aria-label={`Ticket type ${i + 1} perks`}
                    className={inputClass}
                  />
                  <p className="mt-1.5 text-[11px] text-white/60">
                    id <code className="text-white/60">{t.id}</code>
                  </p>
                </li>
              ))}
            </ul>
          )}

        </section>

        {/* ---- artwork ---- */}
        <EventDesign
          designs={designs}
          onUpload={(formData) => {
            formData.set("event", draft.slug);
            return uploadDesignAction(formData);
          }}
          onToggle={toggleDesignAction}
          onDelete={deleteDesignAction}
        />

        {/* ---- switches ---- */}
        <section className="rounded-2xl bg-panel p-6">
          <h2 className="font-display text-lg font-semibold text-white">On sale</h2>
          <div className="mt-4 space-y-3">
            <label className="flex cursor-pointer items-start gap-3">
              <input
                type="checkbox"
                checked={draft.published}
                onChange={(e) => set("published", e.target.checked)}
                className="mt-1 h-4 w-4 accent-gold"
              />
              <span>
                <span className="block text-sm text-white">Published</span>
                <span className="block text-xs text-white/55">
                  Off means the page 404s and the event disappears from /tickets.
                </span>
              </span>
            </label>
            <label className="flex cursor-pointer items-start gap-3">
              <input
                type="checkbox"
                checked={draft.featured}
                onChange={(e) => set("featured", e.target.checked)}
                className="mt-1 h-4 w-4 accent-gold"
              />
              <span>
                <span className="block text-sm text-white">Show in the /tickets spotlight</span>
                <span className="block text-xs text-white/55">
                  Each spotlight event gets its own big hero with a countdown. Turn on as
                  many as you like — the first one in the list leads the page.
                </span>
              </span>
            </label>
            <Field label="Order" hint="lower comes first">
              <input
                type="number"
                value={draft.position}
                onChange={(e) => set("position", Number(e.target.value))}
                className={inputClass}
              />
            </Field>
          </div>
        </section>

        <section className="rounded-2xl bg-panel p-6">
          <Field label="Web address" hint="lowercase, dashes">
            <input
              value={draft.slug}
              onChange={(e) =>
                set("slug", e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-"))
              }
              disabled={mode === "update"}
              className={`${inputClass} font-mono disabled:opacity-60`}
            />
          </Field>
          <p className="mt-2 text-[11px] leading-relaxed text-white/50">
            {mode === "update"
              ? "The address is fixed after the first save — tickets already printed point at it."
              : slugTaken
                ? "That address is already used by another event."
                : `/events/${draft.slug || "…"}`}
          </p>

          {blockers.length > 0 && (
            <p className="mt-3 rounded-lg bg-well px-3 py-2 text-[11.5px] leading-relaxed text-white/65">
              Before you can save: {blockers.join(" · ")}.
            </p>
          )}

          <div className="mt-5 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={save}
              disabled={pending}
              className={buttonClass("primary")}
            >
              {pending && <Loader2 className="h-4 w-4 animate-spin" />}
              {mode === "create" ? "Create event" : "Save changes"}
            </button>
            {mode === "update" && (
              <>
                <Link
                  href={`/events/${draft.slug}`}
                  target="_blank"
                  className={buttonClass("secondary")}
                >
                  <ExternalLink className="h-4 w-4" /> View page
                </Link>
                <button
                  type="button"
                  onClick={feature}
                  disabled={pending}
                  className={buttonClass("ghost")}
                >
                  <CalendarClock className="h-4 w-4" />
                  {draft.featured ? "Remove from spotlight" : "Add to spotlight"}
                </button>
                <button
                  type="button"
                  onClick={remove}
                  disabled={pending}
                  className={`${buttonClass("danger")} ml-auto`}
                >
                  <Trash2 className="h-4 w-4" /> Delete
                </button>
              </>
            )}
          </div>
        </section>
      </div>

      {/* ---------------- the rail ---------------- */}
      {/* a layout column, not a landmark — the page already has one <aside> */}
      <div className="space-y-3 xl:sticky xl:top-3 xl:h-fit">
        <div className="rounded-2xl bg-panel p-4">
          <p className={labelClass}>On the tickets page</p>
          <div className="mt-3 overflow-hidden rounded-xl bg-well">
            <div className="relative h-32">
              {preview.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={preview.image} alt="" className="h-full w-full object-cover" />
              ) : (
                <div className="grid h-full place-items-center text-white/30">
                  <ImagePlus className="h-6 w-6" />
                </div>
              )}
              {preview.date && (
                <span className="absolute bottom-2 left-3 rounded-md bg-ink/85 px-2 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-white">
                  {preview.date.toLocaleDateString("en-GB", {
                    day: "numeric",
                    month: "short",
                  })}
                </span>
              )}
            </div>
            <div className="p-4">
              <p className="font-display text-[15px] font-semibold leading-tight text-white">
                {preview.title}
              </p>
              <p className="mt-1 line-clamp-2 text-[11.5px] leading-relaxed text-white/55">
                {preview.subtitle || "—"}
              </p>
              <p className="mt-2 text-[11px] text-white/60">
                {preview.price === null
                  ? "no tickets"
                  : preview.price === 0
                    ? "Free"
                    : `From LKR ${preview.price.toLocaleString("en-LK")}`}
              </p>
            </div>
          </div>
          <p className="mt-3 text-[11px] leading-relaxed text-white/50">
            A thumbnail of the card. The page itself has the hero, the story, the rules,
            the gallery and the links above.
          </p>
        </div>

        {!draft.published && (
          <div className="rounded-2xl bg-panel p-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-gold">
              Draft
            </p>
            <p className="mt-1.5 text-xs leading-relaxed text-white/55">
              Not published — nobody can see this yet. Tick “Published” and save when it is
              ready.
            </p>
          </div>
        )}

        <div className="rounded-2xl bg-panel p-4">
          <p className={labelClass}>How it reads</p>
          <ul className="mt-2 space-y-1.5 text-[11.5px] text-white/55">
            <li>{draft.rules.length} rules</li>
            <li>{draft.gallery.length} gallery photos</li>
            <li>{draft.links.length} links</li>
            <li>{draft.tiers.length} ticket types</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */

function ImageField({
  label,
  hint,
  value,
  fallback,
  busy,
  onPick,
  onClear,
}: {
  label: string;
  hint?: string;
  value: string;
  fallback?: string;
  busy: boolean;
  onPick: (file: File) => void | Promise<void>;
  onClear: () => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const shown = value || fallback || "";

  return (
    <div>
      <span className="flex items-baseline justify-between gap-3">
        <span className={labelClass}>{label}</span>
        {hint && <span className="text-[11px] text-white/60">{hint}</span>}
      </span>

      <div className="mt-2 flex items-start gap-3">
        <div className="relative h-24 w-40 shrink-0 overflow-hidden rounded-xl bg-well">
          {shown ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={shown} alt="" className="h-full w-full object-cover" />
          ) : (
            <div className="grid h-full place-items-center text-white/30">
              <ImagePlus className="h-5 w-5" />
            </div>
          )}
          {busy && (
            <div className="absolute inset-0 grid place-items-center bg-black/60">
              <Loader2 className="h-5 w-5 animate-spin text-white" />
            </div>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => input.current?.click()}
            className={`${buttonClass("secondary")} !px-3 !py-2 !text-xs`}
            disabled={busy}
          >
            <Upload className="h-3.5 w-3.5" /> {value ? "Replace" : "Upload"}
          </button>
          {value && (
            <button
              type="button"
              onClick={onClear}
              className={`${buttonClass("ghost")} !px-3 !py-2 !text-xs`}
            >
              <X className="h-3.5 w-3.5" /> Remove
            </button>
          )}
          <input
            ref={input}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            aria-label="Upload the hero image"
            className="sr-only"
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              if (file) void onPick(file);
            }}
          />
        </div>
      </div>

      {!value && fallback && (
        <p className="mt-2 text-[11px] text-white/60">
          Showing the card image. Upload a hero to use a different photograph.
        </p>
      )}
    </div>
  );
}
