"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ImageUp, Loader2, Trash2 } from "lucide-react";
import { buttonClass } from "@/components/admin/ui";

/**
 * The ticket artwork for one event, edited right here in the event editor.
 *
 * There is deliberately no separate "designs" page for the event flow: a design
 * belongs to the event it prints for, so it is edited where the event is. The
 * rules the detector cares about (a pure-white square, nothing on top of it) are
 * stated next to the upload rather than in a help page nobody opens.
 */
export type DesignSummary = {
  id: string;
  name: string;
  file: string;
  isActive: boolean;
};

export default function EventDesign({
  designs,
  onUpload,
  onToggle,
  onDelete,
}: {
  designs: DesignSummary[];
  onUpload: (formData: FormData) => Promise<{ ok: boolean; error?: string }>;
  onToggle: (id: string, active: boolean) => Promise<{ ok: boolean; error?: string }>;
  onDelete: (id: string) => Promise<{ ok: boolean; error?: string }>;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [busy, setBusy] = useState<"upload" | string | null>(null);
  const [notice, setNotice] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [defaultName, setDefaultName] = useState("");

  async function upload(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const data = new FormData(form);
    if (!(data.get("design") instanceof File) || (data.get("design") as File).size === 0) {
      setNotice({ tone: "error", text: "Choose an image file first." });
      return;
    }
    setBusy("upload");
    setNotice(null);
    const result = await onUpload(data);
    setBusy(null);
    if (!result.ok) {
      setNotice({ tone: "error", text: result.error ?? "The upload was refused." });
      return;
    }
    form.reset();
    setDefaultName("");
    setNotice({ tone: "ok", text: "Design uploaded — new bookings use it." });
    router.refresh();
  }

  async function toggle(id: string, active: boolean) {
    setBusy(id);
    const result = await onToggle(id, active);
    setBusy(null);
    if (!result.ok) {
      setNotice({ tone: "error", text: result.error ?? "Could not change that design." });
      return;
    }
    router.refresh();
  }

  async function remove(id: string) {
    if (!confirm("Delete this design? Tickets fall back to the one below it.")) return;
    setBusy(id);
    const result = await onDelete(id);
    setBusy(null);
    if (!result.ok) {
      setNotice({ tone: "error", text: result.error ?? "Could not delete that design." });
      return;
    }
    router.refresh();
  }

  const live = designs.find((d) => d.isActive);

  return (
    <section className="rounded-2xl bg-panel p-6">
      <h2 className="font-display text-lg font-semibold text-white">Ticket artwork</h2>
      <p className="mt-1 max-w-2xl text-xs leading-relaxed text-white/60">
        The picture buyers receive, with the QR pasted in. Leave a solid white square
        where the code goes — equal sides, at least 160px, pure white, nothing printed
        on top of it. The code fills about 80% of that square, so keep a thin white
        margin around it.
      </p>

      {notice && (
        <p
          role="status"
          className={`mt-4 rounded-lg px-3 py-2 text-[12px] ${
            notice.tone === "ok" ? "bg-gold text-black" : "bg-white/10 text-white"
          }`}
        >
          {notice.text}
        </p>
      )}

      <div className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,320px)]">
        {/* what is live now */}
        <div className="rounded-xl bg-well p-4">
          <p className="text-[11px] uppercase tracking-[0.16em] text-white/60">In use</p>
          {live ? (
            <div className="mt-3 flex items-start gap-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={live.file}
                alt={live.name}
                className="h-20 w-32 shrink-0 rounded-lg object-cover"
              />
              <div className="min-w-0">
                <p className="truncate text-sm text-white">{live.name}</p>
                <p className="mt-1 text-[11px] text-white/55">printed on every new booking</p>
              </div>
            </div>
          ) : (
            <p className="mt-3 text-xs leading-relaxed text-white/55">
              No artwork for this event — tickets use the plain generated design.
            </p>
          )}

          {designs.length > 0 && (
            <ul className="mt-4 space-y-2">
              {designs.map((d) => (
                <li
                  key={d.id}
                  className="flex items-center justify-between gap-3 rounded-lg bg-panel-2 px-3 py-2"
                >
                  <span className="min-w-0 truncate text-[12px] text-white/75">{d.name}</span>
                  <span className="flex shrink-0 items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => toggle(d.id, !d.isActive)}
                      disabled={busy !== null}
                      className={`${buttonClass("ghost")} !px-2.5 !py-1 !text-[11px]`}
                    >
                      {busy === d.id ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : d.isActive ? (
                        "On"
                      ) : (
                        "Off"
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => remove(d.id)}
                      disabled={busy !== null}
                      className={`${buttonClass("ghost")} !px-2.5 !py-1 !text-[11px]`}
                      aria-label={`Delete ${d.name}`}
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* upload */}
        <form onSubmit={upload} className="space-y-3">
          <label className="block">
            <span className="block text-[11px] uppercase tracking-[0.16em] text-white/60">
              Design name
            </span>
            <input
              name="name"
              required
              value={defaultName}
              onChange={(e) => setDefaultName(e.target.value)}
              placeholder="Big Match 2027"
              className="mt-1.5 w-full rounded-xl bg-well px-3 py-2.5 text-sm text-white outline-none placeholder:text-white/30 focus-visible:outline focus-visible:outline-2 focus-visible:outline-gold"
            />
          </label>

          <label className="block">
            <span className="block text-[11px] uppercase tracking-[0.16em] text-white/60">
              Image · PNG, JPEG or WebP, 8 MB
            </span>
            <input
              type="file"
              name="design"
              accept="image/png,image/jpeg,image/webp"
              required
              className="mt-1.5 w-full rounded-xl bg-well px-3 py-2.5 text-xs text-white/70 file:mr-3 file:rounded-lg file:border-0 file:bg-white file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-black"
            />
          </label>

          <button
            type="submit"
            disabled={busy !== null}
            className={`${buttonClass("primary")} w-full disabled:opacity-50`}
          >
            {busy === "upload" ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <ImageUp className="h-4 w-4" />
            )}
            Upload and find the square
          </button>
          <p className="text-[11px] leading-relaxed text-white/45">
            A refusal here means the square could not be found — check it is pure white
            and has nothing drawn inside it.
          </p>
        </form>
      </div>

      {pending && <p className="sr-only">Working…</p>}
    </section>
  );
}
