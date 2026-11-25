import { backend, backendLabel, databaseFailure, urlInvalid } from "@/lib/db";
import { friendlyError } from "@/lib/errors";

/**
 * What to tell the admin when the database is not usable.
 *
 * Three ways to be broken, and they need different sentences — but all three
 * have to say the uncomfortable part out loud. The panel still renders when the
 * database is gone, which means it is reading something else. Silence about
 * where the numbers come from is how a shop ends up believing its own rows are
 * intact while it looks at a copy.
 *
 *   · A `pg` backend that will not connect  → nothing is reading it; the panel
 *     is empty and the shop is on the seed catalogue.
 *   · A URL that is not a URL               → the code fell back to the embedded
 *     database, so that is genuinely what is on screen.
 *   · Nothing configured                    → the catalogue is read-only.
 */
export function databaseProblem(): string {
  if (urlInvalid) {
    return `${urlInvalid} Meanwhile the panel and the shop are reading the ${backendLabel} — anything saved here stays on this machine.`;
  }

  const failed = databaseFailure();
  if (failed) {
    return `The database did not answer. ${friendlyError(
      failed
    )} Nothing here is reading it: this panel stays empty and the shop serves its built-in catalogue until it answers.`;
  }

  if (backend === "none") {
    return "No database is configured. Set DATABASE_URL (or leave it blank to use the built-in one) and restart.";
  }

  return "";
}
