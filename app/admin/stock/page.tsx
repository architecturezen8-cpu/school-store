import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { isAdmin } from "@/lib/admin/auth";
import { databaseProblem } from "@/lib/admin/db-guard";
import { databaseDown, hasDatabase } from "@/lib/db";
import { listAdminProducts, type AdminProduct } from "@/lib/catalog";
import { listTierStock, runningLow } from "@/lib/stock";
import { comboKey, combosFor, LOW_STOCK } from "@/lib/stock-core";
import { lkr } from "@/lib/format";
import { safeDecode } from "@/lib/safe-decode";
import ParamToast from "@/components/admin/ParamToast";
import SubmitButton from "@/components/SubmitButton";
import {
  Empty,
  Eyebrow,
  Notice,
  PageHeader,
  Pill,
  buttonClass,
  inputClass,
} from "@/components/admin/ui";
import { AlertTriangle, ArrowUpRight, CalendarDays, Package } from "lucide-react";
import { saveTicketCapsAction, saveProductStockAction } from "./actions";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Stocks",
  robots: { index: false, follow: false },
};

/**
 * Stocks.
 *
 * One screen for the two shelves this shop has: products, counted per colour and
 * per size, and ticket tiers, counted per seat. They live in different tables and
 * are sold by different pages, but the office's question is the same — "what is
 * nearly gone?" — so the answer is in one place, at the top.
 *
 * A product with no numbers filled in is *not counted*: it sells freely and the
 * shop prints nothing about stock. That is the state every product was in before
 * this screen existed, and it stays one save away.
 */
