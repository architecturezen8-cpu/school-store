"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { checkPassword, endSession, isAdmin, startSession } from "@/lib/admin/auth";
import {
  deleteTemplate,
  setTemplateActive,
  uploadTemplate,
} from "@/lib/tickets/templates";
import {
  blockTicket,
  deleteTicket,
  getTicketByReference,
  getTicketByToken,
  issueTicket,
  listBookings,
  ticketsForBooking,
  unblockTicket,
} from "@/lib/bookings";
import { saveLogo, saveLogoScale } from "@/lib/settings";
import { sendTicketEmail, sendTicketEmails, sampleTicket } from "@/lib/tickets/email";
import { friendlyError } from "@/lib/errors";
import { query } from "@/lib/db";
import {
  deleteEvent,
  saveEvent,
  setFeatured,
  unsetFeatured,
  type EventDraft,
} from "@/lib/events";
import { uploadImage, uploadLogo } from "@/lib/uploads";

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

  // Every ticket on the booking, because "resend the ticket" means the customer
  // wants all of them back — the reason they are asking is usually that one of
  // four did not arrive.
  const all = await ticketsForBooking(ticket.reference);
  const result = await sendTicketEmails(all.length ? all : [ticket]);
  revalidatePath("/admin/bookings");
  redirect(
    result.sent
      ? `/admin/bookings?ok=${encodeURIComponent(
          all.length > 1 ? `${ticket.reference} (${all.length} tickets)` : ticket.reference
        )}`
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

  // No sale yet is not a reason to refuse the test: the test exists so an admin
  // can check the mail *before* the first sale. A sample stands in — a real
  // event and a real QR, just not a live booking — and the success message says
  // which one went out, so nobody is told they tested something they did not.
  const sample = ticket ? null : await sampleTicket();
  if (!ticket && !sample) {
    redirect(
      `/admin/mail?error=${encodeURIComponent(
        "There is no event to build a sample ticket from — add one first."
      )}`
    );
  }

  const sending = { ...(ticket ?? sample!), email: to };
  let result: Awaited<ReturnType<typeof sendTicketEmail>>;
  try {
    result = await sendTicketEmail([sending]);
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
      ticket
        ? `Test ticket sent to ${to} (${ticket.reference}).`
        : `Sample ticket sent to ${to}. Delivery works; the QR is a sample, so the gate will not admit it.`
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

/* ---------- events -------------------------------------------------- */

/**
 * The editor sends the whole draft as JSON.
 *
 * Repeated rows (rules, photos, links, tiers) are lists of unknown length; a
 * form built from indexed fields would need a parser and would quietly drop a row
 * the moment the client added one. One JSON body is checked again here, on the
 * server, because the browser's copy of the draft is not evidence of anything.
 */
export async function saveEventAction(payload: string) {
  await requireAdmin();

  let parsed: { draft: EventDraft; mode: "create" | "update" };
  try {
    parsed = JSON.parse(payload) as { draft: EventDraft; mode: "create" | "update" };
  } catch {
    return { ok: false as const, error: "The form could not be read. Reload and try again." };
  }

  const mode = parsed.mode === "create" ? "create" : "update";
  const result = await saveEvent(parsed.draft, mode);
  if (!result.ok) return { ok: false as const, error: result.error };

  revalidatePath("/admin/events");
  revalidatePath("/tickets");
  revalidatePath(`/events/${result.slug}`);
  return { ok: true as const, slug: result.slug };
}

/**
 * The school's logo — the one image that appears on the site, in the admin and at
 * the top of every ticket email. Saved immediately rather than on form submit:
 * there is no form around it, and an upload that needs saving is an upload people
 * forget to save.
 */
export async function uploadLogoAction(formData: FormData) {
  await requireAdmin();
  const file = formData.get("logo");
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false as const, error: "Choose an image first." };
  }
  const result = await uploadLogo(file);
  if (!result.ok) return { ok: false as const, error: result.error };

  try {
    await saveLogo(result.url);
  } catch (err) {
    return { ok: false as const, error: friendlyError(err) };
  }

  // Every surface that shows the mark.
  revalidatePath("/", "layout");
  revalidatePath("/admin", "layout");
  return { ok: true as const, url: result.url };
}

/**
 * How much of the white circle the crest fills.
 *
 * Separately saved from the upload: an admin trying three sizes should not have
 * to upload the file three times, and re-encoding the image on every nudge would
 * soften it. Clamped in one place (`clampScale`), so a stray form value cannot
 * shrink the mark to nothing or blow it past the circle.
 */
