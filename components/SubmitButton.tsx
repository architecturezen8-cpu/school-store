"use client";

import type { ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { Spinner } from "./Spinner";

/**
 * A submit button that says it is working.
 *
 * Every admin form posts to a server action, and several of those actions are
 * slow in a way you can feel: an uploaded design is hashed, thumbnailed and
 * scanned for a white square; a test ticket is rendered and handed to SMTP; a
 * template is deleted and the page re-read. A button that just sits there while
 * that happens reads as "nothing happened, press it again" — and pressing it
 * again is exactly what people do.
 *
 * `useFormStatus` is the only state that is guaranteed to be about *this* form:
 * it is true from the moment the browser starts the post until the new server
 * render lands, which is longer than an `onClick` handler would ever know about,
 * and it is right on a repeat submit with an unchanged form too.
 *
 * The words change as well as the icon. A spinner alone on a small button is
 * easy to miss; "Uploading…" is not.
 */
export default function SubmitButton({
  children,
  pending = "Working…",
  className = "",
  icon,
  disabled = false,
  title,
  ariaLabel,
}: {
  children: ReactNode;
  /** What the button says while the form is in flight. */
  pending?: string;
  className?: string;
  /** Shown before the label, and replaced by the spinner while pending. */
  icon?: ReactNode;
  disabled?: boolean;
  title?: string;
  ariaLabel?: string;
}) {
  const { pending: working } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={disabled || working}
      aria-busy={working}
      aria-label={ariaLabel}
      title={title}
      className={className}
    >
      {working ? (
        <>
          <Spinner />
          {pending}
        </>
      ) : (
        <>
          {icon}
          {children}
        </>
      )}
    </button>
  );
}
