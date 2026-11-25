"use client";

import { useEffect, useRef } from "react";
import { useToast } from "@/components/admin/Toasts";

/**
 * Turns a server page's `?ok=` / `?error=` into a popup.
 *
 * The admin pages are server components — they read the query string, render, and
 * are done. A popup needs a client component, so this is the smallest thing that
 * bridges the two: it takes the same strings the page would have rendered in a
 * banner, shows them once, and renders nothing at all.
 *
 * Once, not on every render: a redirect that leaves the query string in the URL
 * would otherwise re-raise the same message on each soft navigation, and an
 * error the admin has already dealt with should not come back when they scroll.
 */
export default function ParamToast({
  ok,
  error,
}: {
  ok?: string;
  error?: string;
}) {
  const push = useToast();
  const key = `${ok ?? ""}::${error ?? ""}`;
  const shown = useRef("");

  useEffect(() => {
    if (!key.trim() || key === "::") return;
    if (shown.current === key) return;
    shown.current = key;
    if (ok) push({ tone: "ok", title: "Done", body: ok });
    if (error) push({ tone: "error", title: "That did not work", body: error });
  }, [key, ok, error, push]);

  return null;
}
