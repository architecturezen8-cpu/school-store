"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ImagePlus, Trash2, Upload } from "lucide-react";
import LogoBadge from "@/components/LogoBadge";
import { useToast } from "@/components/admin/Toasts";
import { buttonClass } from "@/components/admin/ui";
import {
  clearLogoAction,
  saveLogoScaleAction,
  uploadLogoAction,
} from "@/app/admin/actions";

/**
 * Upload, preview, replace, remove.
 *
 * The preview is the point: the logo lives in a white circle everywhere, so this
 * shows it in a white circle — a crest that looks fine on a white page and
 * disappears in the navbar is a disappointment nobody should discover on the live
 * site. The four sizes are the four real ones, not a guess.
 */
export default function LogoForm({
  current,
  currentScale = 0.86,
}: {
  current: string;
  currentScale?: number;
}) {
  const router = useRouter();
  const toast = useToast();
  const [logo, setLogo] = useState(current);
  const [scale, setScale] = useState(currentScale);
  const [busy, setBusy] = useState<"upload" | "clear" | null>(null);
  const [pending, startTransition] = useTransition();
  const input = useRef<HTMLInputElement>(null);

  async function upload(file: File) {
    setBusy("upload");
    try {
      const body = new FormData();
      body.set("logo", file);
      const result = await uploadLogoAction(body);
      if (!result.ok) {
        toast({ tone: "error", title: "That logo was not saved", body: result.error });
        return;
      }
      setLogo(result.url);
      toast({
        tone: "ok",
        title: "Logo saved",
        body: "The navbar, the footer, the admin and the ticket email all use it now.",
      });
      startTransition(() => router.refresh());
    } catch (err) {
      toast({ tone: "error", title: "That logo was not saved", body: (err as Error).message });
    } finally {
      setBusy(null);
      if (input.current) input.current.value = "";
    }
  }

  function clear() {
    setBusy("clear");
    startTransition(async () => {
      const result = await clearLogoAction();
      if (!result.ok) {
        toast({ tone: "error", title: "Could not remove the logo", body: result.error });
        setBusy(null);
        return;
      }
      setLogo("");
      toast({ tone: "ok", title: "Back to the built-in crest" });
      router.refresh();
      setBusy(null);
    });
  }

  /**
   * Saved when the slider is released, not on every pixel: a drag fires dozens of
   * changes and each one is a server round trip.
   */
  async function commitScale(value: number) {
    const result = await saveLogoScaleAction(value);
    if (!result.ok) {
      toast({ tone: "error", title: "Could not save that size", body: result.error });
      return;
    }
    toast({ tone: "ok", title: "Logo size saved", body: `${Math.round(value * 100)}% of the circle.` });
    startTransition(() => router.refresh());
  }

  const working = Boolean(busy) || pending;

  return (
    <div className="grid gap-3 sm:grid-cols-[190px_minmax(0,1fr)]">
      {/* the preview, at the size it is actually shown */}
      <div className="rounded-2xl bg-well p-5">
        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted">
          Preview
        </p>
        <div className="mt-4 flex flex-wrap items-end gap-4">
          <LogoBadge src={logo} size={88} scale={scale} decorative={false} />
          <LogoBadge src={logo} size={44} scale={scale} />
          <LogoBadge src={logo} size={28} scale={scale} />
        </div>
        <p className="mt-4 text-[11px] leading-relaxed text-muted">
          {logo
            ? "Shown on the navbar, the footer and the ticket email."
            : "No logo yet — the built-in crest is used everywhere. That is fine too."}
        </p>
      </div>

      <div className="rounded-2xl bg-well p-5">
        <p className="text-sm font-semibold text-strong">
          {logo ? "Replace it" : "Upload the school crest"}
        </p>
        <p className="mt-1 text-xs leading-relaxed text-muted">
          PNG, JPEG or WebP, up to 12 MB. It is fitted onto a white square at 512 px, never
          cropped, so a tall crest keeps its motto.
        </p>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <input
            ref={input}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="sr-only"
            aria-label="Choose a logo image"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void upload(file);
            }}
          />
          <button
            type="button"
            onClick={() => input.current?.click()}
            disabled={working}
            className={buttonClass("primary")}
          >
            {busy === "upload" || (pending && busy) ? (
              <Upload className="h-4 w-4 animate-pulse" />
            ) : (
              <ImagePlus className="h-4 w-4" />
            )}
            {logo ? "Replace logo" : "Upload logo"}
          </button>

          {logo && (
            <button
              type="button"
              onClick={clear}
              disabled={working}
              className={buttonClass("ghost")}
            >
              <Trash2 className="h-4 w-4" />
              Use the built-in crest
            </button>
          )}
        </div>

        {busy === "upload" && (
          <p role="status" className="mt-3 text-xs text-gold">
            Uploading and resizing…
          </p>
        )}

        {/* Size in the circle. Only meaningful once there is an upload — the
            built-in crest already sits the way it was drawn. */}
        {logo && (
          <div className="mt-5 border-t border-line/60 pt-4">
            <div className="flex items-baseline justify-between gap-3">
              <label
                htmlFor="logo-scale"
                className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted"
              >
                Size in the circle
              </label>
              <span className="font-mono text-xs text-gold">{Math.round(scale * 100)}%</span>
            </div>
            <input
              id="logo-scale"
              type="range"
              min={40}
              max={100}
              step={2}
              value={Math.round(scale * 100)}
              aria-describedby="logo-scale-help"
              onChange={(e) => setScale(Number(e.target.value) / 100)}
              onPointerUp={() => void commitScale(scale)}
              onKeyUp={() => void commitScale(scale)}
              className="mt-3 w-full accent-gold"
            />
            <p id="logo-scale-help" className="mt-2 text-[11px] leading-relaxed text-muted">
              A crest with its own white margin needs a bigger number; one that fills the
              image needs a smaller one. This applies everywhere, including the email.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
