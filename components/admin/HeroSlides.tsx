"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ImagePlus, Loader2, Save, Trash2 } from "lucide-react";
import AdminImage from "@/components/admin/AdminImage";
import { Notice, PageHeader, buttonClass, inputClass, labelClass } from "@/components/admin/ui";
import { useToast } from "@/components/admin/Toasts";
import type { HeroSlide } from "@/lib/hero";
import {
  deleteHeroSlideAction,
  importSeedHeroAction,
  saveHeroSlideAction,
  uploadHeroImageAction,
} from "@/app/admin/actions";

/**
 * The photographs behind the school's name on the home page.
 *
 * The hero is the first thing a visitor sees and the last thing that should need
 * a developer: three pictures that can be swapped for sports day, for the prize
 * giving, for the new term. Each slide carries its own caption, which is also
 * what a screen reader reads, so the words move with the picture.
 *
 * The file is uploaded the moment it is chosen — the admin can see the real
 * photograph at the real shape before deciding to keep it — and the slide is
 * saved separately, so a mistaken pick costs a press and not a row.
 */
export default function HeroSlides({
  initial,
  showing,
  saved,
  problem,
}: {
  initial: HeroSlide[];
  /** What the home page is showing — the built-in three until they import. */
  showing: HeroSlide[];
  saved: boolean;
  problem: string;
}) {
  const router = useRouter();
  const toast = useToast();
  const [, startTransition] = useTransition();

  const [slides, setSlides] = useState(initial);
  const [busy, setBusy] = useState<string | null>(null);

  // the "add a slide" card, kept private until it is saved
  const [draft, setDraft] = useState({ image: "", caption: "" });
  const draftFile = useRef<HTMLInputElement>(null);

  const refresh = () => startTransition(() => router.refresh());

  async function pick(file: File, target: { id?: string }) {
    setBusy(target.id ?? "new");
    try {
      const body = new FormData();
      body.set("image", file);
      const uploaded = await uploadHeroImageAction(body);
      if (!uploaded.ok) {
        toast({ tone: "error", title: "That photograph was not saved", body: uploaded.error });
        return;
      }

      if (!target.id) {
        setDraft((d) => ({ ...d, image: uploaded.url }));
        toast({ tone: "ok", title: "Photograph ready", body: "Add a caption, then save the slide." });
        return;
      }

      // Replacing a slide's picture keeps its caption and its place in the run.
      const slide = slides.find((s) => s.id === target.id);
      const result = await saveHeroSlideAction({
        id: target.id,
        image: uploaded.url,
        caption: slide?.caption ?? "",
      });
      if (!result.ok) {
        toast({ tone: "error", title: "That photograph was not saved", body: result.error });
        return;
      }
      setSlides((list) => list.map((s) => (s.id === target.id ? { ...s, image: uploaded.url } : s)));
      toast({ tone: "ok", title: "Slide replaced", body: "The home page shows it on the next reload." });
      refresh();
    } catch (err) {
      toast({ tone: "error", title: "That photograph was not saved", body: (err as Error).message });
    } finally {
      setBusy(null);
    }
  }

  async function saveCaption(slide: HeroSlide) {
    setBusy(slide.id);
    try {
      const result = await saveHeroSlideAction({
        id: slide.id,
        image: slide.image,
        caption: slide.caption,
      });
      if (!result.ok) {
        toast({ tone: "error", title: "Caption not saved", body: result.error });
        return;
      }
      toast({ tone: "ok", title: "Caption saved" });
      refresh();
    } finally {
      setBusy(null);
    }
  }

  async function addSlide() {
    if (!draft.image) {
      toast({ tone: "error", title: "Choose a photograph first" });
      return;
    }
    setBusy("new");
    try {
      const result = await saveHeroSlideAction({ image: draft.image, caption: draft.caption });
      if (!result.ok) {
        toast({ tone: "error", title: "Slide not added", body: result.error });
        return;
      }
      const added: HeroSlide = {
        id: result.id,
        image: draft.image,
        caption: draft.caption.trim(),
        position: slides.length,
      };
      setSlides((list) => [...list, added]);
      setDraft({ image: "", caption: "" });
      if (draftFile.current) draftFile.current.value = "";
      toast({ tone: "ok", title: "Slide added", body: "It is in the run from the next page load." });
      refresh();
    } catch (err) {
      toast({ tone: "error", title: "Slide not added", body: (err as Error).message });
    } finally {
      setBusy(null);
    }
  }

  async function remove(slide: HeroSlide) {
    setBusy(slide.id);
    try {
      const result = await deleteHeroSlideAction({ id: slide.id, image: slide.image });
      if (!result.ok) {
        toast({ tone: "error", title: "Slide not removed", body: result.error });
        return;
      }
      setSlides((list) => list.filter((s) => s.id !== slide.id));
      toast({ tone: "ok", title: "Slide removed" });
      refresh();
    } finally {
      setBusy(null);
    }
  }

  async function importBuiltIn() {
    setBusy("import");
    try {
      const result = await importSeedHeroAction();
      if (!result.ok) {
        toast({ tone: "error", title: "Could not copy the built-in slides", body: result.error });
        return;
      }
      toast({ tone: "ok", title: "Copied", body: `${result.count} slides are now yours to change.` });
      refresh();
    } finally {
      setBusy(null);
    }
  }

  return (
    <>
      <PageHeader
        eyebrow="Home page"
        title="Hero slideshow"
        description="The photographs behind the school's name at the top of the shop. They run in the order below, changing every six and a half seconds. Use wide, bright pictures — the words sit on top of them."
      />

      {problem && (
        <div className="mt-4">
          <Notice tone="warn">{problem}</Notice>
        </div>
      )}

      {!saved && (
        <div className="mt-4 rounded-xl bg-well p-4">
          <p className="text-sm text-body">
            The home page is showing the {showing.length} photographs that came with the app.
            Copy them here to start changing them — after that, what is on this page is exactly
            what visitors see.
          </p>
          <div className="mt-3 grid gap-2 sm:grid-cols-3">
            {showing.map((slide, i) => (
              <figure key={slide.id} className="overflow-hidden rounded-lg">
                <AdminImage src={slide.image} alt={slide.caption || `Built-in slide ${i + 1}`} className="aspect-[16/9] w-full" />
                <figcaption className="mt-1 line-clamp-2 text-[11px] text-muted">{slide.caption}</figcaption>
              </figure>
            ))}
          </div>
          <button
            type="button"
            onClick={importBuiltIn}
            disabled={busy !== null}
            className={`${buttonClass("secondary")} mt-3`}
          >
            {busy === "import" ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Start from the current three
          </button>
        </div>
      )}

      <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {slides.map((slide, i) => (
          <article key={slide.id} className="overflow-hidden rounded-2xl bg-well">
            <div className="relative aspect-[16/9]">
              <AdminImage src={slide.image} alt={slide.caption || `Slide ${i + 1}`} className="h-full w-full" />
              <span className="absolute left-3 top-3 rounded-md bg-ink/80 px-2 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-white">
                {i + 1}
              </span>
            </div>

            <div className="space-y-2.5 p-3">
              <div>
                <label className={labelClass} htmlFor={`caption-${slide.id}`}>
                  Caption
                </label>
                <input
                  id={`caption-${slide.id}`}
                  value={slide.caption}
                  onChange={(e) =>
                    setSlides((list) =>
                      list.map((s) => (s.id === slide.id ? { ...s, caption: e.target.value } : s))
                    )
                  }
                  placeholder="Under 21 rugby, the unbeaten season"
                  className={inputClass}
                />
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => saveCaption(slide)}
                  disabled={busy !== null}
                  className={`${buttonClass("primary")} !px-3 !py-1.5 !text-xs`}
                >
                  {busy === slide.id ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Save className="h-3.5 w-3.5" />
                  )}
                  Save
                </button>

                <label className={`${buttonClass("secondary")} !px-3 !py-1.5 !text-xs cursor-pointer`}>
                  {busy === slide.id ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <ImagePlus className="h-3.5 w-3.5" />
                  )}
                  Replace photo
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    className="sr-only"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) void pick(file, { id: slide.id });
                      e.target.value = "";
                    }}
                  />
                </label>

                <button
                  type="button"
                  onClick={() => remove(slide)}
                  disabled={busy !== null}
                  aria-label={`Remove slide ${i + 1}`}
                  className={`${buttonClass("ghost")} !px-2.5 !py-1.5 !text-xs`}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          </article>
        ))}

        {/* ---- add ---- */}
        <article className="rounded-2xl border border-dashed border-line bg-panel p-4">
          <p className="text-sm font-semibold text-strong">Add a slide</p>
          <p className="mt-1 text-xs text-muted">
            Wide landscape works best — 1600 × 900 or larger. The picture is shrunk automatically.
          </p>

          <div className="mt-3 overflow-hidden rounded-xl bg-well">
            {draft.image ? (
              <AdminImage src={draft.image} alt="The photograph you chose" className="aspect-[16/9] w-full" />
            ) : (
              <div className="grid aspect-[16/9] place-items-center text-faint">
                <ImagePlus className="h-6 w-6" />
              </div>
            )}
          </div>

          <label className={`${buttonClass("secondary")} mt-3 cursor-pointer`}>
            {busy === "new" ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <ImagePlus className="h-4 w-4" />
            )}
            {draft.image ? "Choose another" : "Choose a photograph"}
            <input
              ref={draftFile}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="sr-only"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void pick(file, {});
              }}
            />
          </label>

          <input
            value={draft.caption}
            onChange={(e) => setDraft((d) => ({ ...d, caption: e.target.value }))}
            placeholder="Caption (read out to screen readers)"
            aria-label="Caption for the new slide"
            className={`${inputClass} mt-3`}
          />

          <button
            type="button"
            onClick={addSlide}
            disabled={busy !== null || !draft.image}
            className={`${buttonClass("primary")} mt-3 w-full justify-center`}
          >
            {busy === "new" ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Add slide
          </button>
        </article>
      </div>
    </>
  );
}