export default async function StocksPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  if (!(await isAdmin())) redirect("/admin?next=/admin/stock");
  if (!hasDatabase()) redirect("/admin?error=database");

  const { ok, error } = await searchParams;
  const problem = databaseProblem();
  const down = databaseDown();

  const [products, tiers, low] = down
    ? [[], [], []] as [AdminProduct[], Awaited<ReturnType<typeof listTierStock>>, Awaited<ReturnType<typeof runningLow>>]
    : await Promise.all([listAdminProducts(), listTierStock(), runningLow()]);

  const soldOut = low.filter((l) => l.left === 0);
  const nearly = low.filter((l) => l.left > 0);

  return (
    <div className="space-y-3">
      <section className="rounded-2xl bg-panel p-6">
        <PageHeader
          eyebrow="The shop"
          title="Stocks"
          description="How many of each colour and size are on the shelf, and how many seats each ticket tier has left. The shop reads this screen: set a number and the item shows “Only N left”, runs out, and refuses to be oversold."
        />

        {(ok || error) && (
          <div className="mt-4">
            <ParamToast ok={ok ? safeDecode(ok) : ""} error={error ? safeDecode(error) : ""} />
          </div>
        )}
        {problem && (
          <div className="mt-4">
            <Notice tone="warn">{problem}</Notice>
          </div>
        )}

        {/* the whole point of the screen, first */}
        <div className="mt-6">
          {low.length === 0 ? (
            <p className="rounded-xl bg-well px-4 py-3 text-xs text-muted">
              Nothing is at or below {LOW_STOCK}. Anything that gets there appears here, at the
              top, before you have to go looking for it.
            </p>
          ) : (
            <div className="rounded-xl bg-well p-4">
              <div className="flex flex-wrap items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-gold" />
                <p className="text-sm font-semibold text-strong">
                  {soldOut.length > 0
                    ? `${soldOut.length} sold out`
                    : `${low.length} running low`}
                  {soldOut.length > 0 && nearly.length > 0 && `, ${nearly.length} running low`}
                </p>
                <span className="text-xs text-muted">
                  at or below {LOW_STOCK} — reorder before the shelf is bare.
                </span>
              </div>
              <ul className="mt-3 grid gap-1.5 sm:grid-cols-2 xl:grid-cols-3">
                {low.map((item) => (
                  <li
                    key={`${item.kind}-${item.id}-${item.detail}`}
                    className="flex items-center justify-between gap-2 rounded-lg bg-panel px-3 py-2"
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-xs font-medium text-strong">
                        {item.name}
                      </span>
                      <span className="block truncate text-[11px] text-muted">
                        {item.group} · {item.detail}
                      </span>
                    </span>
                    {/* The number is the whole shelf; the detail beside the name
                        says which part of it is bare. A hoodie with 34 on the
                        shelf and none in grey is not "34 left" and is not "gone"
                        — it needs both facts, side by side. */}
                    <span
                      className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.1em] ${
                        item.left === 0
                          ? "bg-panel-2 text-red-300"
                          : item.worst === 0
                            ? "bg-gold text-black"
                            : "bg-panel-2 text-body"
                      }`}
                    >
                      {item.left === 0 ? "gone" : `${item.left} left`}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </section>

      {/* ---------- products ---------- */}
      <section className="rounded-2xl bg-panel p-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <Eyebrow>Products</Eyebrow>
            <p className="mt-1 font-display text-lg text-strong">
              {products.length} item{products.length === 1 ? "" : "s"} on the shelf
            </p>
          </div>
          <Link href="/admin/shop" className={`${buttonClass("ghost")} !py-1.5 !text-xs`}>
            <Package className="h-3.5 w-3.5" /> The products screen
          </Link>
        </div>

        {products.length === 0 ? (
          <div className="mt-4">
            <Empty>No products yet.</Empty>
          </div>
        ) : (
          <div className="mt-4 space-y-2">
            {products.map((product) => (
              <ProductStockRow key={product.slug} product={product} />
            ))}
          </div>
        )}
      </section>

      {/* ---------- tickets ---------- */}
      <section className="rounded-2xl bg-panel p-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <Eyebrow>Tickets</Eyebrow>
            <p className="mt-1 font-display text-lg text-strong">
              Seats left, tier by tier
            </p>
            <p className="mt-1 max-w-xl text-xs leading-relaxed text-muted">
              A blank box means no cap — sell as many as turn up. A number caps the tier: the
              shop prints how many are left, and the booking form refuses the seats that are
              gone.
            </p>
          </div>
          <Link href="/admin/events" className={`${buttonClass("ghost")} !py-1.5 !text-xs`}>
            <CalendarDays className="h-3.5 w-3.5" /> Events
          </Link>
        </div>

        {tiers.length === 0 ? (
          <div className="mt-4">
            <Empty>No ticket tiers yet.</Empty>
          </div>
        ) : (
          <form action={saveTicketCapsAction} className="mt-4">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[34rem] text-left text-sm">
                <thead>
                  <tr className="text-[10px] uppercase tracking-[0.16em] text-muted">
                    <th className="pb-2 font-semibold">Tier</th>
                    <th className="pb-2 font-semibold">Price</th>
                    <th className="pb-2 font-semibold">Sold</th>
                    <th className="pb-2 font-semibold">Seats (blank = no cap)</th>
                    <th className="pb-2 font-semibold">Left</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line/60">
                  {tiers.map((tier) => (
                    <tr key={tier.id}>
                      <td className="py-2.5 pr-3">
                        <span className="block text-xs font-medium text-strong">{tier.name}</span>
                        <span className="block text-[11px] text-muted">{tier.eventTitle}</span>
                      </td>
                      <td className="py-2.5 pr-3 text-xs text-body">{lkr(tier.price)}</td>
                      <td className="py-2.5 pr-3 text-xs text-body">{tier.sold}</td>
                      <td className="py-2.5 pr-3">
                        <input
                          type="number"
                          min={0}
                          inputMode="numeric"
                          name={`cap:${tier.id}`}
                          defaultValue={tier.capacity ?? ""}
                          placeholder="no cap"
                          aria-label={`Seats for ${tier.eventTitle} — ${tier.name}`}
                          className={`${inputClass} !mt-0 !w-28 !py-1.5 !text-xs`}
                        />
                      </td>
                      <td className="py-2.5">
                        {tier.left === null ? (
                          <span className="text-[11px] text-muted">no cap</span>
                        ) : (
                          <span
                            className={`text-xs font-semibold ${
                              tier.left === 0
                                ? "text-red-300"
                                : tier.left <= LOW_STOCK
                                  ? "text-gold"
                                  : "text-body"
                            }`}
                          >
                            {tier.left === 0 ? "sold out" : `${tier.left} left`}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-4">
              <SubmitButton pending="Saving…" className={`${buttonClass("primary")} !py-2 !text-xs`}>
                Save seat caps
              </SubmitButton>
            </div>
          </form>
        )}
      </section>

      <p className="px-2 pb-2 text-[11px] leading-relaxed text-muted">
        A product with every box empty is <span className="text-body">not counted</span> — the
        shop sells it without printing a number. Fill in one box and every combination of that
        product becomes counted, with an empty box read as zero.
      </p>
    </div>
  );
}

/**
 * One product, collapsed.
 *
 * Seventeen products with a dozen boxes each is a wall of inputs nobody reads;
 * the summary line carries the only two facts needed to decide whether to open
 * it — how many are left, and whether it is nearly out.
 */
function ProductStockRow({ product }: { product: AdminProduct }) {
  const colours = product.colours;
  const sizes = (product.options?.values ?? []).map((v) => v.trim()).filter(Boolean);
  const cells = combosFor(colours, sizes);
  const stock = product.stock ?? {};
  const values = cells.map((cell) => Number(stock[comboKey(cell.colour, cell.size)]) || 0);
  const total = values.reduce((sum, n) => sum + n, 0);
  const counted = Object.keys(stock).length > 0;
  const lowest = counted ? Math.min(...values) : null;
  const empty = values.filter((n) => n === 0).length;

  return (
    <details className="rounded-xl bg-well px-4 py-3 [&[open]]:bg-well">
      <summary className="flex cursor-pointer flex-wrap items-center justify-between gap-2 text-sm">
        <span className="flex min-w-0 items-center gap-2">
          <span className="truncate font-medium text-strong">{product.name}</span>
          {!product.active && <Pill tone="stop">hidden</Pill>}
        </span>
        <span className="flex items-center gap-2">
          {counted && empty > 0 && empty < cells.length && (
            <span className="hidden text-[11px] text-muted sm:inline">
              {empty} of {cells.length} options gone
            </span>
          )}
          {!counted ? (
            <span className="rounded-full bg-panel px-2.5 py-0.5 text-[10px] uppercase tracking-[0.12em] text-muted">
              not counted
            </span>
          ) : total === 0 ? (
            <span className="rounded-full bg-panel-2 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.12em] text-red-300">
              sold out
            </span>
          ) : (
            <span
              className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.12em] ${
                lowest !== null && lowest <= LOW_STOCK ? "bg-gold text-black" : "bg-panel-2 text-strong"
              }`}
            >
              {total} left
            </span>
          )}
          <ArrowUpRight className="h-3.5 w-3.5 text-muted" />
        </span>
      </summary>

      <form action={saveProductStockAction} className="mt-3">
        <input type="hidden" name="slug" value={product.slug} />
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {cells.map((cell) => {
            const key = comboKey(cell.colour, cell.size);
            const value = stock[key];
            const label = [cell.colour, cell.size].filter(Boolean).join(" / ") || "This item";
            return (
              <label
                key={key}
                className="flex items-center justify-between gap-2 rounded-lg bg-panel px-3 py-2"
              >
                <span className="min-w-0 truncate text-[11px] font-medium text-body">{label}</span>
                <input
                  type="number"
                  min={0}
                  inputMode="numeric"
                  name={`q:${key}`}
                  defaultValue={value === undefined ? "" : value}
                  placeholder="—"
                  aria-label={`Stock for ${product.name} ${label}`}
                  className="w-16 rounded-md border border-line bg-well px-2 py-1 text-right text-xs text-strong outline-none focus:border-gold"
                />
              </label>
            );
          })}
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <SubmitButton pending="Saving…" className={`${buttonClass("secondary")} !py-1.5 !text-xs`}>
            Save this shelf
          </SubmitButton>
          <Link
            href={`/admin/shop/products/${product.slug}`}
            className="text-[11px] uppercase tracking-[0.14em] text-muted hover:text-strong"
          >
            Edit the product
          </Link>
          <span className="text-[11px] text-muted">Empty every box to stop counting it.</span>
        </div>
      </form>
    </details>
  );
}
