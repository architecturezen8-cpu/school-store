import { Ban, Trash2, TimerReset, Undo2 } from "lucide-react";
import type { TicketSummary } from "@/lib/bookings";
import { Pill, buttonClass, selectClass } from "@/components/admin/ui";
import SubmitButton from "@/components/SubmitButton";
import { blockTicketAction, deleteTicketAction, pauseTicketAction, unblockTicketAction } from "@/app/admin/actions";

/**
 * One ticket, and the three decisions the office can make about it.
 *
 * Drag it onto a booking's page and the row is the same in both places, so the
 * wording a volunteer learns on one screen is the wording on the other.
 *
 *   · **Block** — shut until the admin says otherwise.
 *   · **Pause** — shut for a set number of minutes, then open again by itself.
 *   · **Delete** — the ticket should not exist at all.
 *
 * The code is shown first and in the mono face: it is the thing a parent reads
 * down a phone line, and the thing typed into the gate when a QR has been
 * creased.
 */
export default function TicketControls({
  ticket,
  back,
  reference,
}: {
  ticket: TicketSummary;
  /** Which admin page to return to, so the list does not bounce to the sale. */
  back: string;
  reference: string;
}) {
  const pendings = ticket.blocked
    ? ticket.blockedUntil
      ? `paused until ${new Date(ticket.blockedUntil).toLocaleString("en-GB", {
          day: "numeric",
          month: "short",
          hour: "2-digit",
          minute: "2-digit",
        })}`
      : ticket.blockedAt
        ? `blocked ${new Date(ticket.blockedAt).toLocaleString("en-GB", {
            day: "numeric",
            month: "short",
            hour: "2-digit",
            minute: "2-digit",
          })}`
        : "blocked"
    : "";

  return (
    <li
      data-ticket={ticket.code}
      className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-lg bg-panel px-3 py-2"
    >
      <span className="w-6 shrink-0 font-mono text-[11px] text-faint">
        {String(ticket.seq).padStart(2, "0")}
      </span>

      <span className="font-mono text-xs font-semibold text-strong">{ticket.code}</span>
      {ticket.tierName && <span className="text-[11px] text-muted">{ticket.tierName}</span>}

      {ticket.blocked ? (
        <Pill tone="stop">{pendings}</Pill>
      ) : ticket.admittedAt ? (
        <Pill tone="muted">
          gate{" "}
          {new Date(ticket.admittedAt).toLocaleString("en-GB", {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </Pill>
      ) : (
        <Pill tone="ok">valid</Pill>
      )}

      <div className="ml-auto flex flex-wrap items-center gap-1.5">
        {ticket.blocked ? (
          <form action={unblockTicketAction}>
            <input type="hidden" name="token" value={ticket.token} />
            <input type="hidden" name="reference" value={reference} />
            <input type="hidden" name="back" value={back} />
            <SubmitButton
              pending="Lifting…"
              className={`${buttonClass("secondary")} !px-2.5 !py-1 !text-[11px]`}
              icon={<Undo2 className="h-3 w-3" />}
            >
              Unblock
            </SubmitButton>
          </form>
        ) : (
          <>
            <form action={blockTicketAction}>
              <input type="hidden" name="token" value={ticket.token} />
              <input type="hidden" name="reference" value={reference} />
              <input type="hidden" name="back" value={back} />
              <SubmitButton
                pending="Blocking…"
                className={`${buttonClass("secondary")} !px-2.5 !py-1 !text-[11px]`}
                icon={<Ban className="h-3 w-3" />}
              >
                Block
              </SubmitButton>
            </form>

            {/* A pause is a block with an end time, so it needs one decision
                the block does not: how long. Offered in the units the office
                actually thinks in, not in minutes. */}
            <form action={pauseTicketAction} className="flex items-center gap-1">
              <input type="hidden" name="token" value={ticket.token} />
              <input type="hidden" name="reference" value={reference} />
              <input type="hidden" name="back" value={back} />
              <select
                name="minutes"
                defaultValue="60"
                aria-label={`Pause ${ticket.code} for how long`}
                className={`${selectClass} !w-auto !bg-well !px-2 !py-1 !text-[11px] !text-body`}
              >
                <option value="15">15m</option>
                <option value="60">1h</option>
                <option value="180">3h</option>
                <option value="720">12h</option>
                <option value="1440">1d</option>
              </select>
              <SubmitButton
                pending="Pausing…"
                className={`${buttonClass("secondary")} !px-2.5 !py-1 !text-[11px]`}
                icon={<TimerReset className="h-3 w-3" />}
              >
                Pause
              </SubmitButton>
            </form>
          </>
        )}

        <form action={deleteTicketAction}>
          <input type="hidden" name="token" value={ticket.token} />
          <input type="hidden" name="reference" value={reference} />
          <input type="hidden" name="back" value={back} />
          <SubmitButton
            pending="Deleting…"
            confirm={`Delete ${ticket.code}? The sale and its total stay as they are — only this ticket is removed. Use Block or Pause for a ticket that was shared.`}
            className={`${buttonClass("danger")} !px-2.5 !py-1 !text-[11px]`}
            icon={<Trash2 className="h-3 w-3" />}
          >
            Delete
          </SubmitButton>
        </form>
      </div>
    </li>
  );
}
