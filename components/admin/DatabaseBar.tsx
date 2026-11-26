import { schemaWarning } from "@/lib/admin/db-guard";
import { applySchemaAction } from "@/app/admin/actions";
import { buttonClass } from "@/components/admin/ui";
import { CircleAlert, DatabaseZap } from "lucide-react";

/**
 * The bar that appears when the database is one migration behind the app.
 *
 * It lives in the admin layout rather than on each page, because the problem is
 * not specific to a screen: it is the whole admin reading the built-in catalogue
 * while the office types into it. Twelve copies of one warning would be noise;
 * one bar that follows you is a reminder.
 *
 * The button is the point. `applySchemaAction` sends `db/schema.sql`, whose every
 * statement is idempotent — create-if-not-exists, insert-on-conflict, and one-shot
 * blocks guarded by `applied_migrations` — so pressing it on a healthy database is
 * a no-op, and pressing it on a stale one is exactly `npm run db:migrate`.
 */
export default async function DatabaseBar() {
  const warning = await schemaWarning();
  if (!warning) return null;

  return (
    <div
      role="status"
      className="mb-3 flex flex-col gap-3 rounded-2xl bg-gold/10 p-4 ring-1 ring-gold/30 sm:flex-row sm:items-center"
    >
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-gold/15 text-gold">
        <CircleAlert className="h-4 w-4" />
      </span>
      <p className="flex-1 text-xs leading-relaxed text-body">{warning}</p>
      <form action={applySchemaAction}>
        <button type="submit" className={buttonClass("primary")}>
          <DatabaseZap className="h-4 w-4" />
          Update the database
        </button>
      </form>
    </div>
  );
}