export async function saveLogoScaleAction(value: number) {
  await requireAdmin();
  try {
    await saveLogoScale(value);
  } catch (err) {
    return { ok: false as const, error: friendlyError(err) };
  }
  revalidatePath("/", "layout");
  revalidatePath("/admin", "layout");
  return { ok: true as const };
}

/** Fall back to the built-in crest. */
export async function clearLogoAction() {
  await requireAdmin();
  try {
    await saveLogo("");
  } catch (err) {
    return { ok: false as const, error: friendlyError(err) };
  }
  revalidatePath("/", "layout");
  revalidatePath("/admin", "layout");
  return { ok: true as const };
}

/** One photograph at a time, so a multi-megabyte file never rides inside the form. */
export async function uploadEventImageAction(formData: FormData) {
  await requireAdmin();
  const file = formData.get("image");
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false as const, error: "Choose an image first." };
  }
  const result = await uploadImage(file);
  if (!result.ok) return { ok: false as const, error: result.error };
  return { ok: true as const, url: result.url };
}

/**
 * Toggle an event in the /tickets spotlight. `on` is explicit rather than a
 * toggle, so a double-click cannot leave the page in the state nobody wanted.
 */
export async function featureEventAction(slug: string, on: boolean) {
  await requireAdmin();
  try {
    if (on) await setFeatured(slug);
    else await unsetFeatured(slug);
  } catch (err) {
    return { ok: false as const, error: friendlyError(err) };
  }
  revalidatePath("/tickets");
  revalidatePath("/admin/events");
  revalidatePath(`/events/${slug}`);
  return { ok: true as const };
}

export async function deleteEventAction(slug: string) {
  await requireAdmin();
  const result = await deleteEvent(slug);
  if (!result.ok) return { ok: false as const, error: result.error };
  revalidatePath("/admin/events");
  revalidatePath("/tickets");
  return { ok: true as const };
}

/** Publishes or hides an event from the list, without opening the editor. */
export async function toggleEventPublishedAction(formData: FormData) {
  await requireAdmin();
  const slug = String(formData.get("slug") ?? "");
  const published = String(formData.get("published") ?? "") === "true";
  if (!slug) redirect("/admin/events?error=noslug");
  try {
    await query("update events set published = $2 where slug = $1", [slug, published]);
  } catch (err) {
    redirect(`/admin/events?error=${encodeURIComponent(friendlyError(err))}`);
  }
  revalidatePath("/admin/events");
  revalidatePath("/tickets");
  redirect(`/admin/events?ok=${encodeURIComponent(published ? "published" : "hidden")}`);
}

/** The list page's spotlight switch. Several events can be on at once. */
export async function toggleEventFeaturedAction(formData: FormData) {
  await requireAdmin();
  const slug = String(formData.get("slug") ?? "").trim();
  const featured = String(formData.get("featured") ?? "") === "true";
  if (!slug) redirect("/admin/events?error=missing");

  try {
    if (featured) await setFeatured(slug);
    else await unsetFeatured(slug);
  } catch (err) {
    redirect(`/admin/events?error=${encodeURIComponent(friendlyError(err))}`);
  }

  revalidatePath("/admin/events");
  revalidatePath("/tickets");
  revalidatePath(`/events/${slug}`);
  redirect(
    `/admin/events?ok=${encodeURIComponent(
      featured ? "Added to the ticket page spotlight." : "Removed from the spotlight."
    )}`
  );
}

/* ------------- ticket artwork, edited from inside the event -------------
   These return a result instead of redirecting, because the event editor calls
   them from a client component and has to show the refusal in place. */

export async function uploadEventDesignAction(formData: FormData) {
  await requireAdmin();
  const file = formData.get("design");
  const name = String(formData.get("name") ?? "").trim();
  const event = String(formData.get("event") ?? "").trim() || null;

  if (!(file instanceof File) || file.size === 0) {
    return { ok: false as const, error: "Choose an image file first." };
  }
  if (!name) return { ok: false as const, error: "Give the design a name." };

  try {
    const result = await uploadTemplate({
      file,
      name,
      event,
      slug: slugify(name),
    });
    if (!result.ok) return { ok: false as const, error: result.error };
    revalidatePath("/admin/events");
    revalidatePath("/admin/templates");
    if (event) revalidatePath(`/admin/events/${event}`);
    return { ok: true as const };
  } catch (err) {
    return { ok: false as const, error: friendlyError(err) };
  }
}

export async function setEventDesignActiveAction(id: string, active: boolean) {
  await requireAdmin();
  try {
    await setTemplateActive(id, active);
  } catch (err) {
    return { ok: false as const, error: friendlyError(err) };
  }
  revalidatePath("/admin/events");
  revalidatePath("/admin/templates");
  return { ok: true as const };
}

