import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { isAdmin } from "@/lib/admin/auth";
import { databaseProblem } from "@/lib/admin/db-guard";
import { databaseDown, hasDatabase } from "@/lib/db";
import { listAdminProducts, listFilters, type ShopFilter } from "@/lib/catalog";
import { safeDecode } from "@/lib/safe-decode";
import { colourHex } from "@/lib/colour";
import ParamToast from "@/components/admin/ParamToast";
import SubmitButton from "@/components/SubmitButton";
import {
  Empty,
  Field,
  Notice,
  PageHeader,
  Panel,
  buttonClass,
  inputClass,
} from "@/components/admin/ui";
import { ArrowDown, ArrowLeft, ArrowUp, Eye, EyeOff, Trash2 } from "lucide-react";
import { deleteFilterAction, moveFilterAction, saveFilterAction } from "../actions";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Filters",
  robots: { index: false, follow: false },
};

/**
 * The colours and sizes a shopper narrows the shelf with.
 *
 * The shop used to offer nothing but the collections: no "Navy", no "XL". These
 * chips are the vocabulary behind what is now offered, and they are editable
 * because the vocabulary is a decision the school makes — a colour it no longer
 * stocks should stop being advertised, and the order they appear in is the order
 * a parent reads them in.
 *
 * A chip is only ever drawn on the shop when something in the collection
 * actually has that value, so a forgotten entry cannot produce an empty page.
 */
