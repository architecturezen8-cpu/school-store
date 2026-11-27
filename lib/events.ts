import { randomUUID } from "node:crypto";
import { getEvents } from "./store";
import { databaseDown, query, transaction } from "./db";
import { errorMessage } from "./errors";
export { slugify, uniqueSlug } from "./slug";
import type { CollegeEvent, EventImage, EventLink, EventRule, Tier } from "@/data/seed";

/**
 * Editing events.
 *
 * `lib/store.ts` owns the read the storefront does: published events, mapped into
 * the shape the pages want. This module owns the other half — the admin's view,
 * which needs drafts, an order, and the ability to write. It is deliberately
 * separate so nothing in the shop can accidentally start showing an unpublished
 * event because a query changed.
 *
 * Two rules run through all of it:
 *
 *   · a slug is an address, so it is generated once and never silently rewritten
 *     — a changed slug breaks every link and every QR already printed;
 *   · a ticket tier belongs to bookings once it has been sold, so editing prices
 *     never deletes or renumbers one that has been used. Tiers are matched by id:
 *     existing ids are updated, new ones inserted, and a removed one is only
 *     deleted when nothing references it.
 */

export type EventDraft = {
  slug: string;
  title: string;
  subtitle: string;
  tagline: string;
  description: string;
  story: string;
  venue: string;
  city: string;
  startsAt: string; // ISO
  endsAt: string; // ISO or ""
  doors: string;
  image: string;
  heroImage: string;
  heroKicker: string;
  tag: string;
  featured: boolean;
  published: boolean;
  position: number;
  rules: EventRule[];
  gallery: EventImage[];
  links: EventLink[];
  tiers: Tier[];
};

export type AdminEvent = EventDraft & { tierCount: number };

const EMPTY: EventDraft = {
  slug: "",
  title: "",
  subtitle: "",
  tagline: "",
  description: "",
  story: "",
  venue: "",
  city: "",
  startsAt: "",
  endsAt: "",
  doors: "",
  image: "",
  heroImage: "",
  heroKicker: "",
  tag: "",
  featured: false,
  published: true,
  position: 0,
  rules: [],
  gallery: [],
  links: [],
  tiers: [],
};

/** `the-big-match-2027` — lowercase, dashes, nothing that needs escaping in a URL. */
export function eventSlug(title: string): string {
  return (
    title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || `event-${Date.now().toString(36)}`
  );
}

type Row = {
  slug: string;
  title: string;
  subtitle: string;
  description: string;
  venue: string;
  city: string;
  starts_at: string;
  doors: string;
  image: string;
  tag: string | null;
  featured: boolean;
  published: boolean;
  tagline: string | null;
  story: string | null;
  rules: unknown;
  gallery: unknown;
  links: unknown;
  hero_image: string | null;
  hero_kicker: string | null;
  ends_at: string | null;
  position: number | null;
};

const COLUMNS = `slug, title, subtitle, description, venue, city, starts_at, doors,
                 image, tag, featured, published, tagline, story, rules, gallery,
                 links, hero_image, hero_kicker, ends_at, position`;

const asArray = <T>(value: unknown, map: (v: Record<string, unknown>) => T | null): T[] => {
  const raw = typeof value === "string" ? (JSON.parse(value || "[]") as unknown) : value;
  if (!Array.isArray(raw)) return [];
  return raw
    .map((v) => (v && typeof v === "object" ? map(v as Record<string, unknown>) : null))
    .filter((v): v is T => v !== null);
};

const str = (v: unknown) => String(v ?? "").trim();