export async function deleteEventDesignAction(id: string) {
  await requireAdmin();
  try {
    await deleteTemplate(id);
  } catch (err) {
    return { ok: false as const, error: friendlyError(err) };
  }
  revalidatePath("/admin/events");
  revalidatePath("/admin/templates");
  return { ok: true as const };
}

/* ---------- one ticket at a time ------------------------------------- */

/**
 * Stop one ticket.
 *
 * The case this exists for: a parent forwards a screenshot of their QR, and the
 * person who received it turns up at the gate. The sale's reference is the same
 * for all of them, so it cannot name the ticket that escaped — the ticket's own
 * code can, and blocking it leaves the rest of the party walking in.
 */
export async function blockTicketAction(formData: FormData) {
  await requireAdmin();
  const token = String(formData.get("token") ?? "");
  const reference = String(formData.get("reference") ?? "");
  const note = String(formData.get("note") ?? "");
  const back = reference ? `/admin/bookings/${encodeURIComponent(reference)}` : "/admin/bookings";
  if (!token) redirect(`${back}?error=${encodeURIComponent("No ticket given.")}`);

  const result = await blockTicket(token, "admin", note);
  revalidatePath("/admin/bookings");
  revalidatePath(back);
  redirect(
    result.ok
      ? `${back}?ok=${encodeURIComponent(`${result.ticket.code} blocked`)}`
      : `${back}?error=${encodeURIComponent(result.error)}`
  );
}

/** Let it back in — a block made in the wrong row should not need a new ticket. */
export async function unblockTicketAction(formData: FormData) {
  await requireAdmin();
  const token = String(formData.get("token") ?? "");
  const reference = String(formData.get("reference") ?? "");
  const back = reference ? `/admin/bookings/${encodeURIComponent(reference)}` : "/admin/bookings";

  const result = await unblockTicket(token);
  revalidatePath("/admin/bookings");
  revalidatePath(back);
  redirect(
    result.ok
      ? `${back}?ok=${encodeURIComponent(`${result.ticket.code} is valid again`)}`
      : `${back}?error=${encodeURIComponent(result.error)}`
  );
}

/** Remove a ticket that should never have existed. Blocking is for the rest. */
export async function deleteTicketAction(formData: FormData) {
  await requireAdmin();
  const token = String(formData.get("token") ?? "");
  const reference = String(formData.get("reference") ?? "");
  const back = reference ? `/admin/bookings/${encodeURIComponent(reference)}` : "/admin/bookings";
  if (!token) redirect(`${back}?error=${encodeURIComponent("No ticket given.")}`);

  const ticket = await getTicketByToken(token);
  const code = ticket?.code ?? "The ticket";
  const result = await deleteTicket(token);
  revalidatePath("/admin/bookings");
  revalidatePath(back);
  redirect(
    result.ok
      ? `${back}?ok=${encodeURIComponent(`${code} deleted`)}`
      : `${back}?error=${encodeURIComponent(result.error)}`
  );
}

/**
 * Issue a ticket from the admin: a comp, a sponsor's seat, cash at the door.
 *
 * It becomes an ordinary booking — same reference, same QR, same gate, same bill
 * — so there is one kind of ticket in the building and not two.
 */
export async function issueTicketAction(formData: FormData) {
  await requireAdmin();
  const tier = String(formData.get("tier") ?? "");
  const name = String(formData.get("name") ?? "");
  const email = String(formData.get("email") ?? "");
  const priceRaw = String(formData.get("price") ?? "").trim();
  const note = String(formData.get("note") ?? "");
  const send = String(formData.get("send") ?? "") === "on";

  const price = priceRaw === "" ? null : Number(priceRaw);
  if (price !== null && (!Number.isFinite(price) || price < 0)) {
    redirect(`/admin/bookings/new?error=${encodeURIComponent("That price is not a number.")}`);
  }

  const result = await issueTicket({ tier, name, email, price, note });
  if (!result.ok) {
    redirect(`/admin/bookings/new?error=${encodeURIComponent(result.error)}`);
  }

  const created = result.booking;
  // The ticket exists whether or not anyone can be emailed; a failure here is
  // reported in the same breath as the success, because the seat is real either
  // way and the admin needs to know whether to hand over a printout instead.
  let mailNote = "";
  if (send && email) {
    const tickets = await ticketsForBooking(created.reference);
    const sent = await sendTicketEmails(tickets);
    mailNote = sent.sent ? " and emailed" : " — email not sent (check the mail settings)";
  }

  revalidatePath("/admin/bookings");
  redirect(`/admin/bookings/${encodeURIComponent(created.reference)}?ok=${encodeURIComponent(`Ticket issued${mailNote}`)}`);
}
