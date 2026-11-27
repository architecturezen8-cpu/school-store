"use client";

import { useRef, useState } from "react";
import { Download, RotateCw } from "lucide-react";
import { Spinner } from "./Spinner";

/**
 * The "Download the bill (PDF)" button, with a working state.
 *
 * A plain `<a href>` to the receipt route is silent for however long the PDF
 * takes — and the PDF is drawn on the server, one row per tier, with a crest
 * embedded, so a big booking is a second or two of nothing at all. Nothing at
 * all is what makes people click three times and then email to ask whether the
 * order went through.
 *
 * So the click fetches the file instead of navigating to it. That gives the one
 * thing a link cannot: a moment to say "Preparing the bill…" in the button, and
 * a place to put an error if the route fails, rather than a tab that flashes
 * white and comes back.
 *
 * The bytes are saved through an object URL, which keeps the file's own name
 * from `Content-Disposition` — `receipt-BM-ABC123.pdf`, the same name the link
 * would have produced.
 */
export default function DownloadReceipt({
  href,
  children = "Download the bill (PDF)",
  pending = "Preparing the bill…",
  className = "",
  noteClassName = "",
  showNote = true,
}: {
  href: string;
  children?: string;
  /** The label while the PDF is being drawn. */
  pending?: string;
  className?: string;
  noteClassName?: string;
  /** The extra line under the button: what it is doing, or what went wrong. */
  showNote?: boolean;
}) {
  const [state, setState] = useState<"idle" | "working" | "error">("idle");
  const button = useRef<HTMLButtonElement>(null);

  async function save(event: React.MouseEvent<HTMLButtonElement>) {
    event.preventDefault();
    if (state === "working") return;
    setState("working");
    try {
      const res = await fetch(href, { cache: "no-store" });
      if (!res.ok) throw new Error(`The bill could not be drawn (${res.status}).`);

      const blob = await res.blob();
      const name = filenameFrom(res.headers.get("content-disposition")) ?? "receipt.pdf";
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = name;
      link.rel = "noopener";
      document.body.appendChild(link);
      link.click();
      link.remove();
      // Named blobs live until the tab closes; four seconds is long enough for
      // the browser to start the save and short enough not to hold the file.
      window.setTimeout(() => URL.revokeObjectURL(url), 4000);
      setState("idle");
      button.current?.blur();
    } catch {
      setState("error");
    }
  }

  return (
    <div className={noteClassName}>
      <button
        ref={button}
        type="button"
        onClick={save}
        disabled={state === "working"}
        aria-busy={state === "working"}
        className={className}
      >
        {state === "working" ? (
          <>
            <Spinner />
            {pending}
          </>
        ) : state === "error" ? (
          <>
            <RotateCw size={15} strokeWidth={2.5} />
            Try the bill again
          </>
        ) : (
          <>
            <Download size={15} strokeWidth={2.5} />
            {children}
          </>
        )}
      </button>

      {showNote && (
        <p
          role="status"
          aria-live="polite"
          className={`mt-3 text-center text-xs ${
            state === "error" ? "text-red-300" : "text-white/60"
          }`}
        >
          {state === "working"
            ? "Drawing the PDF on the server — a large booking takes a moment."
            : state === "error"
              ? "That did not work. The connection may have dropped — try again."
              : ""}
        </p>
      )}
    </div>
  );
}

/** `attachment; filename="receipt-BM-ABC123.pdf"` → that filename. */
function filenameFrom(header: string | null): string | null {
  if (!header) return null;
  const quoted = /filename\*?=(?:UTF-8'')?"?([^";]+)"?/i.exec(header);
  if (!quoted) return null;
  try {
    return decodeURIComponent(quoted[1]);
  } catch {
    return quoted[1];
  }
}
