"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { checkPassword, endSession, isAdmin, startSession } from "@/lib/admin/auth";
import {
  deleteTemplate,
  setTemplateActive,
  uploadTemplate,
} from "@/lib/tickets/templates";
import { getTicketByReference, getTicketByToken, listBookings } from "@/lib/bookings";
import { sendTicketEmail } from "@/lib/tickets/email";
import { friendlyError } from "@/lib/errors";

/**
 * Admin server actions.
 *
 * Every action re-checks the session on the server. A hidden cookie in the
 * browser is not authorisation — the check that matters is the one next to the
 * write.
 */

async function requireAdmin() {
  if (!(await isAdmin())) redirect("/admin?error=session");
}

/* ---------- sign in / out ------------------------------------------- */

export async function signIn(formData: FormData) {
  const password = String(formData.get("password") ?? "");
  const next = String(formData.get("next") ?? "/admin");
  if (!checkPassword(password)) {
    redirect(`/admin?error=password&next=${encodeURIComponent(next)}`);
  }
  await startSession();
  redirect(next.startsWith("/") ? next : "/admin");
}

export async function signOut() {
  await endSession();
  redirect("/admin");
}

/* ---------- templates ------------------------------------------------ */

export async function uploadTemplateAction(formData: FormData) {
  await requireAdmin();

  const file = formData.get("design");
  const name = String(formData.get("name") ?? "").trim();
  const event = String(formData.get("event") ?? "").trim() || null;
  const slug = String(formData.get("slug") ?? "").trim();

  if (!(file instanceof File) || file.size === 0) {
    redirect("/admin/templates?error=nofile");
  }
  if (!name) {
    redirect("/admin/templates?error=noname");
  }

  const result = await uploadTemplate({
    file: file as File,
    name,
    event,
    slug: slug || slugify(name),
  });

  if (!result.ok) {
    redirect(`/admin/templates?error=${encodeURIComponent(result.error)}`);
  }

  revalidatePath("/admin/templates");
  redirect(`/admin/templates?ok=${encodeURIComponent(result.template.slug)}`);
}

export async function toggleTemplateAction(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  const active = String(formData.get("active") ?? "") === "true";
  if (id) await setTemplateActive(id, active);
  revalidatePath("/admin/templates");
}

export async function deleteTemplateAction(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  if (id) await deleteTemplate(id);
  revalidatePath("/admin/templates");
}

/* ---------- bookings ------------------------------------------------ */

export async function resendTicketAction(formData: FormData) {
  await requireAdmin();
  const token = String(formData.get("token") ?? "");
  if (!token) redirect("/admin/bookings?error=token");

  const ticket = await getTicketByToken(token);
  if (!ticket) redirect("/admin/bookings?error=notfound");

  const result = await sendTicketEmail(ticket);
  revalidatePath("/admin/bookings");
  redirect(
    result.sent
      ? `/admin/bookings?ok=${encodeURIComponent(ticket.reference)}`
      : `/admin/bookings?error=${encodeURIComponent(
          result.reason === "not-configured"
            ? "Email is not configured — set RESEND_API_KEY or SMTP_HOST."
            : result.error ?? "Send failed."
        )}`
  );
}

/* ---------- the ticket email ---------------------------------------- */

/**
 * Saves the wording of the ticket email.
 *
 * A blank box is stored as blank, and blank means "use the shipped default" all
 * the way down to lib/tickets/mail-settings, so clearing a field is how an admin
 * resets it.
 */
/**
 * Send the ticket email to one address, so the admin can see it in a real inbox
 * before a customer does.
 *
 * The design is fixed — there is nothing to edit — so this is the only button on
 * the page besides the preview. A real booking is used for the content (the QR
 * and the artwork are per-booking), and `to` is where it lands; nothing about
 * the booking is changed.
 */
export async function sendTestMailAction(
  boundReference: string,
  formData: FormData
) {
  await requireAdmin();

  const to = String(formData.get("to") ?? "").trim();
  const reference = String(formData.get("reference") ?? boundReference ?? "").trim();

  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(to)) {
    redirect(`/admin/mail?error=${encodeURIComponent("That does not look like an email address.")}`);
  }
  if (!to) {
    redirect("/admin/mail?error=" + encodeURIComponent("Type an address to send the test to."));
  }

  const ticket = reference
    ? await getTicketByReference(reference)
    : (await listBookings(1)).length
      ? await getTicketByToken((await listBookings(1))[0].token)
      : null;

  if (!ticket) {
    redirect(
      `/admin/mail?error=${encodeURIComponent(
        "Sell one ticket first — the test needs a real booking for its QR code."
      )}`
    );
  }

  let result: Awaited<ReturnType<typeof sendTicketEmail>>;
  try {
    result = await sendTicketEmail({ ...ticket, email: to });
  } catch (err) {
    redirect(`/admin/mail?error=${encodeURIComponent(friendlyError(err))}`);
  }

  if (!result.sent) {
    const why =
      result.reason === "not-configured"
        ? "No mail transport is configured, so nothing was sent."
        : `The mail server refused it: ${result.error ?? "unknown reason"}`;
    redirect(`/admin/mail?error=${encodeURIComponent(why)}`);
  }

  redirect(
    `/admin/mail?ok=${encodeURIComponent(
      `Test ticket sent to ${to} (${ticket.reference}).`
    )}`
  );
}

export async function loadBookings() {
  await requireAdmin();
  return listBookings(100);
}

/** Small helper so a blank slug becomes something valid rather than an error. */
function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);
}
