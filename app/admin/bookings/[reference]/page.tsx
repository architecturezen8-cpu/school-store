import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, Mail } from "lucide-react";
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
import { resendTicketAction } from "../../actions";
import TicketControls from "@/components/admin/TicketControls";

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
          <ul className="space-y-1.5">
            {tickets.map((t) => (
              <TicketControls
                key={t.token}
                ticket={{
                  seq: t.seq,
                  token: t.token,
                  code: t.code,
                  tierName: t.tierName,
                  admittedAt: t.admittedAt,
                  blocked: t.blocked,
                  blockedAt: t.blockedAt,
                  blockedUntil: t.blockedUntil,
                }}
                reference={t.reference}
                back={`/admin/bookings/${encodeURIComponent(t.reference)}`}
              />
            ))}
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
            stopped here, or one paused until later. The volunteer is told to send the
            person to the office.
          </li>
        </ul>
      </Panel>
    </div>
  );
}
