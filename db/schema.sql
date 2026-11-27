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

-- The colours a product is sold in. Added with the custom-colour work; the
-- `create table` above only helps a database that does not exist yet.
alter table products add column if not exists colours jsonb not null default '[]'::jsonb;

create index if not exists products_category_idx on products (category) where active;
create index if not exists products_featured_idx on products (is_featured) where active;

-- ---------- stock, per colour and per size -----------------------------------
-- A product with *no* rows here is not stock-counted at all: it sells until the
-- office decides otherwise. That is deliberate, because the catalogue predates
-- this table and a new column defaulting to 0 would have emptied the whole shop
-- on the morning of the migration. The moment one row exists, every combination
-- of that product is counted, and a combination with no row is sold out.
--
-- '' is a real key part: a product with no colours or no sizes still has to be
-- countable, so the empty string stands for "the only one".
create table if not exists product_stock (
  slug       text not null references products (slug) on delete cascade,
  colour     text not null default '',
  size       text not null default '',
  qty        integer not null default 0 check (qty >= 0),
  updated_at timestamptz not null default now(),
  primary key (slug, colour, size)
);

create index if not exists product_stock_low_idx on product_stock (qty) where qty <= 5;

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

-- Seat caps. A project created before this round has the table but not these
-- columns, and `create table if not exists` above will never add them — so the
-- ticket screen would quietly lose its caps on a database that is otherwise
-- healthy. Same reason as every other `alter` further down.
alter table ticket_tiers add column if not exists capacity integer;
alter table ticket_tiers add column if not exists sold integer not null default 0;

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
  variant     text not null default '',
  -- The chosen colour and size, kept apart from the display label above so the
  -- stock table can be asked the same question the shop asked the customer.
  colour      text not null default '',
  size        text not null default ''
);

create index if not exists order_items_order_idx on order_items (order_id);

alter table order_items add column if not exists colour text not null default '';
alter table order_items add column if not exists size text not null default '';

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

-- The tab icon ("favicon"). Same deal as the logo: a path under public/, and
-- empty means the built-in crest mark in public/favicon.svg.
alter table site_settings add column if not exists favicon text not null default '';

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

-- ---------- what happened to each email ---------------------------------------
-- A ticket email that did not arrive leaves no trace: the sale is in the
-- bookings list, the money is in the till, and the parent is standing at the
-- counter saying nothing came. The dashboard cannot tell a morning with no sales
-- from a morning where every message bounced.
--
-- So every attempt is written down here — sent, refused, or skipped because no
-- transport is configured — with the address it went to, the codes it carried and
-- the mail server's own words when it refused. It is a log, not a queue: nothing
-- re-sends itself. The admin reads it, sees what failed, and sends that one
-- ticket again to whichever address the parent gives.
create table if not exists email_log (
  id                uuid primary key default gen_random_uuid(),
  created_at        timestamptz not null default now(),
  -- The sale, so a row can be found by the reference on the phone.
  booking_reference text not null default '',
  -- The ticket codes in the message, comma separated: `BM-BK7MQ-9WXT3`.
  ticket_codes      text not null default '',
  to_email          text not null default '',
  subject           text not null default '',
  -- 'booking' (the sale), 'resend' (sent again by hand), 'test' (the admin's own
  -- inbox from the ticket email page).
  kind              text not null default 'booking',
  -- 'sent' — the mail server accepted it; 'failed' — it refused, and `error`
  -- says why; 'skipped' — there is no transport configured, nothing left.
  status            text not null,
  provider          text not null default '',
  message_id        text not null default '',
  error             text not null default ''
);

create index if not exists email_log_created_idx on email_log (created_at desc);

-- A parent rings with a reference and asks whether the mail went. One index for
-- the sale, one for the address, both case-insensitive, because neither is ever
-- typed the same way twice.
create index if not exists email_log_reference_idx on email_log (upper(booking_reference));
create index if not exists email_log_to_idx on email_log (lower(to_email));

-- ---------- filters the shop offers -----------------------------------------
-- The shop could filter by collection and nothing else, and the vocabulary a
-- product is described with — "Navy", "XL" — was whatever happened to be in the
-- JSON. That left two problems the office kept meeting: a colour that only one
-- product ever used still offered itself as a filter, and a genuine option could
-- not be renamed or hidden without editing the database by hand.
--
-- These rows are the vocabulary. `kind` says which part of a product it filters
-- (`colours`, or the values of `options`), `label` is the word the shop prints,
-- `swatch` is the chip colour for a colour, and the position is the order the
-- chips appear in. Only labels with at least one product are ever drawn, so this
-- table cannot produce a filter that finds nothing.
create table if not exists shop_filters (
  id         uuid primary key default gen_random_uuid(),
  kind       text not null check (kind in ('colour', 'size')),
  label      text not null,
  -- '#1b2b55' for a colour; empty for a size.
  swatch     text not null default '',
  position   integer not null default 0,
  is_active  boolean not null default true,
  created_at timestamptz not null default now(),
  unique (kind, label)
);

