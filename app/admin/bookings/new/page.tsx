import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, TicketPlus } from "lucide-react";
import { isAdmin } from "@/lib/admin/auth";
import { databaseProblem } from "@/lib/admin/db-guard";
import { databaseDown, hasDatabase } from "@/lib/db";
import { listAllEvents } from "@/lib/events";
import { lkr } from "@/lib/format";
import { safeDecode } from "@/lib/safe-decode";
import ParamToast from "@/components/admin/ParamToast";
import SubmitButton from "@/components/SubmitButton";
import { Field, Notice, PageHeader, Panel, buttonClass, inputClass, selectClass } from "@/components/admin/ui";
import { issueTicketAction } from "../../actions";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Issue a ticket",
  robots: { index: false, follow: false },
};

/**
 * A ticket made at the counter.
 *
 * Not every seat is sold through the shop. The headmaster wants two, a sponsor's
 * name is written on an envelope, a parent pays the bursar in cash. All of those
 * need the same thing: a real ticket with a real QR that the gate will admit and
 * the bill will print — so this creates an ordinary booking, not a second kind of
 * ticket.
 *
 * One select, grouped by event, instead of an event select and a tier select that
 * can disagree with each other. The price is prefilled from the tier and can be
 * overridden — 0 for a comp — because the one number a school always ends up
 * changing is the number on a complimentary ticket.
 */
export default async function IssueTicketPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  if (!(await isAdmin())) redirect("/admin?next=/admin/bookings/new");
  if (!hasDatabase()) redirect("/admin?error=database");

  const { ok, error } = await searchParams;
  const problem = databaseProblem();
  const events = databaseDown() ? [] : await listAllEvents().catch(() => []);
  const withTiers = events.filter((e) => e.tiers.length > 0);

  return (
    <div className="space-y-3">
      <section className="rounded-2xl bg-panel p-6">
        <PageHeader
          eyebrow="Bookings"
          title="Issue a ticket"
          description="A comp, a sponsor's seat, cash at the door. It becomes a normal booking — same reference, same QR, same gate, same bill."
          actions={
            <Link href="/admin/bookings" className={buttonClass("ghost")}>
              <ArrowLeft className="h-4 w-4" /> All bookings
            </Link>
          }
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
      </section>

      <div className="grid gap-3 xl:grid-cols-[minmax(0,520px)_minmax(0,1fr)]">
        <Panel title="The ticket">
          {withTiers.length === 0 ? (
            <Notice tone="warn">
              No event has a ticket type yet. Add one on the event before issuing a
              ticket.
            </Notice>
          ) : (
            <form action={issueTicketAction} className="space-y-4">
              <Field label="Ticket type" hint="event · type · price">
                <select name="tier" required className={selectClass} defaultValue="">
                  <option value="" disabled>
                    Choose…
                  </option>
                  {withTiers.map((e) => (
                    <optgroup key={e.slug} label={e.title}>
                      {e.tiers.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name} — {lkr(t.price)}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </Field>

              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Name" hint="printed on the ticket">
                  <input name="name" placeholder="Counter ticket" className={inputClass} />
                </Field>
                <Field label="Email" hint="optional">
                  <input
                    name="email"
                    type="email"
                    placeholder="them@example.com"
                    className={inputClass}
                  />
                </Field>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Price" hint="blank = the tier's price">
                  <input
                    name="price"
                    type="number"
                    min={0}
                    step={50}
                    inputMode="numeric"
                    placeholder="e.g. 0 for a comp"
                    className={inputClass}
                  />
                </Field>
                <Field label="Note" hint="who asked, why">
                  <input name="note" placeholder="Comp — headmaster" className={inputClass} />
                </Field>
              </div>

              <label className="flex items-start gap-3 rounded-xl bg-well px-4 py-3">
                <input
                  type="checkbox"
                  name="send"
                  className="mt-0.5 h-4 w-4 accent-gold"
                  defaultChecked
                />
                <span className="text-xs leading-relaxed text-muted">
                  Email the ticket to that address, if one was given. The ticket is
                  created either way.
                </span>
              </label>

              <SubmitButton
                pending="Issuing the ticket…"
                className={`${buttonClass("primary")} w-full`}
                icon={<TicketPlus className="h-4 w-4" />}
              >
                Issue the ticket
              </SubmitButton>
            </form>
          )}
        </Panel>

        <Panel title="What happens next" tone="sunken">
          <ul className="space-y-3 text-xs leading-relaxed text-muted">
            <li>
              <span className="text-strong">A booking is created.</span> It gets its own
              reference like any sale, so it appears in the list, in the takings and on
              the bill.
            </li>
            <li>
              <span className="text-strong">One ticket, one code.</span> The QR works at
              the gate the moment it exists; the code (<span className="font-mono">BM-…-01</span>)
              is what you quote over the phone.
            </li>
            <li>
              <span className="text-strong">The price is yours.</span> Leave it blank for
              the tier price, set 0 for a comp, or type what was handed over.
            </li>
            <li>
              <span className="text-strong">Blocked, deleted, re-sent</span> — the same as
              any other ticket, from the booking&apos;s page.
            </li>
          </ul>
        </Panel>
      </div>
    </div>
  );
}
