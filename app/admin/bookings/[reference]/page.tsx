import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, Ban, Mail, Trash2, Undo2 } from "lucide-react";
import { isAdmin } from "@/lib/admin/auth";
import { databaseProblem } from "@/lib/admin/db-guard";
import { databaseDown, hasDatabase } from "@/lib/db";
import { ticketsForBooking } from "@/lib/bookings";
import { lkr } from "@/lib/format";
import { safeDecode } from "@/lib/safe-decode";
import { asset } from "@/lib/assets";
import { signTicket } from "@/lib/tickets/sign";
import ParamToast from "@/components/admin/ParamToast";
import DownloadReceipt from "@/components/DownloadReceipt";
import SubmitButton from "@/components/SubmitButton";
import { Empty, Notice, PageHeader, Panel, Pill, buttonClass } from "@/components/admin/ui";
import { blockTicketAction, deleteTicketAction, resendTicketAction, unblockTicketAction } from "../../actions";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Booking",
  robots: { index: false, follow: false },
};

/**
 * One sale, one ticket at a time.
 *
 * This page exists because of a specific evening: a parent forwards a photo of
 * their QR, the person who received it arrives first, and the office has a
 * reference that names the *sale* — eight people — and nothing that names the
 * ticket that escaped. Each ticket has its own token and now its own printed code
 * (`BM-ABC12345-03`), so this is where that code is turned into a decision.
 *
 * Blocking and deleting are different tools and the page says so:
 *
 *   · **Block** keeps the ticket, stops the door. The bill still shows it, the
 *     gate says "blocked — do not admit", and it can be undone in one click.
 *   · **Delete** is for a ticket that should never have existed — a double click,
 *     a seat typed twice. It leaves no trace, so it is the wrong tool for a ticket
 *     that has been shared.
 */
export default async function BookingDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ reference: string }>;
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  if (!(await isAdmin())) redirect("/admin?next=/admin/bookings");
  if (!hasDatabase()) redirect("/admin?error=database");

  const { reference } = await params;
  const { ok, error } = await searchParams;
  const problem = databaseProblem();

  const tickets = databaseDown()
    ? []
    : await ticketsForBooking(decodeURIComponent(reference)).catch(() => []);

  const first = tickets[0];
  const back = "/admin/bookings";

  return (
    <div className="space-y-3">
      <section className="rounded-2xl bg-panel p-6">
        <PageHeader
          eyebrow="Bookings"
          title={first?.reference ?? decodeURIComponent(reference)}
          description={
            first
              ? `${first.name}${first.email ? ` · ${first.email}` : ""} · ${first.eventTitle}`
              : "No tickets on this booking."
          }
          actions={
            <>
              <Link href={back} className={buttonClass("ghost")}>
                <ArrowLeft className="h-4 w-4" /> All bookings
              </Link>
              {first && (
                <span className="inline-block">
                  <DownloadReceipt
                    href={asset(
                      `/api/tickets/${encodeURIComponent(first.token)}/receipt?s=${encodeURIComponent(
                        signTicket(first.token)
                      )}`
                    )}
                    pending="Drawing…"
                    showNote={false}
                    className={buttonClass("secondary")}
                  >
                    Bill (PDF)
                  </DownloadReceipt>
                </span>
              )}
              {first && (
                <form action={resendTicketAction}>
                  <input type="hidden" name="token" value={first.token} />
                  <SubmitButton
                    pending="Sending…"
                    className={buttonClass("secondary")}
                    icon={<Mail className="h-4 w-4" />}
                  >
                    Re-send to the buyer
                  </SubmitButton>
                </form>
              )}
            </>
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

      <Panel
        title="Tickets"
        description={
          first
            ? `${first.tiers.map((x) => (x.qty > 1 ? `${x.name} × ${x.qty}` : x.name)).join(", ")} · ${
                first.total === 0 ? "complimentary" : `paid ${lkr(first.total)}`
              } · each ticket admits one person, once.`
            : "Each ticket admits one person, once."
        }
      >
        {tickets.length === 0 ? (
          <Empty>Nothing here — the reference may be wrong, or every ticket was deleted.</Empty>
        ) : (
          <ul className="space-y-2">
            {tickets.map((t) => {
              const blocked = Boolean(t.blockedAt);
              const admitted = Boolean(t.admittedAt);
              return (
                <li
                  key={t.token}
                  className="flex flex-wrap items-center gap-x-4 gap-y-3 rounded-xl bg-well px-4 py-3"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-strong">
                      Ticket {t.seq} of {t.of}
                      <span className="ml-2 font-mono text-xs font-normal text-muted">{t.code}</span>
                    </p>
                    <p className="mt-0.5 text-xs text-muted">
                      {t.tierName || t.tiers[0]?.name || "Ticket"}
                      {blocked && ` · blocked ${new Date(t.blockedAt!).toLocaleString("en-GB")}`}
                    </p>
                  </div>

                  {blocked ? (
                    <Pill tone="stop">blocked</Pill>
                  ) : admitted ? (
                    <Pill tone="muted">
                      admitted {new Date(t.admittedAt!).toLocaleString("en-GB")}
                    </Pill>
                  ) : (
                    <Pill tone="ok">valid</Pill>
                  )}

                  <div className="flex items-center gap-2">
                    {blocked ? (
                      <form action={unblockTicketAction}>
                        <input type="hidden" name="token" value={t.token} />
                        <input type="hidden" name="reference" value={t.reference} />
                        <SubmitButton
                          pending="Lifting…"
                          className={`${buttonClass("secondary")} !px-3 !py-1.5 !text-xs`}
                          icon={<Undo2 className="h-3.5 w-3.5" />}
                        >
                          Unblock
                        </SubmitButton>
                      </form>
                    ) : (
                      <form action={blockTicketAction}>
                        <input type="hidden" name="token" value={t.token} />
                        <input type="hidden" name="reference" value={t.reference} />
                        <SubmitButton
                          pending="Blocking…"
                          className={`${buttonClass("secondary")} !px-3 !py-1.5 !text-xs`}
                          icon={<Ban className="h-3.5 w-3.5" />}
                        >
                          Block
                        </SubmitButton>
                      </form>
                    )}

                    <form action={deleteTicketAction}>
                      <input type="hidden" name="token" value={t.token} />
                      <input type="hidden" name="reference" value={t.reference} />
                      <SubmitButton
                        pending="Deleting…"
                        confirm={`Delete ${t.code}? The sale and its total stay as they are — only this ticket is removed. Use Block for a ticket that was shared.`}
                        className={`${buttonClass("danger")} !px-3 !py-1.5 !text-xs`}
                        icon={<Trash2 className="h-3.5 w-3.5" />}
                      >
                        Delete
                      </SubmitButton>
                    </form>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Panel>

      <Panel title="What the gate will say" tone="sunken">
        <ul className="space-y-2 text-xs leading-relaxed text-muted">
          <li>
            <span className="text-strong">Valid.</span> Admitted, once, and the time and
            gate are recorded.
          </li>
          <li>
            <span className="text-strong">Already admitted.</span> Shows when it was used,
            so a shared screenshot is obvious at the turnstile.
          </li>
          <li>
            <span className="text-strong">Blocked — do not admit.</span> A ticket you
            stopped here. The volunteer is told to send the person to the office.
          </li>
        </ul>
      </Panel>
    </div>
  );
}