insert into shop_filters (kind, label, swatch, position)
values
  ('colour', 'Navy',  '#1b2b55', 0),
  ('colour', 'Black', '#15171a', 1),
  ('colour', 'White', '#f4f2ec', 2),
  ('colour', 'Grey',  '#8b9099', 3),
  ('colour', 'Maroon','#6d1f2e', 4),
  ('colour', 'Sky',   '#a9c6e8', 5),
  ('size',   'S',     '',        0),
  ('size',   'M',     '',        1),
  ('size',   'L',     '',        2),
  ('size',   'XL',    '',        3),
  ('size',   'XXL',   '',        4),
  ('size',   '32',    '',        5),
  ('size',   '34',    '',        6),
  ('size',   '36',    '',        7),
  ('size',   '38',    '',        8),
  ('size',   '40',    '',        9),
  ('size',   '42',    '',       10),
  ('size',   '44',    '',       11),
  ('size',   '46',    '',       12)
on conflict (kind, label) do nothing;

-- ---------- the catalogue's own corrections -----------------------------------
-- The shop was built before the catalogue was read properly. Three mistakes, all
-- visible on the storefront:
--
--   · every badge offered a colour. A badge is one piece of cast metal with one
--     finish — the name says which — and a "Gold / Silver" chip on it is a choice
--     the school cannot fulfil.
--   · a mug lived in "Event Clothings", because at the time there was nowhere
--     else to put it. That turned the collection into "everything that is not a
--     badge", and it is why a souvenir read as clothing.
--   · paper products had a colour, and a geometry set was "Navy". A pad is white
--     because paper is white; the pen pack's blue-or-black is *ink*, not the
--     colour of the thing, so it is an option called "Ink".
--
-- One shot, recorded in `applied_migrations`, because these are corrections and
-- not rules: an admin who decides the prefect badge comes in silver too must not
-- have it taken away by the next deploy. Everything else in this file is
-- idempotent DDL and can run as often as it likes.
create table if not exists applied_migrations (
  name       text primary key,
  applied_at timestamptz not null default now()
);

insert into categories (slug, title, description, image, blurb, position)
values (
  'souvenirs',
  'Gifts & Souvenirs',
  'Crested keepsakes for the desk, the shelf and the visitor''s handshake.',
  '/images/product-mug.jpg',
  'The crest, kept',
  3
)
on conflict (slug) do nothing;

do $$
begin
  if exists (select 1 from applied_migrations where name = 'catalogue-fix-2026-11') then
    return;
  end if;

  update products set colours = '[]'::jsonb where category = 'badges';
  update products set name = 'Prefect Badge' where slug = 'prefect-badge';
  update products set name = 'College Blazer' where slug = 'navy-blazer';
  update products set name = 'Crest Hoodie' where slug = 'crest-hoodie';
  update products
     set colours = '["White", "Sky"]'::jsonb
   where slug = 'regulation-white-shirt';
  update products set colours = '[]'::jsonb where slug = 'animo-et-fide-scarf';
  update products set category = 'souvenirs' where slug = 'heritage-crest-mug';
  update products
     set colours = '[]'::jsonb
   where slug in ('exam-answer-booklet', 'ruled-writing-pad', 'geometry-set');
  update products
     set colours = '[]'::jsonb,
         options = '{"label": "Ink", "values": ["Blue", "Black"]}'::jsonb
   where slug = 'exam-pen-pack';
  update products
     set image = 'https://images.pexels.com/photos/8146450/pexels-photo-8146450.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940'
   where slug = 'batch-classroom-shirt'
     and image like '%cat-tickets%';

  -- The category blurbs were counts ("16 badges") that were never true. They are
  -- a line of copy now; the shop prints the real number of items itself.
  update categories set blurb = 'Worn with honour'       where slug = 'badges';
  update categories set blurb = 'The college standard'   where slug = 'uniforms';
  update categories set blurb = 'For the big occasions'  where slug = 'event-clothings';
  update categories
     set image = '/images/product-hoodie.jpg'
   where slug = 'event-clothings'
     and image like '%cat-tickets%';
  update categories set blurb = 'Exam-ready, every time' where slug = 'exam-writing-papers';

  -- The last two categories were the only pictures on somebody else's server.
  -- They are photographs in /public now, so the shop comes up whole offline.
  update categories
     set image = '/images/cat-papers.jpg'
   where slug = 'exam-writing-papers'
     and image like '%pexels%';
  update categories
     set image = '/images/cat-shirts.jpg'
   where slug = 'batch-shirts'
     and image like '%pexels%';
  update products set image = '/images/cat-papers.jpg' where image like '%20140155%';
  update products set image = '/images/cat-shirts.jpg' where image like '%8146450%';
  update products
     set image = '/images/product-lapel-badge.jpg'
   where slug = 'crest-lapel-badge'
     and image like '%11659349%';
  update products set image = '/images/product-house-badges.jpg' where image like '%11659349%';
  update categories set blurb = 'Your year, printed'     where slug = 'batch-shirts';

  -- Souvenirs belongs between the event wear and the exam papers, which is where
  -- a parent walking the shop would find it.
  update categories
     set position = case slug
                      when 'badges' then 0
                      when 'uniforms' then 1
                      when 'event-clothings' then 2
                      when 'souvenirs' then 3
                      when 'exam-writing-papers' then 4
                      when 'batch-shirts' then 5
                      else position
                    end
   where slug in ('badges', 'uniforms', 'event-clothings', 'souvenirs',
                  'exam-writing-papers', 'batch-shirts');

  insert into applied_migrations (name) values ('catalogue-fix-2026-11');
end $$;