export default async function FiltersPage({
  searchParams,
}: {
  searchParams: Promise<{ kind?: string; edit?: string; ok?: string; error?: string }>;
}) {
  if (!(await isAdmin())) redirect("/admin?next=/admin/shop/filters");
  if (!hasDatabase()) redirect("/admin?error=database");

  const { kind: kindParam, edit, ok, error } = await searchParams;
  const kind: "colour" | "size" = kindParam === "size" ? "size" : "colour";

  const problem = databaseProblem();
  const [filters, products] = databaseDown()
    ? [[], []]
    : await Promise.all([listFilters(), listAdminProducts()]);

  const shown = filters.filter((f) => f.kind === kind);
  const editing = edit ? filters.find((f) => f.id === edit) : undefined;

  // How many products would answer each chip today.
  const uses = (f: ShopFilter) =>
    products.filter((p) =>
      f.kind === "colour"
        ? p.colours.some((c) => c.toLowerCase() === f.label.toLowerCase())
        : p.options?.values.some((v) => v.toLowerCase() === f.label.toLowerCase())
    ).length;

  return (
    <div className="space-y-3">
      <section className="rounded-2xl bg-panel p-6">
        <Link
          href="/admin/shop"
          className="inline-flex items-center gap-1.5 text-[11px] uppercase tracking-[0.16em] text-muted hover:text-strong"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Products
        </Link>
        <div className="mt-3">
          <PageHeader
            eyebrow="Shop"
            title="Filters"
            description="What a shopper can narrow the shelf by. A chip appears on the shop only when something in that collection actually has the value — so these are the words, not the promises."
          />
        </div>
        {problem && (
          <div className="mt-4">
            <Notice tone="warn">{problem}</Notice>
          </div>
        )}
        {(ok || error) && (
          <div className="mt-4">
            <ParamToast ok={ok ? safeDecode(ok) : ""} error={error ? safeDecode(error) : ""} />
          </div>
        )}
        <div className="mt-4 flex gap-1.5">
          {(["colour", "size"] as const).map((k) => (
            <Link
              key={k}
              href={`/admin/shop/filters?kind=${k}`}
              className={`rounded-full px-4 py-2 text-xs font-medium capitalize ${
                kind === k ? "bg-gold text-black" : "bg-well text-muted hover:text-strong"
              }`}
            >
              {k === "colour" ? "Colours" : "Sizes"} ({filters.filter((f) => f.kind === k).length})
            </Link>
          ))}
        </div>
      </section>

      <div className="grid gap-3 xl:grid-cols-3">
        <Panel
          title={editing ? `Editing “${editing.label}”` : kind === "colour" ? "Add a colour" : "Add a size"}
          description={
            editing
              ? "Rename it, recolour the chip, or hide it without deleting it."
              : "It joins the end of the row. Up and down move it along."
          }
          className="xl:col-span-1"
        >
          <form action={saveFilterAction} className="space-y-4">
            {editing && <input type="hidden" name="id" value={editing.id} />}
            <input type="hidden" name="kind" value={kind} />
            <Field label={kind === "colour" ? "Colour name" : "Size"}>
              <input
                name="label"
                required
                defaultValue={editing?.label ?? ""}
                placeholder={kind === "colour" ? "Navy" : "XL"}
                className={inputClass}
              />
            </Field>
            {kind === "colour" && (
              <Field label="Chip colour" hint="what the swatch is filled with">
                <div className="mt-2 flex items-center gap-2">
                  <input
                    type="color"
                    name="swatch"
                    defaultValue={editing?.swatch || (editing ? colourHex(editing.label) : "#8b9099")}
                    className="h-10 w-14 cursor-pointer rounded-lg bg-well p-1"
                  />
                  <span className="text-[11px] leading-relaxed text-muted">
                    Pick something close to the cloth. The chip always prints the word too, so the
                    colour is never the only clue.
                  </span>
                </div>
              </Field>
            )}
            <label className="flex items-center gap-2 text-xs text-body">
              <input
                type="checkbox"
                name="active"
                value="true"
                defaultChecked={editing ? editing.isActive : true}
                className="h-4 w-4 rounded bg-well"
              />
              Show it on the shop
            </label>
            <div className="flex gap-2">
              <SubmitButton pending="Saving…" className={buttonClass("primary")}>
                {editing ? "Save" : "Add"}
              </SubmitButton>
              {editing && (
                <Link
                  href={`/admin/shop/filters?kind=${kind}`}
                  className={buttonClass("secondary")}
                >
                  Cancel
                </Link>
              )}
            </div>
          </form>
        </Panel>

        <Panel
          title={kind === "colour" ? "The colour row" : "The size row"}
          description="In the order the shop prints them. The number is how many products would answer the chip."
          className="xl:col-span-2"
        >
          {shown.length === 0 ? (
            <Empty>Nothing yet — add one on the left.</Empty>
          ) : (
            <ul className="space-y-1.5">
              {shown.map((f) => (
                <li
                  key={f.id}
                  data-filter={f.label}
                  className="flex flex-wrap items-center gap-3 rounded-xl bg-well px-3 py-2"
                >
                  {f.kind === "colour" ? (
                    <span
                      aria-hidden
                      className="h-6 w-6 shrink-0 rounded-full ring-1 ring-inset ring-black/25"
                      style={{ background: f.swatch || colourHex(f.label) }}
                    />
                  ) : (
                    <span className="grid h-6 min-w-8 shrink-0 place-items-center rounded-md bg-panel px-1.5 font-mono text-[10px] text-body">
                      {f.label}
                    </span>
                  )}

                  <span className="text-sm text-strong">{f.label}</span>
                  <span className="text-[11px] text-muted">
                    {uses(f)} product{uses(f) === 1 ? "" : "s"}
                  </span>
                  {!f.isActive && (
                    <span className="rounded-full bg-panel-2 px-2 py-0.5 text-[10px] uppercase tracking-[0.12em] text-muted">
                      hidden
                    </span>
                  )}

                  <div className="ml-auto flex items-center gap-1">
                    <form action={moveFilterAction}>
                      <input type="hidden" name="id" value={f.id} />
                      <input type="hidden" name="kind" value={kind} />
                      <input type="hidden" name="direction" value="up" />
                      <SubmitButton
                        pending="…"
                        ariaLabel={`Move ${f.label} up`}
                        className={`${buttonClass("ghost")} !px-2 !py-1`}
                      >
                        <ArrowUp className="h-3.5 w-3.5" />
                      </SubmitButton>
                    </form>
                    <form action={moveFilterAction}>
                      <input type="hidden" name="id" value={f.id} />
                      <input type="hidden" name="kind" value={kind} />
                      <input type="hidden" name="direction" value="down" />
                      <SubmitButton
                        pending="…"
                        ariaLabel={`Move ${f.label} down`}
                        className={`${buttonClass("ghost")} !px-2 !py-1`}
                      >
                        <ArrowDown className="h-3.5 w-3.5" />
                      </SubmitButton>
                    </form>
                    <form action={saveFilterAction}>
                      <input type="hidden" name="id" value={f.id} />
                      <input type="hidden" name="kind" value={kind} />
                      <input type="hidden" name="label" value={f.label} />
                      <input type="hidden" name="swatch" value={f.swatch} />
                      <input type="hidden" name="active" value={f.isActive ? "false" : "true"} />
                      <SubmitButton
                        pending="…"
                        ariaLabel={f.isActive ? `Hide ${f.label}` : `Show ${f.label}`}
                        className={`${buttonClass("ghost")} !px-2 !py-1`}
                      >
                        {f.isActive ? (
                          <EyeOff className="h-3.5 w-3.5" />
                        ) : (
                          <Eye className="h-3.5 w-3.5" />
                        )}
                      </SubmitButton>
                    </form>
                    <Link
                      href={`/admin/shop/filters?kind=${kind}&edit=${f.id}`}
                      className={`${buttonClass("ghost")} !px-2 !py-1 !text-[11px]`}
                    >
                      Edit
                    </Link>
                    <form action={deleteFilterAction}>
                      <input type="hidden" name="id" value={f.id} />
                      <input type="hidden" name="kind" value={kind} />
                      <SubmitButton
                        pending="…"
                        ariaLabel={`Delete ${f.label}`}
                        confirm={`Remove “${f.label}” from the filters? Products keep their values; the chip stops being offered.`}
                        className={`${buttonClass("danger")} !px-2 !py-1`}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </SubmitButton>
                    </form>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </div>
  );
}
