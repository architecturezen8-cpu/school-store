"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { isAdmin } from "@/lib/admin/auth";
import { getAdminProduct } from "@/lib/catalog";
import { saveProductStock, saveTierCapacity, type Result } from "@/lib/stock";

/**
 * The stocks screen's writes.
 *
 * Two shapes of stock, one page: a product's shelf (colour × size) and a ticket
 * tier's seat cap. They are separate actions because they are separate tables,
 * but they report the same way — a redirect back with a word at the top.
 */

async function requireAdmin() {
  if (!(await isAdmin())) redirect("/admin?error=session");
}

function backWith(result: Result, where = "/admin/stock"): never {
  revalidatePath("/admin/stock");
  return result.ok
    ? redirect(`${where}?ok=${encodeURIComponent("Saved.")}`)
    : redirect(`${where}?error=${encodeURIComponent(result.error)}`);
}

/**
 * Saves one product's shelf from its own row of number boxes.
 *
 * The boxes are named `q:colour|size`. The combination list is not taken from
 * the form: it is rebuilt from the product's colours and sizes, so a stale page
 * cannot add a shelf cell the shop will never ask for, and a colour removed in
 * another tab cannot be sold from here.
 */
export async function saveProductStockAction(formData: FormData) {
  await requireAdmin();
  const slug = String(formData.get("slug") ?? "").trim();
  if (!slug) backWith({ ok: false, error: "No product was named." });

  const product = await getAdminProduct(slug);
  if (!product) backWith({ ok: false, error: `There is no product at “${slug}”.` });

  const values: Record<string, string> = {};
  for (const [name, value] of formData.entries()) {
    if (name.startsWith("q:") && typeof value === "string") values[name.slice(2)] = value;
  }

  const result = await saveProductStock(
    slug,
    product.colours,
    (product.options?.values ?? []).map((v) => v.trim()).filter(Boolean),
    values
  );

  if (result.ok) {
    revalidatePath("/admin/shop");
    revalidatePath("/shop");
    revalidatePath(`/product/${slug}`);
    revalidatePath("/");
  }
  backWith(result);
}

/**
 * The whole shelf, without touching anything else about the product.
 *
 * This exists because `saveProductStock` alone does not revalidate the shop —
 * the editor's own save does it as part of saving the product.
 */
export async function saveAllStockAction(formData: FormData) {
  await requireAdmin();
  const slug = String(formData.get("slug") ?? "").trim();
  const product = await getAdminProduct(slug);
  if (!product) backWith({ ok: false, error: "That product is not in the shop." });

  const values: Record<string, string> = {};
  for (const [name, value] of formData.entries()) {
    if (name.startsWith("q:") && typeof value === "string") values[name.slice(2)] = value;
  }
  const result = await saveProductStock(slug, product.colours, product.options?.values ?? [], values);
  if (result.ok) {
    revalidatePath("/shop");
    revalidatePath(`/product/${slug}`);
    revalidatePath("/");
  }
  backWith(result);
}

/** Seat caps for the tiers of one event, in one post. */
export async function saveTicketCapsAction(formData: FormData) {
  await requireAdmin();

  let firstError: string | null = null;
  for (const [name, value] of formData.entries()) {
    if (!name.startsWith("cap:")) continue;
    const id = name.slice(4);
    const result = await saveTierCapacity(id, value);
    if (!result.ok && !firstError) firstError = result.error;
  }

  if (firstError) backWith({ ok: false, error: firstError });
  revalidatePath("/tickets");
  revalidatePath("/events");
  revalidatePath("/admin/events");
  // The event page prints "N left" on each tier, and it is a static page with a
  // one-minute window: without this, a cap set now is not visible to a buyer for
  // a minute. The dynamic segment covers every event in one call.
  revalidatePath("/events/[slug]", "page");
  backWith({ ok: true });
}
