"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowUpRight,
  Check,
  ImagePlus,
  Loader2,
  Plus,
  Sparkles,
  Star,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { Field, Notice, buttonClass, inputClass, labelClass } from "@/components/admin/ui";
import { comboKey, combosFor } from "@/lib/stock-core";
import { useToast } from "@/components/admin/Toasts";
import AdminImage from "@/components/admin/AdminImage";
import type { ProductDraft } from "@/lib/catalog";
import { slugify } from "@/lib/slug";
import { lkr } from "@/lib/format";

/**
 * The product editor.
 *
 * Shaped like the shop it feeds: a picture on the left, the words on the right,
 * and a live card of what a customer will see — because the one thing an admin
 * cannot do from a list of inputs is imagine the card. Colours and sizes are
 * chips rather than free text, drawn from the same vocabulary the storefront
 * filters use, so a product can never be tagged with a colour the filter row does
 * not know about.
 *
 * The draft is sent as one JSON payload: details, colours and the gallery are
 * lists of unknown length, and index-named form fields are a parser with silent
 * failure modes. It is validated again on the server.
 */
export default function ProductEditor({
  initial,
  mode,
  takenSlugs,
  categories,
  colourOptions,
  sizeOptions,
  saveAction,
  uploadAction,
}: {
  initial: ProductDraft;
  mode: "create" | "update";
  takenSlugs: string[];
  categories: { slug: string; title: string }[];
  colourOptions: string[];
  sizeOptions: string[];
  saveAction: (payload: string) => Promise<{ ok: boolean; error?: string; slug?: string }>;
  uploadAction: (formData: FormData) => Promise<{ ok: boolean; url?: string; error?: string }>;
}) {
  const router = useRouter();
  const toast = useToast();
  const toastOf = (tone: "ok" | "error", title: string, body?: string) =>
    toast({ tone, title, body });
  const [draft, setDraft] = useState<ProductDraft>(initial);
  const [pending, startTransition] = useTransition();
  const [uploading, setUploading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [detail, setDetail] = useState("");
  const [newColour, setNewColour] = useState("");
  const [newSize, setNewSize] = useState("");
  const mainInput = useRef<HTMLInputElement>(null);
  const galleryInput = useRef<HTMLInputElement>(null);

  const set = <K extends keyof ProductDraft>(key: K, value: ProductDraft[K]) =>
    setDraft((d) => ({ ...d, [key]: value }));

  const category = categories.find((c) => c.slug === draft.category);

  /**
   * The chips to draw.
   *
   * The office's list first, then anything this product already carries that the
   * list does not know — a colour typed in here yesterday is still a chip today,
   * and it can still be clicked off. Without the second half, removing a custom
   * colour would need a database console.
   */
  const allColours = [...colourOptions, ...draft.colours.filter((c) => !colourOptions.includes(c))];
  const allSizes = [
    ...sizeOptions,
    ...(draft.options?.values ?? []).filter((v) => !sizeOptions.includes(v)),
  ];

  const shelfSizes = (draft.options?.values ?? []).map((v) => v.trim()).filter(Boolean);
  const shelf = combosFor(draft.colours, shelfSizes);
  const stock = draft.stock ?? {};
  const anyStock = Object.values(stock).some((v) => Number(v) > 0 || String(v ?? "") !== "");
  const stockTotal = shelf.reduce((sum, cell) => sum + (Number(stock[comboKey(cell.colour, cell.size)]) || 0), 0);

  const addColour = () => {
    const value = newColour.trim();
    if (!value) return;
    if (!draft.colours.includes(value)) set("colours", [...draft.colours, value]);
    setNewColour("");
  };
  const addSize = () => {
    const value = newSize.trim();
    if (!value) return;
    const values = draft.options?.values ?? [];
    if (!values.includes(value)) {
      set("options", { label: draft.options?.label || "Size", values: [...values, value] });
    }
    setNewSize("");
  };

  const setStock = (colour: string, size: string, raw: string) => {
    const next: Record<string, number> = { ...stock };
    const key = comboKey(colour, size);
    if (raw.trim() === "") delete next[key];
    else next[key] = Math.max(0, Math.round(Number(raw)) || 0);
    set("stock", next);
  };
  const isBadge = /badge/i.test(category?.title ?? draft.category);
  const isClothing = /cloth|shirt|uniform/i.test(category?.title ?? draft.category);

  const slugTaken =
    mode === "create" && Boolean(draft.slug) && takenSlugs.includes(slugify(draft.slug));

  const blockers = [
    !draft.name.trim() ? "a name" : "",
    !draft.category ? "a category" : "",
    Number(draft.price) < 0 || !Number.isFinite(Number(draft.price)) ? "a real price" : "",
    slugTaken ? "an address that is not already taken" : "",
  ].filter(Boolean);

  async function upload(file: File, where: "main" | "gallery") {
    setUploading(where);
    setError(null);
    try {
      const body = new FormData();
      body.set("image", file);
      const result = await uploadAction(body);
      if (!result.ok || !result.url) {
        setError(result.error ?? "That image could not be uploaded.");
        toastOf("error", "Upload failed", result.error ?? "That image could not be uploaded.");
        return null;
      }
      return result.url;
    } catch (err) {
      const message = (err as Error).message || "That image could not be uploaded.";
      setError(message);
      toastOf("error", "Upload failed", message);
      return null;
    } finally {
      setUploading(null);
    }
  }

  function save() {
    setError(null);
    startTransition(async () => {
      const tidy: ProductDraft = { ...draft, slug: slugify(draft.slug || draft.name) };
      const result = await saveAction(JSON.stringify({ draft: tidy, mode }));
      if (!result.ok) {
        setError(result.error ?? "Could not save.");
        toastOf("error", "Not saved", result.error ?? "Could not save.");
        return;
      }
      toastOf(
        "ok",
        mode === "create" ? "Product added" : "Saved",
        "The shop shows it on its next visit."
      );
      if (mode === "create" && result.slug) router.push(`/admin/shop/products/${result.slug}?ok=1`);
      else router.refresh();
    });
  }

  const preview = useMemo(
    () => ({
      name: draft.name || "Untitled product",
      price: Number(draft.price) || 0,
      image: draft.image,
      tag: draft.tag,
      rating: draft.rating,
    }),
    [draft.name, draft.price, draft.image, draft.tag, draft.rating]
  );

  return (
    <div className="grid gap-3 xl:grid-cols-3">
      {/* ---------------- the picture and the words ---------------- */}
      <section className="rounded-2xl bg-panel p-6 xl:col-span-2">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-[0.24em] text-muted">
              {mode === "create" ? "New product" : "Editing"}
            </p>
            <h1 className="mt-1 font-display text-2xl font-semibold text-strong">
              {mode === "create" ? "Add to the shop" : draft.name || draft.slug}
            </h1>
          </div>
          {mode === "update" && (
            <Link
              href={`/product/${draft.slug}`}
              target="_blank"
              className={`${buttonClass("ghost")} !px-3 !py-1.5 !text-xs`}
            >
              View in shop <ArrowUpRight className="h-3.5 w-3.5" />
            </Link>
          )}
        </div>

        {error && (
          <div className="mt-4">
            <Notice tone="error">{error}</Notice>
          </div>
        )}

        <div className="mt-5 grid gap-5 sm:grid-cols-[13rem_1fr]">
          {/* picture */}
          <div>
            <p className={labelClass}>Picture</p>
            <button
              type="button"
              onClick={() => mainInput.current?.click()}
              className="group relative mt-2 block aspect-[4/5] w-full overflow-hidden rounded-xl bg-well"
            >
              {preview.image ? (
                <AdminImage
                  src={preview.image}
                  className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                />
              ) : (
                <span className="grid h-full place-items-center text-muted">
                  <ImagePlus className="h-7 w-7" />
                </span>
              )}
              <span className="absolute inset-x-2 bottom-2 flex items-center justify-center gap-1.5 rounded-lg bg-page/90 px-2 py-1.5 text-[11px] font-medium text-strong">
                {uploading === "main" ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" /> Uploading…
                  </>
                ) : (
                  <>
                    <Upload className="h-3.5 w-3.5" /> {preview.image ? "Replace" : "Upload"}
                  </>
                )}
              </span>
            </button>
            <input
              ref={mainInput}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="hidden"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                e.target.value = "";
                if (!file) return;
                const url = await upload(file, "main");
                if (url) set("image", url);
              }}
            />
            <p className="mt-2 text-[11px] leading-relaxed text-muted">
              The card on the shelf and the top of the product page. 4:5 looks best.
            </p>
          </div>

          {/* the essentials */}
          <div className="space-y-4">
            <Field label="Name">
              <input
                value={draft.name}
                onChange={(e) => {
                  set("name", e.target.value);
                  if (mode === "create") set("slug", slugify(e.target.value));
                }}
                placeholder="Crest Hoodie"
                className={inputClass}
              />
            </Field>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Category">
                <select
                  value={draft.category}
                  onChange={(e) => set("category", e.target.value)}
                  className={`${inputClass} appearance-none`}
                >
                  {categories.map((c) => (
                    <option key={c.slug} value={c.slug}>
                      {c.title}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Price (LKR)" hint="whole rupees">
                <input
                  type="number"
                  min={0}
                  step={10}
                  value={draft.price}
                  onChange={(e) => set("price", Number(e.target.value))}
                  className={inputClass}
                />
              </Field>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Badge on the card" hint="optional">
                <input
                  value={draft.tag}
                  onChange={(e) => set("tag", e.target.value)}
                  placeholder="Best Seller"
                  className={inputClass}
                />
              </Field>
              <Field label="Rating">
                <input
                  type="number"
                  min={0}
                  max={5}
                  step={1}
                  value={draft.rating}
                  onChange={(e) => set("rating", Number(e.target.value))}
                  className={inputClass}
                />
              </Field>
              <Field label="Reviews">
                <input
                  type="number"
                  min={0}
                  step={1}
                  value={draft.reviews}
                  onChange={(e) => set("reviews", Number(e.target.value))}
                  className={inputClass}
                />
              </Field>
            </div>

            <Field label="Address" hint="chosen once, fixed after that">
              <input
                value={draft.slug}
                onChange={(e) => set("slug", slugify(e.target.value))}
                disabled={mode === "update"}
                className={`${inputClass} font-mono text-xs disabled:opacity-60`}
              />
            </Field>

            <Field label="Description">
              <textarea
                value={draft.description}
                onChange={(e) => set("description", e.target.value)}
                rows={3}
                placeholder="Two lines a parent would read on the product page."
                className={inputClass}
              />
            </Field>
          </div>
        </div>

        {/* ---------------- choices ---------------- */}
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <div className="rounded-xl bg-well p-4">
            <div className="flex items-center justify-between">
              <p className={labelClass}>Colours</p>
              <span className="text-[11px] text-muted">{draft.colours.length} chosen</span>
            </div>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {allColours.map((label) => {
                const on = draft.colours.includes(label);
                return (
                  <button
                    key={label}
                    type="button"
                    onClick={() =>
                      set(
                        "colours",
                        on ? draft.colours.filter((c) => c !== label) : [...draft.colours, label]
                      )
                    }
                    aria-pressed={on}
                    className={`rounded-full px-3 py-1.5 text-[11px] font-medium transition-colors ${
                      on ? "bg-gold text-black" : "bg-panel text-muted hover:text-strong"
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
            {/* A colour the office only has on this one item. */}
            <div className="mt-3 flex items-center gap-1.5">
              <input
                value={newColour}
                onChange={(e) => setNewColour(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addColour();
                  }
                }}
                placeholder="Add a colour of your own — e.g. House tie green"
                aria-label="New colour"
                className={`${inputClass} !mt-0 !py-1.5 !text-[11px]`}
              />
              <button
                type="button"
                onClick={addColour}
                aria-label="Add colour"
                className={`${buttonClass("ghost")} shrink-0 !px-2.5 !py-1.5`}
              >
                <Plus className="h-3.5 w-3.5" />
              </button>
            </div>
            {draft.colours.some((c) => !colourOptions.includes(c)) && (
              <p className="mt-2 text-[11px] leading-relaxed text-muted">
                Only on this product: {draft.colours.filter((c) => !colourOptions.includes(c)).join(", ")}.
                Add one to Filters if the whole shop should offer it too.
              </p>
            )}
            {isBadge && draft.colours.length > 0 && (
              <p className="mt-3 rounded-lg bg-panel px-3 py-2 text-[11px] leading-relaxed text-gold">
                A badge is one piece of metal with one finish. A colour here offers a choice the
                shop cannot fulfil — remove them unless you really stock both.
              </p>
            )}
            {!isClothing && !isBadge && draft.colours.length === 0 && (
              <p className="mt-3 text-[11px] leading-relaxed text-muted">
                No colours: the shop shows no colour picker for this product.
              </p>
            )}
          </div>

          <div className="rounded-xl bg-well p-4">
            <div className="flex items-center justify-between">
              <p className={labelClass}>Options</p>
              <span className="text-[11px] text-muted">
                {draft.options?.values.length ?? 0} chosen
              </span>
            </div>
            <input
              value={draft.options?.label ?? ""}
              onChange={(e) =>
                set("options", {
                  label: e.target.value,
                  values: draft.options?.values ?? [],
                })
              }
              placeholder="Size — or Ink, Colour, Length…"
              className={`${inputClass} !mt-2 !py-2 !text-xs`}
            />
            <div className="mt-2 flex flex-wrap gap-1.5">
              {allSizes.map((label) => {
                const on = Boolean(draft.options?.values.includes(label));
                return (
                  <button
                    key={label}
                    type="button"
                    onClick={() => {
                      const values = draft.options?.values ?? [];
                      set("options", {
                        label: draft.options?.label || "Size",
                        values: on ? values.filter((v) => v !== label) : [...values, label],
                      });
                    }}
                    aria-pressed={on}
                    className={`min-w-9 rounded-lg px-2 py-1.5 text-[11px] font-semibold transition-colors ${
                      on ? "bg-gold text-black" : "bg-panel text-muted hover:text-strong"
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
            <div className="mt-3 flex items-center gap-1.5">
              <input
                value={newSize}
                onChange={(e) => setNewSize(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addSize();
                  }
                }}
                placeholder={`Add your own ${(draft.options?.label || "size").toLowerCase()} — e.g. 3XL`}
                aria-label="New size"
                className={`${inputClass} !mt-0 !py-1.5 !text-[11px]`}
              />
              <button
                type="button"
                onClick={addSize}
                aria-label="Add size"
                className={`${buttonClass("ghost")} shrink-0 !px-2.5 !py-1.5`}
              >
                <Plus className="h-3.5 w-3.5" />
              </button>
            </div>
            {/shirt|tee|hoodie|blazer|polo/i.test(draft.name) && !draft.options?.values.length && (
              <p className="mt-3 rounded-lg bg-panel px-3 py-2 text-[11px] leading-relaxed text-gold">
                Clothing with no sizes: somebody will order a shirt that fits nobody in particular.
              </p>
            )}
          </div>
        </div>

        {/* ---------------- stock ---------------- */}
        <div className="mt-4 rounded-xl bg-well p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className={labelClass}>Stock on the shelf</p>
              <p className="mt-1 text-[11px] leading-relaxed text-muted">
                One box per colour and size. Leave every box empty and this product is not
                counted — the shop simply says it is available.
              </p>
            </div>
            <span
              className={`rounded-full px-3 py-1 text-[11px] font-semibold ${
                !anyStock
                  ? "bg-panel text-muted"
                  : stockTotal === 0
                    ? "bg-panel text-red-300"
                    : stockTotal <= 5
                      ? "bg-gold text-black"
                      : "bg-panel text-strong"
              }`}
            >
              {!anyStock ? "not counted" : stockTotal === 0 ? "sold out" : `${stockTotal} in total`}
            </span>
          </div>

          <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {shelf.map((cell) => {
              const key = comboKey(cell.colour, cell.size);
              const value = stock[key];
              const shown = value === undefined ? "" : String(value);
              return (
                <label
                  key={key}
                  className="flex items-center justify-between gap-2 rounded-lg bg-panel px-3 py-2"
                >
                  <span className="min-w-0 truncate text-[11px] font-medium text-body">
                    {[cell.colour, cell.size].filter(Boolean).join(" / ") || "This item"}
                  </span>
                  <input
                    type="number"
                    min={0}
                    inputMode="numeric"
                    value={shown}
                    onChange={(e) => setStock(cell.colour, cell.size, e.target.value)}
                    placeholder="—"
                    aria-label={`Stock for ${[cell.colour, cell.size].filter(Boolean).join(" ") || "this item"}`}
                    className="w-16 rounded-md border border-line bg-well px-2 py-1 text-right text-xs text-strong outline-none focus:border-gold"
                  />
                </label>
              );
            })}
          </div>

          {anyStock &&
            shelf.some((cell) => {
              const n = Number(stock[comboKey(cell.colour, cell.size)]);
              return n > 0 && n <= 5;
            }) && (
              <p className="mt-3 rounded-lg bg-panel px-3 py-2 text-[11px] leading-relaxed text-gold">
                Something here is down to five or fewer — it will show an “Only N left” note on
                the shop, and the stocks screen will list it first.
              </p>
            )}
        </div>

        {/* ---------------- details ---------------- */}
        <div className="mt-4 rounded-xl bg-well p-4">
          <p className={labelClass}>What it is — one line each</p>
          <ul className="mt-2 space-y-1.5">
            {draft.details.map((d, i) => (
              <li key={`${d}-${i}`} className="flex items-center gap-2 rounded-lg bg-panel px-3 py-2">
                <Check className="h-3.5 w-3.5 shrink-0 text-gold" />
                <span className="min-w-0 flex-1 truncate text-xs text-body">{d}</span>
                <button
                  type="button"
                  onClick={() => set("details", draft.details.filter((_, j) => j !== i))}
                  aria-label={`Remove “${d}”`}
                  className="text-muted hover:text-strong"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </li>
            ))}
          </ul>
          <div className="mt-2 flex gap-2">
            <input
              value={detail}
              onChange={(e) => setDetail(e.target.value)}
              onKeyDown={(e) => {
                if (e.key !== "Enter") return;
                e.preventDefault();
                const value = detail.trim();
                if (!value) return;
                set("details", [...draft.details, value]);
                setDetail("");
              }}
              placeholder="320gsm brushed fleece"
              className={`${inputClass} !mt-0 !py-2 !text-xs`}
            />
            <button
              type="button"
              onClick={() => {
                const value = detail.trim();
                if (!value) return;
                set("details", [...draft.details, value]);
                setDetail("");
              }}
              className={`${buttonClass("secondary")} !px-3 !py-2 !text-xs`}
            >
              <Plus className="h-3.5 w-3.5" /> Add
            </button>
          </div>
        </div>

        {/* ---------------- gallery ---------------- */}
        <div className="mt-4 rounded-xl bg-well p-4">
          <div className="flex items-center justify-between">
            <p className={labelClass}>More angles</p>
            <button
              type="button"
              onClick={() => galleryInput.current?.click()}
              className={`${buttonClass("ghost")} !px-2.5 !py-1 !text-[11px]`}
            >
              {uploading === "gallery" ? (
                <>
                  <Loader2 className="h-3 w-3 animate-spin" /> Uploading…
                </>
              ) : (
                <>
                  <ImagePlus className="h-3 w-3" /> Add a photo
                </>
              )}
            </button>
          </div>
          <input
            ref={galleryInput}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="hidden"
            onChange={async (e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              if (!file) return;
              const url = await upload(file, "gallery");
              if (url) set("gallery", [...draft.gallery, url]);
            }}
          />
          {draft.gallery.length === 0 ? (
            <p className="mt-2 text-[11px] leading-relaxed text-muted">
              None yet. The product page shows the main picture on its own until there are more.
            </p>
          ) : (
            <ul className="mt-2 grid grid-cols-4 gap-2 sm:grid-cols-6">
              {draft.gallery.map((g, i) => (
                <li key={`${g}-${i}`} className="group relative">
                  <AdminImage src={g} className="aspect-square w-full rounded-lg object-cover" />
                  <button
                    type="button"
                    onClick={() => set("gallery", draft.gallery.filter((_, j) => j !== i))}
                    aria-label="Remove this photo"
                    className="absolute right-1 top-1 grid h-5 w-5 place-items-center rounded-md bg-page/90 text-strong opacity-0 transition-opacity group-hover:opacity-100"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      {/* ---------------- what the customer sees ---------------- */}
      <div className="space-y-3">
        <section className="rounded-2xl bg-panel p-5">
          <p className="text-[11px] font-medium uppercase tracking-[0.24em] text-muted">
            On the shelf
          </p>
          <div className="mt-3 overflow-hidden rounded-xl bg-well">
            {preview.image ? (
              <AdminImage src={preview.image} className="aspect-[4/5] w-full object-cover" />
            ) : (
              <div className="grid aspect-[4/5] place-items-center text-muted">
                <ImagePlus className="h-6 w-6" />
              </div>
            )}
          </div>
          <div className="mt-3 flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="truncate font-display text-base text-strong">{preview.name}</p>
              <p className="mt-0.5 text-xs text-muted">{category?.title ?? "No category"}</p>
            </div>
            {preview.tag && (
              <span className="shrink-0 rounded-md bg-gold px-2 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-black">
                {preview.tag}
              </span>
            )}
          </div>
          <div className="mt-2 flex items-center justify-between">
            <span className="font-display text-lg text-strong">{lkr(preview.price)}</span>
            <span className="flex items-center gap-1 text-[11px] text-muted">
              <Star className="h-3 w-3 fill-gold text-gold" />
              {preview.rating} · {draft.reviews}
            </span>
          </div>
          {(draft.colours.length > 0 || draft.options?.values.length) && (
            <p className="mt-2 truncate text-[11px] text-muted">
              {[
                draft.colours.length ? `${draft.colours.length} colours` : "",
                draft.options?.values.length
                  ? `${draft.options.values.length} ${draft.options.label.toLowerCase()}s`
                  : "",
              ]
                .filter(Boolean)
                .join(" · ")}
            </p>
          )}
        </section>

        <section className="rounded-2xl bg-panel p-5">
          <p className="text-[11px] font-medium uppercase tracking-[0.24em] text-muted">Where it shows</p>
          <div className="mt-3 space-y-1.5">
            <Switch
              label="In the shop"
              hint="Off hides it without deleting it."
              on={draft.active}
              onChange={(v) => set("active", v)}
            />
            <Switch
              label="Featured"
              hint="The top row of the storefront."
              on={draft.isFeatured}
              onChange={(v) => set("isFeatured", v)}
            />
            <Switch
              label="New arrival"
              hint="The “New” row and the newest sort."
              on={draft.isNew}
              onChange={(v) => set("isNew", v)}
            />
          </div>
        </section>

        <section className="rounded-2xl bg-panel p-5">
          {blockers.length > 0 && (
            <p className="mb-3 text-[11px] leading-relaxed text-muted">
              Before it can be saved it needs {blockers.join(", ")}.
            </p>
          )}
          <button
            type="button"
            onClick={save}
            disabled={pending || blockers.length > 0}
            className={`${buttonClass("primary")} w-full`}
          >
            {pending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Saving…
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" /> {mode === "create" ? "Add to the shop" : "Save"}
              </>
            )}
          </button>
        </section>
      </div>
    </div>
  );
}

function Switch({
  label,
  hint,
  on,
  onChange,
}: {
  label: string;
  hint: string;
  on: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!on)}
      role="switch"
      aria-checked={on}
      className="flex w-full items-center justify-between gap-3 rounded-lg bg-well px-3 py-2 text-left"
    >
      <span className="min-w-0">
        <span className="block text-xs font-medium text-strong">{label}</span>
        <span className="block text-[11px] text-muted">{hint}</span>
      </span>
      <span
        className={`relative h-5 w-9 shrink-0 rounded-full transition-colors ${
          on ? "bg-gold" : "bg-panel-2"
        }`}
      >
        <span
          className={`absolute top-0.5 h-4 w-4 rounded-full bg-page transition-all ${
            on ? "left-[1.15rem]" : "left-0.5"
          }`}
        />
      </span>
    </button>
  );
}
