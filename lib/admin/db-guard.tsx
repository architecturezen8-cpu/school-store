import { backend, backendLabel, databaseFailure, probeSchema, schemaFailure, urlInvalid } from "@/lib/db";
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
 *
 * A database that is *behind* the app is the fourth case and it is not an
 * outage: it answers every query, and refuses only the ones that name something
 * this deployment has not created yet. It gets its own sentence and its own
 * button — see `schemaWarning` and `components/admin/DatabaseBar`.
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

/** The name inside `relation "shop_filters" does not exist`, if there is one. */
function missingObject(message: string): string {
  const relation = message.match(/relation "([^"]+)"/);
  if (relation) return `the “${relation[1]}” table`;
  const column = message.match(/column "([^"]+)"/);
  if (column) return `the “${column[1]}” column`;
  const fn = message.match(/function "?([^"(]+)"?\(/);
  if (fn) return `the “${fn[1]}” function`;
  return "a table it needs";
}

/**
 * The database answered, but it is older than this deployment.
 *
 * This is a *repairable* state — the button next to this sentence sends
 * `db/schema.sql`, which is idempotent — so the wording leads with what is
 * missing and what to press, not with an apology. Still, it says plainly that
 * the shelf on screen is the built-in catalogue until then, because that is what
 * it is.
 */
export async function schemaWarning(): Promise<string> {
  await probeSchema();
  const behind = schemaFailure();
  if (!behind) return "";

  const what = missingObject(behind.message);
  return (
    `The database is older than this version of the store: ${what} is not there yet. ` +
    "Screens that need it fall back to the built-in catalogue, and nothing saved there reaches " +
    "the database. Press “Update the database” — it applies db/schema.sql, which only ever adds " +
    "what is missing (from a terminal, npm run db:migrate)."
  );
}
