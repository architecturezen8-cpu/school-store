"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ImagePlus, Trash2 } from "lucide-react";
import { Spinner } from "@/components/Spinner";
import CrestLogo from "@/components/CrestLogo";
import { useToast } from "@/components/admin/Toasts";
import { buttonClass } from "@/components/admin/ui";
import { clearFaviconAction, uploadFaviconAction } from "@/app/admin/actions";

/**
 * The browser tab icon.
 *
 * Shows it twice, because the tab icon has two jobs and they are different: a
 * crest that reads in the 16 px tab and one that reads in the 180 px tile a
 * phone puts on a home screen are not always the same picture. The tab mock is
 * the honest preview — a big beautiful icon that turns to mush at 16 px is the
 * one failure this page exists to prevent.
 */
export default function FaviconForm({ current }: { current: string }) {
  const router = useRouter();
  const toast = useToast();
  const [icon, setIcon] = useState(current);
  const [busy, setBusy] = useState<"upload" | "clear" | null>(null);
  const [, startTransition] = useTransition();
  const input = useRef<HTMLInputElement>(null);

  async function upload(file: File) {
    setBusy("upload");
    try {
      const body = new FormData();
      body.set("favicon", file);
      const result = await uploadFaviconAction(body);
      if (!result.ok) {
        toast({ tone: "error", title: "That icon was not saved", body: result.error });
        return;
      }
      setIcon(result.url);
      toast({
        tone: "ok",
        title: "Tab icon saved",
        body: "Every page of the shop now shows it in the browser tab. Browsers cache icons hard — a hard refresh may be needed to see it.",
      });
      startTransition(() => router.refresh());
    } catch (err) {
      toast({ tone: "error", title: "That icon was not saved", body: (err as Error).message });
    } finally {
      setBusy(null);
      if (input.current) input.current.value = "";
    }
  }

  function clear() {
    setBusy("clear");
    startTransition(async () => {
      const result = await clearFaviconAction();
      if (!result.ok) {
        toast({ tone: "error", title: "Could not reset the icon", body: result.error });
        setBusy(null);
        return;
      }
      setIcon("");
      toast({ tone: "ok", title: "Back to the built-in mark" });
      setBusy(null);
      router.refresh();
    });
  }

  return (
    <div>
      <div className="flex flex-wrap items-end gap-5">
        {/* the tab, at the size a tab actually is */}
        <div className="min-w-[13rem]">
          <p className="text-[10px] uppercase tracking-[0.18em] text-muted">In a tab</p>
          <div className="mt-2 flex items-center gap-2 rounded-t-lg bg-panel-2 px-3 py-2">
            <span className="h-4 w-4 shrink-0 overflow-hidden rounded-[3px] bg-well">
              {icon ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={icon} alt="" className="h-full w-full object-contain" />
              ) : (
                <CrestLogo className="h-full w-full p-0.5 text-gold" decorative />
              )}
            </span>
            <span className="max-w-[8rem] truncate text-[10px] text-body">The Thomian Store</span>
            <span aria-hidden className="ml-auto text-[10px] text-muted">
              ×
            </span>
          </div>
        </div>

        <div>
          <p className="text-[10px] uppercase tracking-[0.18em] text-muted">At 180 px</p>
          <span className="mt-2 grid h-[90px] w-[90px] place-items-center overflow-hidden rounded-2xl bg-well">
            {icon ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={icon} alt="Current tab icon" className="h-full w-full object-contain" />
            ) : (
              <CrestLogo className="h-12 w-12 text-gold" decorative />
            )}
          </span>
        </div>
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-2">
        <input
          ref={input}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) upload(file);
          }}
        />
        <button
          type="button"
          onClick={() => input.current?.click()}
          disabled={busy !== null}
          className={`${buttonClass("primary")} !py-2 !text-xs`}
        >
          {busy === "upload" ? <Spinner /> : <ImagePlus className="h-3.5 w-3.5" />}
          {busy === "upload" ? "Uploading…" : icon ? "Replace the icon" : "Upload an icon"}
        </button>
        {icon && (
          <button
            type="button"
            onClick={clear}
            disabled={busy !== null}
            className={`${buttonClass("ghost")} !py-2 !text-xs`}
          >
            {busy === "clear" ? <Spinner /> : <Trash2 className="h-3.5 w-3.5" />}
            Use the built-in mark
          </button>
        )}
      </div>

      <p className="mt-3 text-[11px] leading-relaxed text-muted">
        A square PNG with a transparent background works best — a crest with a wide margin
        will look small in the tab. Anything you upload is padded to a 512 px square and kept
        sharp, never stretched.
      </p>
    </div>
  );
}
