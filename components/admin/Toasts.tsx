"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, Check, Info, X } from "lucide-react";

/**
 * The admin's popups.
 *
 * A message used to appear as a bar above whatever the admin was looking at, at
 * the top of a long form — so the one thing they needed to see after pressing
 * Save was the one thing off screen. These rise from the bottom-right instead:
 * near the button that caused them, out of the way of the form, and gone on their
 * own when they are good news.
 *
 * The rules that matter:
 *
 *   · **errors stay until dismissed.** A failure is not something to miss while
 *     looking at the keyboard. `ok` and `info` fade after a few seconds.
 *   · **one at a time, stacked.** A form saved twice should not produce four
 *     boxes; the same message twice replaces itself rather than repeating.
 *   · **announced, not shouted.** `role="status"` for good news, `role="alert"`
 *     for a failure, so a screen reader reads it once without stealing focus.
 *   · **no layout shift.** It floats over the page, so nothing moves underneath
 *     and no scroll position is lost.
 */

export type ToastTone = "ok" | "error" | "warn" | "info";

export type Toast = {
  id: number;
  tone: ToastTone;
  title: string;
  body?: string;
};

/** What a caller passes in; `key` defaults to the message itself. */
export type Pushed = {
  tone: ToastTone;
  title: string;
  body?: string;
  key?: string;
};

const TONES: Record<ToastTone, { ring: string; icon: React.ReactNode; label: string }> = {
  ok: {
    ring: "bg-gold text-page",
    icon: <Check className="h-4 w-4" strokeWidth={3} />,
    label: "Done",
  },
  error: {
    ring: "bg-strong text-page",
    icon: <X className="h-4 w-4" strokeWidth={3} />,
    label: "Not done",
  },
  warn: {
    ring: "bg-gold text-page",
    icon: <AlertTriangle className="h-4 w-4" strokeWidth={2.5} />,
    label: "Heads up",
  },
  info: {
    ring: "bg-panel-2 text-body",
    icon: <Info className="h-4 w-4" strokeWidth={2.5} />,
    label: "Note",
  },
};

const DWELL: Record<ToastTone, number> = {
  ok: 5000,
  info: 5000,
  warn: 8000,
  // Errors are the only kind that waits for a human.
  error: 0,
};

let nextId = 1;

export function useToasts() {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const dismiss = useCallback((id: number) => {
    setToasts((list) => list.filter((t) => t.id !== id));
  }, []);

  /**
   * `key` collapses repeats: two saves with the same failure should leave one
   * box, not two identical ones that each need dismissing.
   */
  const push = useCallback((toast: Pushed) => {
    const key = toast.key ?? `${toast.tone}:${toast.title}`;
    setToasts((list) => {
      const existing = list.find((t) => `${t.tone}:${t.title}` === key);
      if (existing) return list;
      // Keep the newest three; beyond that it is noise, not information.
      return [...list.slice(-2), { ...toast, id: nextId++ }];
    });
  }, []);

  return { toasts, push, dismiss };
}

/** Raise a popup. `key` collapses renders of the same message. */
export type PushToast = (toast: Pushed) => void;

/** Turn a `?ok=` / `?error=` pair from a redirect into popups, once. */
export function useToastFromParams(
  push: PushToast,
  params: { ok?: string; error?: string },
  decode: (v: string) => string
) {
  const done = useRef(false);
  useEffect(() => {
    if (done.current) return;
    done.current = true;
    if (params.ok) push({ tone: "ok", title: "Saved", body: decode(params.ok) });
    if (params.error)
      push({ tone: "error", title: "That did not work", body: decode(params.error) });
  }, [params.ok, params.error, push, decode]);
}

export function Toasts({
  toasts,
  dismiss,
}: {
  toasts: Toast[];
  dismiss: (id: number) => void;
}) {
  if (!toasts.length) return null;
  return (
    <div
      className="pointer-events-none fixed inset-x-3 bottom-3 z-[70] flex flex-col items-end gap-2 sm:inset-x-auto sm:right-5 sm:bottom-5"
      aria-live="polite"
      aria-label="Notifications"
    >
      {toasts.map((t) => (
        <ToastCard key={t.id} toast={t} onDismiss={() => dismiss(t.id)} />
      ))}
    </div>
  );
}

function ToastCard({ toast, onDismiss }: { toast: Toast; onDismiss: () => void }) {
  const [leaving, setLeaving] = useState(false);
  const timer = useRef<number | undefined>(undefined);
  const tone = TONES[toast.tone];

  const close = useCallback(() => {
    if (leaving) return;
    setLeaving(true);
    window.setTimeout(onDismiss, 180);
  }, [leaving, onDismiss]);

  useEffect(() => {
    const dwell = DWELL[toast.tone];
    if (!dwell) return;
    timer.current = window.setTimeout(close, dwell);
    return () => window.clearTimeout(timer.current);
  }, [close, toast.tone]);

  const isError = toast.tone === "error";

  return (
    <div
      role={isError ? "alert" : "status"}
      className={`pointer-events-auto w-full max-w-sm rounded-2xl bg-panel-2 p-4 shadow-[0_24px_70px_rgba(0,0,0,0.55)] transition-all duration-200 sm:w-[22rem] ${
        leaving ? "translate-y-2 opacity-0" : "translate-y-0 opacity-100"
      } ${isError ? "ring-1 ring-strong/40" : "ring-1 ring-line"}`}
      // Pausing on hover is the difference between "I can read this" and "it
      // vanished while I was reading it".
      onMouseEnter={() => window.clearTimeout(timer.current)}
      onMouseLeave={() => {
        const dwell = DWELL[toast.tone];
        if (dwell) timer.current = window.setTimeout(close, 2500);
      }}
    >
      <div className="flex items-start gap-3">
        <span
          className={`mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full ${tone.ring}`}
          aria-hidden="true"
        >
          {tone.icon}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted">
            {tone.label}
          </p>
          <p className="mt-1 text-sm font-semibold leading-snug text-strong">{toast.title}</p>
          {toast.body && (
            <p className="mt-1 break-words text-[13px] leading-relaxed text-body">{toast.body}</p>
          )}
        </div>
        <button
          type="button"
          onClick={close}
          className="-mr-1 -mt-1 grid h-7 w-7 shrink-0 place-items-center rounded-full text-muted transition-colors hover:bg-line hover:text-strong"
          aria-label="Dismiss"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
      {isError && (
        // A quiet reminder that this one stays put, so nobody waits for it to go.
        <p className="mt-2 text-[11px] text-faint">Stays until you close it.</p>
      )}
    </div>
  );
}

/**
 * The provider, so a page-level component can raise a popup from anywhere.
 *
 * A context rather than props: the save button that fails is four levels below
 * the page, and threading a setter through every editor is how a codebase ends up
 * with its own mini state library.
 */
import { createContext, useContext } from "react";

const ToastContext = createContext<{ push: PushToast; dismiss: (id: number) => void } | null>(
  null
);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const { toasts, push, dismiss } = useToasts();
  const value = useMemo(() => ({ push, dismiss }), [push, dismiss]);
  return (
    <ToastContext.Provider value={value}>
      {children}
      <Toasts toasts={toasts} dismiss={dismiss} />
    </ToastContext.Provider>
  );
}

export function useToast(): PushToast {
  const ctx = useContext(ToastContext);
  // A component used without the provider should still work, not crash: the
  // admin shell always provides one, but a story or a test may not.
  return ctx?.push ?? (() => {});
}
