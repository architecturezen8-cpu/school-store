-- ---------------------------------------------------------------------------
--  The Thomian Store — Postgres schema
--  Works on any Postgres 14+ (Neon, Supabase, Vercel Postgres, RDS, local).
--  Apply with:  psql "$DATABASE_URL" -f db/schema.sql
--          or:  npm run db:migrate
-- ---------------------------------------------------------------------------

-- gen_random_uuid() ships with Postgres 13+, so no extension is required.
-- (Avoids needing CREATE EXTENSION rights on managed hosts.)

-- ---------- catalogue -------------------------------------------------------
create table if not exists categories (
  slug        text primary key,
  title       text not null,
  description text not null default '',
  image       text not null default '',
  blurb       text not null default '',
  position    integer not null default 0
);

create table if not exists products (
  slug        text primary key,
  name        text not null,
  price       integer not null check (price >= 0),   -- stored in whole LKR
  image       text not null default '',
  tag         text,
  category    text not null references categories (slug) on delete restrict,
  rating      numeric(2,1) not null default 0,
  reviews     integer not null default 0,
  description text not null default '',
  details     jsonb not null default '[]'::jsonb,
  options     jsonb,
  gallery     jsonb not null default '[]'::jsonb,
  colours     jsonb not null default '[]'::jsonb,
  is_featured boolean not null default false,
  is_new      boolean not null default false,
  active      boolean not null default true,
  created_at  timestamptz not null default now()
);

create index if not exists products_category_idx on products (category) where active;
create index if not exists products_featured_idx on products (is_featured) where active;

create table if not exists reviews (
  id         bigserial primary key,
  name       text not null,
  role       text not null default '',
  body       text not null,
  rating     smallint not null default 5 check (rating between 1 and 5),
  position   integer not null default 0
);

-- ---------- events & tickets ------------------------------------------------
create table if not exists events (
  slug          text primary key,
  title         text not null,
  subtitle      text not null default '',
  description   text not null default '',
  venue         text not null default '',
  city          text not null default '',
  starts_at     timestamptz not null,
  doors         text not null default '',
  tag           text,
  image         text not null default '',
  featured      boolean not null default false,
  published     boolean not null default true
);

create table if not exists ticket_tiers (
  id        text primary key,                        -- e.g. "big-match-grandstand"
  event     text not null references events (slug) on delete cascade,
  name      text not null,
  price     integer not null check (price >= 0),
  perks     jsonb not null default '[]'::jsonb,
  note      text,
  capacity  integer,
  sold      integer not null default 0,
  position  integer not null default 0
);

create index if not exists ticket_tiers_event_idx on ticket_tiers (event);

-- ---------- orders ----------------------------------------------------------
create sequence if not exists order_number_seq start 1042;

