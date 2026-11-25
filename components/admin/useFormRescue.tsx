"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/** Whether a stored JSON blob differs from the baseline. */
function differs<T>(raw: string | null, baseline: T): boolean {
  if (!raw) return false;
  try {
    return JSON.stringify(JSON.parse(raw) as T) !== JSON.stringify(baseline);
  } catch {
    return false;
  }
}

/**
 * Keeps a half-written form alive across a reload.
 *
 * An admin filling in an event is doing an hour of typing. A stray F5, a
 * preview that reloads underneath, or a crash would throw all of it away, so a
 * working copy is written to localStorage as it is typed and offered back on
 * the next load. The copy is keyed by what is being edited, so two tabs editing
 * two events never collide, and it is dropped the moment the form is saved.
 *
 * Only `write` and `clear` touch state; the mount-time check runs outside the
 * effect so React's "don't setState in an effect" rule is satisfied honestly
 * rather than silenced.
 */
export function useFormRescue<T>(key: string, baseline: T) {
  const [restored, setRestored] = useState(false);
  const enabled = useRef(false);

  const read = useCallback((): T | undefined => {
    try {
      const raw = window.localStorage.getItem(key);
      if (!raw) return undefined;
      const value = JSON.parse(raw) as T;
      return JSON.stringify(value) === JSON.stringify(baseline) ? undefined : value;
    } catch {
      return undefined;
    }
  }, [key, baseline]);

  // Does a copy exist, and is it worth offering? A microtask, not a synchronous
  // setState in the effect body, so nothing renders twice on the happy path.
  useEffect(() => {
    enabled.current = true;
    let alive = true;
    void Promise.resolve().then(() => {
      if (alive && differs(window.localStorage.getItem(key), baseline)) {
        setRestored(true);
      }
    });
    return () => {
      alive = false;
    };
  }, [key, baseline]);

  return {
    /** The copy to start from, or undefined to use what the server sent. */
    read,
    /** True when an unsaved copy was found, so the form can say so. */
    restored,
    write(value: T) {
      if (!enabled.current) return;
      try {
        if (JSON.stringify(value) === JSON.stringify(baseline)) {
          window.localStorage.removeItem(key);
        } else {
          window.localStorage.setItem(key, JSON.stringify(value));
        }
      } catch {
        // Over quota, or storage disabled. Losing the rescue is not losing the form.
      }
    },
    clear() {
      try {
        window.localStorage.removeItem(key);
      } catch {
        /* nothing to do */
      }
      setRestored(false);
    },
  };
}
