"use client";

import { AlertTriangle, RotateCcw } from "lucide-react";
import { buttonClass } from "@/components/admin/ui";

/**
 * What the admin shows when a screen throws.
 *
 * This exists because of a specific, avoidable humiliation: a database one
 * migration behind the app made `/admin` and `/admin/bookings` throw, and the
 * root boundary (`app/error.tsx`) replaced the *whole* page — sidebar, banner and
 * all — with "SOMETHING BROKE". The one screen that could have explained the
 * problem and offered the button that fixes it was the one being hidden.
 *
 * Sitting in `app/admin/`, this boundary wraps only the page content, so the
 * sidebar and the database bar stay on screen, on top of their own explanation.
 * The technical line is still there, folded away — the office does not need it,
 * but whoever they forward the screenshot to does.
 */
export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="rounded-2xl bg-panel p-6">
      <div className="flex items-start gap-4">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-gold/15 text-gold">
          <AlertTriangle className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <h1 className="font-display text-xl font-semibold text-strong">
            This screen could not be read
          </h1>
          <p className="mt-1 text-sm leading-relaxed text-muted">
            The rest of the admin still works — the sidebar is right there. If the gold bar above
            says the database is older than the store, press its button first; that is usually the
            whole problem. Otherwise try again, and it will read the page a second time.
          </p>
          <button type="button" onClick={reset} className={`${buttonClass("primary")} mt-4`}>
            <RotateCcw className="h-4 w-4" />
            Try again
          </button>
          <details className="mt-5 text-xs text-muted">
            <summary className="cursor-pointer select-none text-faint hover:text-body">
              What the server said
            </summary>
            <pre className="mt-2 overflow-x-auto rounded-lg bg-well p-3 text-[11px] leading-relaxed text-body">
              {error.message}
              {error.digest ? `\n\ndigest: ${error.digest}` : ""}
            </pre>
          </details>
        </div>
      </div>
    </div>
  );
}