create table if not exists orders (
  id           uuid primary key default gen_random_uuid(),
  reference    text not null unique
                 default 'STC-' || lpad(nextval('order_number_seq')::text, 5, '0'),
  email        text not null,
  phone        text not null default '',
  name         text not null default '',
  subtotal     integer not null check (subtotal >= 0),
  delivery     integer not null default 0 check (delivery >= 0),
  total        integer not null check (total >= 0),
  status       text not null default 'pending'
                 check (status in ('pending', 'paid', 'packed', 'shipped', 'delivered', 'cancelled')),
  note         text not null default '',
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists orders_email_idx on orders (lower(email));
create index if not exists orders_created_idx on orders (created_at desc);

create table if not exists order_items (
  id          bigserial primary key,
  order_id    uuid not null references orders (id) on delete cascade,
  slug        text not null references products (slug) on delete restrict,
  name        text not null,                          -- snapshot at purchase time
  price       integer not null check (price >= 0),    -- snapshot
  qty         integer not null check (qty > 0 and qty <= 99),
  variant     text not null default ''
);

create index if not exists order_items_order_idx on order_items (order_id);

create table if not exists order_events (
  id         bigserial primary key,
  order_id   uuid not null references orders (id) on delete cascade,
  status     text not null,
  message    text not null default '',
  created_at timestamptz not null default now()
);

-- ---------- ticket bookings -------------------------------------------------
create table if not exists bookings (
  id         uuid primary key default gen_random_uuid(),
  reference  text not null unique,
  event      text not null references events (slug) on delete restrict,
  name       text not null,
  email      text not null,
  phone      text not null default '',
  total      integer not null check (total >= 0),
  status     text not null default 'confirmed'
               check (status in ('confirmed', 'cancelled')),
  created_at timestamptz not null default now()
);

create table if not exists booking_items (
  id      bigserial primary key,
  booking uuid not null references bookings (id) on delete cascade,
  tier    text not null references ticket_tiers (id) on delete restrict,
  qty     integer not null check (qty > 0)
);

-- ---------- keep updated_at honest ------------------------------------------
create or replace function set_updated_at() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists orders_touch_updated_at on orders;
create trigger orders_touch_updated_at
  before update on orders
  for each row execute function set_updated_at();

-- ---------- ticket templates ------------------------------------------------
-- An admin uploads a ticket design with a plain white square in it. When a
-- booking is confirmed the store detects that square inside the source image and
-- pastes each attendee's QR code into it (see lib/tickets/compose.ts).

create table if not exists ticket_templates (
  id         uuid primary key default gen_random_uuid(),
  slug       text not null unique,
  -- One template can cover a single event or be the default for all of them.
  -- `event` null = fallback used when an event has no template of its own.
  event      text references events (slug) on delete cascade,
  name       text not null,
  -- The uploaded design, kept under public/uploads/templates/ as <id>.<ext>
  file       text not null,
  width      integer not null check (width > 0),
  height     integer not null check (height > 0),
  -- Where the white square was found, in pixels of the source image.
  qr_x       integer not null,
  qr_y       integer not null,
  qr_size    integer not null check (qr_size > 0),
  -- Optional font for the recipient's name/seat line; empty = default
  font       text not null default '',
  is_active  boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists ticket_templates_event_idx on ticket_templates (event) where is_active;

-- ---------- the ticket email -----------------------------------------------
-- One row. Each column overrides the message built into lib/tickets/email.ts;
-- an empty column means "use the default", so the admin can reset a field by
-- clearing it instead of retyping the original.

create table if not exists mail_templates (
  id         integer primary key check (id = 1),
  subject    text not null default '',
  heading    text not null default '',
  body       text not null default '',
  footer     text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists mail_templates_touch_updated_at on mail_templates;
create trigger mail_templates_touch_updated_at
  before update on mail_templates
  for each row execute function set_updated_at();

-- ---------- ticket scans ---------------------------------------------------
-- Every booking gets one admission ticket. Its QR carries the reference plus a
-- signature, so a phone that scans it can show the details without trusting the
-- URL, and the gate can mark it admitted. `admitted_ref` stops the double entry
-- in the same statement that sets the timestamp.

alter table bookings
  add column if not exists ticket_token  text,
  add column if not exists admitted_at   timestamptz,
  add column if not exists admitted_by   text not null default '';

-- Existing rows (there should be none) get a token from the reference, which is
-- already unique and unguessable enough; new rows generate one in lib/bookings.
update bookings set ticket_token = reference where ticket_token is null;
create unique index if not exists bookings_ticket_token_idx on bookings (ticket_token);

alter table bookings
  add column if not exists updated_at timestamptz not null default now();

drop trigger if exists bookings_touch_updated_at on bookings;
create trigger bookings_touch_updated_at
  before update on bookings
  for each row execute function set_updated_at();

-- ---------- event pages ------------------------------------------------------
-- An event used to be six columns and a picture: enough for a card, not enough
-- for a page. These are the parts an admin writes — the hero copy, the story,
-- the rules, the gallery and the links — plus the two switches that decide
-- whether the event is on sale and whether it is the big one on /tickets.
--
-- Everything is additive and `if not exists`, so running this against a database
-- that already has events is safe and keeps the existing rows.

alter table events
  add column if not exists tagline       text not null default '',
  add column if not exists story         text not null default '',
  add column if not exists rules         jsonb not null default '[]'::jsonb,
  add column if not exists gallery       jsonb not null default '[]'::jsonb,
  add column if not exists links         jsonb not null default '[]'::jsonb,
  add column if not exists hero_image    text not null default '',
  add column if not exists hero_kicker   text not null default '',
  add column if not exists doors_open_at timestamptz,
  add column if not exists ends_at       timestamptz,
  add column if not exists position      integer not null default 0;

-- A spots line ("1,200 seats · 4 ticket types") is derived, not stored.

drop index if exists events_featured_idx;
create index if not exists events_featured_idx on events (featured) where published;
create index if not exists events_position_idx on events (position, starts_at);

-- ---------- one ticket per person admitted ----------------------------------
-- A booking of four seats is four people through the gate, so it is four
-- tickets — each with its own QR, its own admission and its own PDF. Before
-- this, four seats produced one QR, so the second, third and fourth person were
-- turned away on a code that had already been scanned.
--
-- The booking is still the sale: one reference, one payment, one row in the
-- bookings list. The tickets are what the gate touches, so `bookings.admitted_at`
-- stays as the roll-up ("has everybody been in?" — true when every ticket has),
-- and `bookings.ticket_token` is kept for the emails already in customers'
-- inboxes, mapped to ticket #1 when this is first applied.
create table if not exists booking_tickets (
  id          uuid primary key default gen_random_uuid(),
  booking     uuid not null references bookings (id) on delete cascade,
  -- 1-based: "ticket 2 of 4" is what the email and the gate both say.
  seq         integer not null check (seq > 0),
  token       text not null unique,
  tier        text,
  admitted_at timestamptz,
  admitted_by text not null default '',
  created_at  timestamptz not null default now(),
  unique (booking, seq)
);

create index if not exists booking_tickets_booking_idx on booking_tickets (booking);
create index if not exists booking_tickets_open_idx
  on booking_tickets (booking) where admitted_at is null;

-- Bookings that predate this table get their tickets now, so an existing sale is
-- not stuck with a QR the gate cannot find. The count comes from the seats that
-- were actually paid for, and one person is the floor.
insert into booking_tickets (booking, seq, token, tier)
select b.id,
       g.seq,
       -- The old single token belongs to ticket #1: that is the one printed in
       -- every email sent before this change, and it must keep working.
       case when g.seq = 1 then coalesce(b.ticket_token, 'legacy-' || b.id::text || '-1')
            else 'legacy-' || b.id::text || '-' || g.seq::text end,
       (select bi.tier from booking_items bi where bi.booking = b.id order by bi.id limit 1)
  from bookings b
  cross join lateral generate_series(
         1,
         greatest(1, coalesce((select sum(bi.qty) from booking_items bi where bi.booking = b.id), 1))
       ) as g(seq)
 where not exists (select 1 from booking_tickets bt where bt.booking = b.id)
on conflict do nothing;

-- Everybody in? The roll-up the admin list shows.
update bookings b
   set admitted_at = case
         when exists (select 1 from booking_tickets bt
                       where bt.booking = b.id and bt.admitted_at is null) then null
         else coalesce(b.admitted_at, now())
       end
 where exists (select 1 from booking_tickets bt where bt.booking = b.id)
   and (b.admitted_at is null) <> exists (select 1 from booking_tickets bt
                                           where bt.booking = b.id and bt.admitted_at is null);

-- ---------- the school's own settings ---------------------------------------
-- One row. Today this is the logo the admin uploads: the same image is used on
-- the site (in the white circle in the navbar and the footer) and at the top of
-- every ticket email, so there is one place to change it and no risk of the email
-- carrying last year's crest.
create table if not exists site_settings (
  id         integer primary key check (id = 1),
  -- Path under public/, e.g. /uploads/brand/logo.png . Empty = built-in crest.
  logo       text not null default '',
  -- How much of the white circle the mark should fill, 0.3-1. A crest with a lot
  -- of white margin needs to be larger than one that fills its own square, so
  -- this is a setting rather than a constant.
  logo_scale numeric(3,2) not null default 0.86,
  updated_at timestamptz not null default now()
);

alter table site_settings add column if not exists logo_scale numeric(3,2) not null default 0.86;

drop trigger if exists site_settings_touch_updated_at on site_settings;
create trigger site_settings_touch_updated_at
  before update on site_settings
  for each row execute function set_updated_at();

-- ---------- blocking a single ticket -----------------------------------------
-- A ticket is a bearer document: a screenshot of a QR can be forwarded to a
-- stranger, and the booking reference cannot tell you which of the eight
-- tickets was shared — it is one reference for the whole sale. Each ticket
-- already has its own token; these columns give the admin a way to stop *that
-- one* at the gate without touching the rest of the party.
--
-- Blocked is not the same as deleted. A blocked ticket still exists — it shows
-- on the bill, in the bookings list and in the gate's answer ("blocked, do not
-- admit") — which is what a school wants when a code has gone astray: proof of
-- what was sold, and a door that will not open.
alter table booking_tickets
  add column if not exists blocked_at   timestamptz,
  add column if not exists blocked_by   text not null default '',
  add column if not exists blocked_note text not null default '';

create index if not exists booking_tickets_blocked_idx
  on booking_tickets (booking) where blocked_at is not null;

-- ---------- tickets issued by hand -------------------------------------------
-- Not every ticket is sold through the shop: the headmaster wants two seats at
-- the door, a sponsor's name is written down on paper, a parent pays cash to the
-- bursar. Those need a real ticket — same QR, same gate, same PDF — so they are
-- bookings with a reference like any other, entered from the admin.
--
-- `channel` says where a sale came from — 'shop' or 'counter' — so the takings
-- can tell shop revenue from seats given away, and `note` is the one thing
-- paperwork always needs.
alter table bookings
  add column if not exists channel text not null default 'shop',
  add column if not exists note    text not null default '';

-- ---------- a code of its own for every ticket --------------------------------
-- The first attempt at a per-ticket code was the sale's reference with the seat
-- number on the end (`BM-ABC12345-03`). It named the ticket, but it named it in a
-- way anybody could compute: type `-04` and you are somebody else's ticket. A
-- code that is typed at a door has to be both unique and unguessable, so it is
-- random, ten characters from an alphabet with no letters that look like other
-- letters, in two groups of five: `BK7MQ-9WXT3`.
--
-- It is the ticket's own name for people — the QR carries the token, which has
-- always been secret. This is the one the office types, reads over the phone and
-- prints on the bill.
alter table booking_tickets add column if not exists code text not null default '';

-- Existing tickets get a code now.
--
-- A loop rather than one clever `update … select`: inside an aggregate, an
-- expression that does not mention the series' own column is evaluated once, so
-- the first version of this produced ten identical characters and exactly one
-- code for the whole school. Per row and per character, in a loop, the draws are
-- independent.
do $$
declare
  ticket record;
  generated text;
  i integer;
begin
  for ticket in select id from booking_tickets where code = '' loop
    generated := '';
    for i in 1..10 loop
      generated := generated ||
        substr('23456789ABCDEFGHJKMNPQRSTVWXYZ', 1 + floor(random() * 30)::int, 1);
    end loop;
    update booking_tickets
       set code = 'BM-' || substr(generated, 1, 5) || '-' || substr(generated, 6, 5)
     where id = ticket.id;
  end loop;
end $$;

-- One ticket per code, and lookups ignore the dashes and the case so a volunteer
-- can type `bk7mq9wxt3` and still admit the right person.
create unique index if not exists booking_tickets_code_key
  on booking_tickets (upper(replace(code, '-', '')))
  where code <> '';

-- ---------- a pause, as distinct from a block --------------------------------
-- A block is a decision the admin will undo when they decide to. A pause is a
-- door held shut for a while: a ticket under investigation, a refund being
-- argued, somebody who should come back after the interval. Both stop the gate;
-- only the pause lifts itself.
alter table booking_tickets add column if not exists blocked_until timestamptz;
