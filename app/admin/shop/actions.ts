"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { isAdmin } from "@/lib/admin/auth";
import { friendlyError } from "@/lib/errors";
import { uploadImage } from "@/lib/uploads";
import {
  deleteCategory,
  deleteFilter,
  deleteProduct,
  moveFilter,
  saveCategory,
  saveFilter,
  saveProduct,
  setProductActive,
  type CategoryDraft,
  type ProductDraft,
} from "@/lib/catalog";

/**
 * The shop's writes.
 *
 * Every action re-checks the session: a hidden form field is not authorisation.
 * The shop is one screen away from the storefront, so a change here has to show
 * up there immediately — hence `revalidatePath` on both sides of the wall.
 */

async function requireAdmin() {
  if (!(await isAdmin())) redirect("/admin?error=session");
}

/** The shop, in every shape a page renders it. */
function revalidateShop() {
  revalidatePath("/admin/shop");
  revalidatePath("/admin/shop/categories");
  revalidatePath("/shop");
  revalidatePath("/");
}

/* ---------- products ------------------------------------------------- */

/**
 * Saves a product from the editor's JSON draft.
 *
 * The editor posts one payload rather than thirty named fields: the lists it
 * holds (details, colours, gallery) have no fixed length, and `details[3]` style
 * names are a parser with silent failure modes. It is validated again here.
 */
export async function saveProductAction(payload: string) {
  await requireAdmin();

  let parsed: { draft: ProductDraft; mode: "create" | "update" };
  try {
    parsed = JSON.parse(payload) as { draft: ProductDraft; mode: "create" | "update" };
  } catch {
    return { ok: false as const, error: "The form could not be read. Reload and try again." };
  }

  const mode = parsed.mode === "create" ? "create" : "update";
  const result = await saveProduct(parsed.draft, mode);
  if (!result.ok) return { ok: false as const, error: result.error };

  revalidateShop();
  revalidatePath(`/product/${result.slug}`);
  return { ok: true as const, slug: result.slug };
}

/** One photograph at a time, so a 4 MB file never rides inside the draft. */
export async function uploadProductImageAction(formData: FormData) {
  await requireAdmin();
  const file = formData.get("image");
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false as const, error: "Choose an image first." };
  }
  const result = await uploadImage(file, "products");
  if (!result.ok) return { ok: false as const, error: result.error };
  return { ok: true as const, url: result.url };
}

export async function toggleProductActiveAction(formData: FormData) {
  await requireAdmin();
  const slug = String(formData.get("slug") ?? "");
  const active = String(formData.get("active") ?? "") === "true";
  if (slug) await setProductActive(slug, active);
  revalidateShop();
  redirect(String(formData.get("back") ?? "/admin/shop"));
}

export async function deleteProductAction(formData: FormData) {
  await requireAdmin();
  const slug = String(formData.get("slug") ?? "");
  const back = String(formData.get("back") ?? "/admin/shop");
  const result = await deleteProduct(slug);
  revalidateShop();

  if (!result.ok) redirect(`${back}?error=${encodeURIComponent(result.error)}`);
  redirect(
    `${back}?ok=${encodeURIComponent(
      result.archived
        ? `${slug} has been sold before, so it is hidden rather than deleted — its orders still point at it.`
        : `${slug} is gone.`
    )}`
  );
}

/* ---------- categories ----------------------------------------------- */

/**
 * A category from the form.
 *
 * A file input and the fields share one FormData: a category is a picture and
 * four short strings, so an instant-upload client component would be ceremony.
 */
export async function saveCategoryAction(formData: FormData) {
  await requireAdmin();

  const mode = String(formData.get("mode") ?? "create") === "update" ? "update" : "create";
  const back = String(formData.get("back") ?? "/admin/shop/categories");

  let image = String(formData.get("imageUrl") ?? "").trim();
  const file = formData.get("image");
  if (file instanceof File && file.size > 0) {
    const uploaded = await uploadImage(file, "categories");
    if (!uploaded.ok) {
      redirect(`${back}?error=${encodeURIComponent(uploaded.error)}`);
    }
    image = uploaded.url;
  }

  const draft: CategoryDraft = {
    slug: String(formData.get("slug") ?? "").trim(),
    title: String(formData.get("title") ?? "").trim(),
    description: String(formData.get("description") ?? "").trim(),
    blurb: String(formData.get("blurb") ?? "").trim(),
    image,
  };

  const result = await saveCategory(draft, mode);
  if (!result.ok) redirect(`${back}?error=${encodeURIComponent(result.error)}`);

  revalidateShop();
  redirect(
    `/admin/shop/categories/${result.slug}?ok=${encodeURIComponent(
      mode === "create" ? "Category created." : "Saved."
    )}`
  );
}

export async function deleteCategoryAction(formData: FormData) {
  await requireAdmin();
  const slug = String(formData.get("slug") ?? "");
  const result = await deleteCategory(slug);
  if (!result.ok) {
    redirect(`/admin/shop/categories/${slug}?error=${encodeURIComponent(result.error)}`);
  }
  revalidateShop();
  redirect(`/admin/shop/categories?ok=${encodeURIComponent(`${slug} is gone.`)}`);
}

/* ---------- filters --------------------------------------------------- */

export async function saveFilterAction(formData: FormData) {
  await requireAdmin();
  const kind = String(formData.get("kind") ?? "colour") === "size" ? "size" : "colour";
  const result = await saveFilter({
    id: String(formData.get("id") ?? "") || undefined,
    kind,
    label: String(formData.get("label") ?? ""),
    swatch: String(formData.get("swatch") ?? ""),
    isActive: String(formData.get("active") ?? "true") === "true",
  });

  const back = `/admin/shop/filters?kind=${kind}`;
  revalidateShop();
  redirect(
    result.ok
      ? `${back}&ok=${encodeURIComponent("Saved.")}`
      : `${back}&error=${encodeURIComponent(result.error)}`
  );
}

export async function deleteFilterAction(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  const kind = String(formData.get("kind") ?? "colour");
  const result = await deleteFilter(id);
  const back = `/admin/shop/filters?kind=${kind}`;
  revalidateShop();
  redirect(
    result.ok
      ? `${back}&ok=${encodeURIComponent("Removed.")}`
      : `${back}&error=${encodeURIComponent(result.error)}`
  );
}

export async function moveFilterAction(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  const kind = String(formData.get("kind") ?? "colour");
  const direction = String(formData.get("direction") ?? "up") === "up" ? -1 : 1;
  try {
    await moveFilter(id, direction);
    revalidateShop();
    return;
  } catch (err) {
    redirect(`/admin/shop/filters?kind=${kind}&error=${encodeURIComponent(friendlyError(err))}`);
  }
}