function toDraft(row: Row): EventDraft {
  return {
    ...EMPTY,
    slug: row.slug,
    title: row.title,
    subtitle: row.subtitle ?? "",
    description: row.description ?? "",
    venue: row.venue ?? "",
    city: row.city ?? "",
    doors: row.doors ?? "",
    image: row.image ?? "",
    tag: row.tag ?? "",
    featured: row.featured,
    published: row.published,
    tagline: row.tagline ?? "",
    story: row.story ?? "",
    heroImage: row.hero_image ?? "",
    heroKicker: row.hero_kicker ?? "",
    // `<input type="datetime-local">` wants `YYYY-MM-DDTHH:mm` in local time, and
    // that is the only format it will render back.
    startsAt: toLocalInput(row.starts_at),
    endsAt: toLocalInput(row.ends_at),
    position: row.position ?? 0,
    rules: asArray(row.rules, (r) => {
      const rule = { title: str(r.title), body: str(r.body) };
      return rule.title || rule.body ? rule : null;
    }),
    gallery: asArray(row.gallery, (g) => {
      const url = str(g.url);
      return url ? { url, ...(str(g.caption) ? { caption: str(g.caption) } : {}) } : null;
    }),
    links: asArray(row.links, (l) => {
      const label = str(l.label);
      const url = str(l.url);
      return label && url ? { label, url } : null;
    }),
    tiers: [],
  };
}

function toLocalInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours()
  )}:${pad(d.getMinutes())}`;
}

/** Everything, drafts included, in the admin's order. */
export async function listAllEvents(): Promise<AdminEvent[]> {
  if (databaseDown()) return [];
  try {
    const [rows, tiers] = await Promise.all([
      query<Row>(`select ${COLUMNS} from events order by position, starts_at`),
      query<{
        id: string;
        event: string;
        name: string;
        price: number;
        perks: string[] | null;
        note: string | null;
        position: number;
        capacity: number | null;
        sold: number | null;
      }>(
        "select id, event, name, price, perks, note, position, capacity, sold from ticket_tiers order by event, position"
      ),
    ]);

    const byEvent = new Map<string, Tier[]>();
    for (const t of tiers) {
      const list = byEvent.get(t.event) ?? [];
      list.push({
        id: t.id,
        name: t.name,
        price: Number(t.price),
        perks: Array.isArray(t.perks) ? t.perks : [],
        note: t.note ?? undefined,
        capacity: t.capacity === null ? null : Number(t.capacity),
        sold: Number(t.sold ?? 0),
      });
      byEvent.set(t.event, list);
    }

    return rows.map((r) => ({
      ...toDraft(r),
      tiers: byEvent.get(r.slug) ?? [],
      tierCount: (byEvent.get(r.slug) ?? []).length,
    }));
  } catch (err) {
    console.error("[events] could not list:", errorMessage(err));
    return [];
  }
}

/** One event, drafts included, or null. */
export async function getEventDraft(slug: string): Promise<AdminEvent | null> {
  if (databaseDown()) return null;
  try {
    const rows = await query<Row>(`select ${COLUMNS} from events where slug = $1`, [slug]);
    if (!rows[0]) return null;
    const tiers = await query<{
      id: string;
      name: string;
      price: number;
      perks: string[] | null;
      note: string | null;
      capacity: number | null;
      sold: number | null;
    }>(
      "select id, name, price, perks, note, capacity, sold from ticket_tiers where event = $1 order by position",
      [slug]
    );
    const mapped: Tier[] = tiers.map((t) => ({
      id: t.id,
      name: t.name,
      price: Number(t.price),
      perks: Array.isArray(t.perks) ? t.perks : [],
      note: t.note ?? undefined,
      capacity: t.capacity === null ? null : Number(t.capacity),
      sold: Number(t.sold ?? 0),
    }));
    return { ...toDraft(rows[0]), tiers: mapped, tierCount: mapped.length };
  } catch (err) {
    console.error("[events] could not read:", errorMessage(err));
    return null;
  }
}

export type SaveResult =
  | { ok: true; slug: string; created: boolean }
  | { ok: false; error: string };

/** Dates arrive as `datetime-local` strings; store them as UTC. */
function toIso(value: string): string | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

function validate(draft: EventDraft): string {
  if (!draft.title.trim()) return "Give the event a name.";
  if (!/^[a-z0-9-]{2,60}$/.test(draft.slug)) {
    return "The web address must be lowercase letters, numbers and dashes (2–60 characters).";
  }
  if (!toIso(draft.startsAt)) return "Set the date and time the event starts.";
  if (draft.endsAt && toIso(draft.endsAt) && toIso(draft.endsAt)! < toIso(draft.startsAt)!) {
    return "The event cannot end before it starts.";
  }
  for (const t of draft.tiers) {
    if (!t.name.trim()) return "Every ticket type needs a name.";
    if (!Number.isFinite(t.price) || t.price < 0) return "A ticket price cannot be negative.";
    if (!/^[a-z0-9-]{2,80}$/.test(t.id)) {
      return `The ticket type “${t.name}” has an invalid id.`;
    }
  }
  const ids = new Set(draft.tiers.map((t) => t.id));
  if (ids.size !== draft.tiers.length) return "Two ticket types share an id.";
  return "";
}

/**
 * Insert or update, in one transaction, tiers included.
 *
 * `create` is separate from `save` on purpose: creating with a slug that already
 * exists would otherwise silently overwrite somebody else's event.
 */
export async function saveEvent(draft: EventDraft, mode: "create" | "update"): Promise<SaveResult> {
  const problem = validate(draft);
  if (problem) return { ok: false, error: problem };

  const startsAt = toIso(draft.startsAt)!;
  const endsAt = toIso(draft.endsAt);

  try {
    await transaction(async (tx) => {
      if (mode === "create") {
        const clash = await tx.query<{ n: number }>(
          "select count(*)::int as n from events where slug = $1",
          [draft.slug]
        );
        if (Number(clash.rows[0]?.n ?? 0) > 0) {
          throw new Error(`An event already uses the address “${draft.slug}”.`);
        }
      }

      await tx.query(
        `insert into events
           (slug, title, subtitle, description, venue, city, starts_at, doors, tag,
            image, featured, published, tagline, story, rules, gallery, links,
            hero_image, hero_kicker, ends_at, position)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21)
         on conflict (slug) do update set
           title = excluded.title,
           subtitle = excluded.subtitle,
           description = excluded.description,
           venue = excluded.venue,
           city = excluded.city,
           starts_at = excluded.starts_at,
           doors = excluded.doors,
           tag = excluded.tag,
           image = excluded.image,
           featured = excluded.featured,
           published = excluded.published,
           tagline = excluded.tagline,
           story = excluded.story,
           rules = excluded.rules,
           gallery = excluded.gallery,
           links = excluded.links,
           hero_image = excluded.hero_image,
           hero_kicker = excluded.hero_kicker,
           ends_at = excluded.ends_at,
           position = excluded.position`,
        [
          draft.slug,
          draft.title.trim().slice(0, 160),
          draft.subtitle.trim(),
          draft.description.trim(),
          draft.venue.trim(),
          draft.city.trim(),
          startsAt,
          draft.doors.trim(),
          draft.tag.trim() || null,
          draft.image.trim(),
          draft.featured,
          draft.published,
          draft.tagline.trim(),
          draft.story.trim(),
          JSON.stringify(draft.rules.filter((r) => r.title.trim() || r.body.trim())),
          JSON.stringify(draft.gallery.filter((g) => g.url.trim())),
          JSON.stringify(draft.links.filter((l) => l.label.trim() && l.url.trim())),
          draft.heroImage.trim(),
          draft.heroKicker.trim(),
          endsAt,
          Number.isFinite(draft.position) ? draft.position : 0,
        ]
      );

      // Tiers: update the ones that are still here, add the new ones, and only
      // delete a removed one if no booking has ever referenced it.
      for (const [i, t] of draft.tiers.entries()) {
        // Blank means "as many as turn up" — the shop then prints no countdown
        // and the booking refuses nothing. A number is a hard cap on seats.
        const raw = t.capacity;
        const capacity =
          raw === null || raw === undefined || String(raw).trim() === ""
            ? null
            : Math.max(0, Math.round(Number(raw)) || 0);

        /*
          A cap below the seats already sold is not a smaller cap, it is a lie:
          the database refuses it (sold <= capacity) and the office gets a
          constraint name instead of a sentence. Say the sentence here, with the
          numbers, while there is still a form on screen to correct.
        */
        if (capacity !== null) {
          const { rows: soldRows } = await tx.query<{ sold: number; name: string }>(
            "select sold, name from ticket_tiers where id = $1",
            [t.id]
          );
          const sold = Number(soldRows[0]?.sold ?? 0);
          if (sold > capacity) {
            const label = t.name.trim() || soldRows[0]?.name || "That ticket type";
            throw new Error(
              `${label} has ${sold} seat${sold === 1 ? "" : "s"} sold — the cap cannot be lower than that.`
            );
          }
        }

        await tx.query(
          `insert into ticket_tiers (id, event, name, price, perks, note, position, capacity)
           values ($1,$2,$3,$4,$5,$6,$7,$8)
           on conflict (id) do update set
             name = excluded.name,
             price = excluded.price,
             perks = excluded.perks,
             note = excluded.note,
             position = excluded.position,
             capacity = excluded.capacity
           where ticket_tiers.event = excluded.event`,
          [
            t.id,
            draft.slug,
            t.name.trim().slice(0, 80),
            Math.round(t.price),
            JSON.stringify((t.perks ?? []).map((p) => p.trim()).filter(Boolean)),
            t.note?.trim() || null,
            i,
            capacity,
          ]
        );
      }

      const keep = draft.tiers.map((t) => t.id);
      const removed = await tx.query<{ id: string }>(
        `select id from ticket_tiers
          where event = $1 and id <> all($2::text[])
            and not exists (select 1 from booking_items bi where bi.tier = ticket_tiers.id)`,
        [draft.slug, keep.length ? keep : [""]]
      );
      for (const row of removed.rows) {
        await tx.query("delete from ticket_tiers where id = $1", [row.id]);
      }
    });

    return { ok: true, slug: draft.slug, created: mode === "create" };
  } catch (err) {
    return { ok: false, error: errorMessage(err) };
  }
}

/** Deletes an event, its tiers, and its design — but never a booking. */
export async function deleteEvent(slug: string): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const booked = await query<{ n: number }>(
      "select count(*)::int as n from bookings where event = $1",
      [slug]
    );
    if (Number(booked[0]?.n ?? 0) > 0) {
      return {
        ok: false,
        error:
          "That event has bookings, so it cannot be deleted — unpublish it instead and it leaves the shop while the tickets keep working.",
      };
    }
    await transaction(async (tx) => {
      await tx.query("delete from ticket_templates where event = $1", [slug]);
      await tx.query("delete from ticket_tiers where event = $1", [slug]);
      await tx.query("delete from events where slug = $1", [slug]);
    });
    return { ok: true };
  } catch (err) {
    return { ok: false, error: errorMessage(err) };
  }
}

/**
 * The featured event, set in one statement.
 *
 * There is one big slot on /tickets and exactly one event may hold it; doing it
 * in a transaction stops two saves racing into a state with no hero.
 */
/**
 * Put an event in the /tickets spotlight. Several events can be featured at
 * once — they stack down the page, each with its own countdown — so this no
 * longer clears the flag on the others.
 */
export async function setFeatured(slug: string): Promise<void> {
  await transaction(async (tx) => {
    await tx.query("update events set featured = true, published = true where slug = $1", [slug]);
  });
}

/** Take an event out of the spotlight without un-publishing it. */
export async function unsetFeatured(slug: string): Promise<void> {
  await query("update events set featured = false where slug = $1", [slug]);
}


/** Used by the admin's "add" form, where no row exists yet. */
export function blankDraft(): EventDraft {
  return {
    ...EMPTY,
    rules: [],
    gallery: [],
    links: [],
    tiers: [
      { id: "standard", name: "Standard Entrance", price: 500, perks: [] },
    ],
  };
}

/** Everything the storefront can see — used by the admin's "preview" link. */
export async function publishedEvents(): Promise<CollegeEvent[]> {
  return getEvents();
}
