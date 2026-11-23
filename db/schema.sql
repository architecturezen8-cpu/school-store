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
