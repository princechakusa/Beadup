-- Beadup core schema.
-- Security model (rules.md section 7):
--   * RLS is enabled on every table, and the default is deny.
--   * anon (public booking page) has NO table privileges. It reads through
--     public.get_booking_page(), which returns public fields only.
--   * authenticated detailers can reach only rows where detailer_id = auth.uid().
--   * Money, plan, review and audit rows are written only by server code with
--     the service role (webhooks and booking endpoints), never by clients.

-- ---------------------------------------------------------------------------
-- Privileges: start from nothing and grant explicitly.
-- ---------------------------------------------------------------------------
alter default privileges in schema public revoke all on tables from anon, authenticated;
alter default privileges in schema public revoke all on sequences from anon, authenticated;
alter default privileges in schema public revoke execute on functions from public, anon, authenticated;

create type public.vehicle_size as enum ('sedan', 'suv', 'truck');
create type public.booking_status as enum ('pending_payment', 'confirmed', 'completed', 'cancelled', 'no_show');
create type public.plan_tier as enum ('free', 'pro');

create function public.set_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end $$;

-- ---------------------------------------------------------------------------
-- Detailers: one row per detailer, keyed by their auth user.
-- ---------------------------------------------------------------------------
create table public.detailers (
  id            uuid primary key references auth.users (id) on delete cascade,
  handle        text not null unique
                check (handle ~ '^[a-z0-9][a-z0-9-]{1,39}$')
                -- Handles share the URL space with site pages.
                check (handle not in ('api', 'app', 'admin', 'login', 'signup', 'settings', 'pricing',
                                      'privacy', 'terms', 'support', 'help', 'delete-account', 'about',
                                      'blog', 'pro', 'book', 'auth', 'webhooks', 'www', 'beadup')),
  business_name text not null check (char_length(business_name) between 1 and 80),
  tagline       text not null default '' check (char_length(tagline) <= 120),
  service_area  text not null default '' check (char_length(service_area) <= 80),
  timezone      text not null default 'America/Chicago' check (char_length(timezone) <= 64),
  is_published  boolean not null default false,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create trigger detailers_updated_at before update on public.detailers
  for each row execute function public.set_updated_at();

-- Billing and payout identifiers. Private, and written only by webhooks.
create table public.detailer_accounts (
  detailer_id        uuid primary key references public.detailers (id) on delete cascade,
  stripe_account_id  text unique,
  stripe_customer_id text unique,
  plan               public.plan_tier not null default 'free',
  plan_renews_at     timestamptz,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);
create trigger detailer_accounts_updated_at before update on public.detailer_accounts
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Catalog: services, add-ons, weekly availability.
-- ---------------------------------------------------------------------------
create table public.services (
  id                uuid primary key default gen_random_uuid(),
  detailer_id       uuid not null references public.detailers (id) on delete cascade,
  name              text not null check (char_length(name) between 1 and 60),
  description       text not null default '' check (char_length(description) <= 200),
  duration_min      integer not null check (duration_min between 15 and 720),
  price_sedan_cents integer not null check (price_sedan_cents between 0 and 1000000),
  price_suv_cents   integer not null check (price_suv_cents between 0 and 1000000),
  price_truck_cents integer not null check (price_truck_cents between 0 and 1000000),
  active            boolean not null default true,
  sort_order        integer not null default 0,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (id, detailer_id)
);
create index services_detailer_idx on public.services (detailer_id, sort_order);
create trigger services_updated_at before update on public.services
  for each row execute function public.set_updated_at();

create table public.add_ons (
  id          uuid primary key default gen_random_uuid(),
  detailer_id uuid not null references public.detailers (id) on delete cascade,
  name        text not null check (char_length(name) between 1 and 60),
  price_cents integer not null check (price_cents between 0 and 1000000),
  active      boolean not null default true,
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index add_ons_detailer_idx on public.add_ons (detailer_id, sort_order);
create trigger add_ons_updated_at before update on public.add_ons
  for each row execute function public.set_updated_at();

-- Weekly start times, in the detailer's own timezone. weekday: 0 = Sunday.
create table public.availability_slots (
  id          uuid primary key default gen_random_uuid(),
  detailer_id uuid not null references public.detailers (id) on delete cascade,
  weekday     smallint not null check (weekday between 0 and 6),
  start_time  time not null,
  unique (detailer_id, weekday, start_time)
);

-- ---------------------------------------------------------------------------
-- Clients and bookings: private to the detailer.
-- ---------------------------------------------------------------------------
create table public.clients (
  id              uuid primary key default gen_random_uuid(),
  detailer_id     uuid not null references public.detailers (id) on delete cascade,
  name            text not null check (char_length(name) between 1 and 80),
  phone           text not null check (phone ~ '^\+[1-9][0-9]{7,14}$'), -- E.164
  email           text check (email is null or (char_length(email) <= 254 and email ~ '^[^@\s]+@[^@\s]+$')),
  -- TCPA record: what the client agreed to and when (rules.md section 4).
  sms_consent      boolean not null default false,
  sms_consent_at   timestamptz,
  sms_consent_text text check (char_length(sms_consent_text) <= 500),
  sms_opted_out_at timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (detailer_id, phone),
  unique (id, detailer_id),
  check (not sms_consent or (sms_consent_at is not null and sms_consent_text is not null))
);
create trigger clients_updated_at before update on public.clients
  for each row execute function public.set_updated_at();

create table public.bookings (
  id                uuid primary key default gen_random_uuid(),
  detailer_id       uuid not null references public.detailers (id) on delete cascade,
  client_id         uuid not null,
  service_id        uuid,
  -- Snapshots, so receipts stay correct if the catalog changes later.
  service_name      text not null check (char_length(service_name) between 1 and 60),
  vehicle_size      public.vehicle_size not null,
  add_ons           jsonb not null default '[]'::jsonb check (jsonb_typeof(add_ons) = 'array'),
  starts_at         timestamptz not null,
  duration_min      integer not null check (duration_min between 15 and 720),
  address           text not null check (char_length(address) between 1 and 200),
  notes             text not null default '' check (char_length(notes) <= 1000),
  subtotal_cents    integer not null check (subtotal_cents >= 0),
  deposit_cents     integer not null check (deposit_cents between 0 and subtotal_cents),
  booking_fee_cents integer not null default 0 check (booking_fee_cents >= 0),
  status            public.booking_status not null default 'pending_payment',
  payment_intent_id text unique,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  -- Composite keys stop a booking from pointing at another detailer's client or service.
  foreign key (client_id, detailer_id) references public.clients (id, detailer_id) on delete restrict,
  foreign key (service_id, detailer_id) references public.services (id, detailer_id) on delete set null (service_id)
);
create index bookings_detailer_time_idx on public.bookings (detailer_id, starts_at);
create index bookings_client_idx on public.bookings (client_id);
-- One live booking per slot.
create unique index bookings_no_double_book on public.bookings (detailer_id, starts_at)
  where status in ('pending_payment', 'confirmed');
create trigger bookings_updated_at before update on public.bookings
  for each row execute function public.set_updated_at();

-- Reviews come only from completed bookings, one per booking, and are written
-- by server code. Detailers can read but never edit or hide them (Apple 1.2:
-- never manipulate ratings). `hidden` is for Beadup moderation of reports.
create table public.reviews (
  id          uuid primary key default gen_random_uuid(),
  detailer_id uuid not null references public.detailers (id) on delete cascade,
  booking_id  uuid not null unique references public.bookings (id) on delete cascade,
  rating      smallint not null check (rating between 1 and 5),
  body        text not null default '' check (char_length(body) <= 1000),
  hidden      boolean not null default false,
  created_at  timestamptz not null default now()
);
create index reviews_detailer_idx on public.reviews (detailer_id) where not hidden;

-- Append-only log of money and account events (rules.md section 7).
create table public.audit_log (
  id          bigint generated always as identity primary key,
  detailer_id uuid references public.detailers (id) on delete set null,
  actor       text not null check (char_length(actor) <= 80), -- 'system', 'stripe', or a user id
  event       text not null check (char_length(event) <= 80),
  data        jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);
create index audit_log_detailer_idx on public.audit_log (detailer_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Row Level Security: on for every table. No policy means no access.
-- ---------------------------------------------------------------------------
alter table public.detailers          enable row level security;
alter table public.detailer_accounts  enable row level security;
alter table public.services           enable row level security;
alter table public.add_ons            enable row level security;
alter table public.availability_slots enable row level security;
alter table public.clients            enable row level security;
alter table public.bookings           enable row level security;
alter table public.reviews            enable row level security;
alter table public.audit_log          enable row level security;

-- anon gets nothing on any table.
revoke all on all tables in schema public from anon;
revoke all on all tables in schema public from authenticated;
revoke all on all sequences in schema public from anon, authenticated;

-- detailers: a signed-in user creates and edits only their own profile.
grant select, insert on public.detailers to authenticated;
grant update (handle, business_name, tagline, service_area, timezone, is_published) on public.detailers to authenticated;
create policy detailers_owner_select on public.detailers for select to authenticated
  using (id = (select auth.uid()));
create policy detailers_owner_insert on public.detailers for insert to authenticated
  with check (id = (select auth.uid()));
create policy detailers_owner_update on public.detailers for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

-- detailer_accounts: read own; writes only from webhooks (service role).
grant select on public.detailer_accounts to authenticated;
create policy detailer_accounts_owner_select on public.detailer_accounts for select to authenticated
  using (detailer_id = (select auth.uid()));

-- Catalog tables: full control of own rows.
grant select, insert, delete on public.services to authenticated;
grant update (name, description, duration_min, price_sedan_cents, price_suv_cents, price_truck_cents, active, sort_order)
  on public.services to authenticated;
grant select, insert, delete on public.add_ons to authenticated;
grant update (name, price_cents, active, sort_order) on public.add_ons to authenticated;
grant select, insert, delete on public.availability_slots to authenticated;
grant update (weekday, start_time) on public.availability_slots to authenticated;

create policy services_owner on public.services for all to authenticated
  using (detailer_id = (select auth.uid())) with check (detailer_id = (select auth.uid()));
create policy add_ons_owner on public.add_ons for all to authenticated
  using (detailer_id = (select auth.uid())) with check (detailer_id = (select auth.uid()));
create policy availability_owner on public.availability_slots for all to authenticated
  using (detailer_id = (select auth.uid())) with check (detailer_id = (select auth.uid()));

-- clients: detailer manages own clients. Consent fields are recorded by the
-- booking endpoint and STOP handler only, so they are not client-updatable.
grant select, insert, delete on public.clients to authenticated;
grant update (name, phone, email) on public.clients to authenticated;
create policy clients_owner on public.clients for all to authenticated
  using (detailer_id = (select auth.uid())) with check (detailer_id = (select auth.uid()));

-- bookings: detailer reads own and changes schedule or status. Money columns
-- and payment ids are set only by server code.
grant select on public.bookings to authenticated;
grant update (starts_at, duration_min, address, notes, status) on public.bookings to authenticated;
create policy bookings_owner_select on public.bookings for select to authenticated
  using (detailer_id = (select auth.uid()));
create policy bookings_owner_update on public.bookings for update to authenticated
  using (detailer_id = (select auth.uid())) with check (detailer_id = (select auth.uid()));

-- reviews and audit_log: read own, never write.
grant select on public.reviews to authenticated;
create policy reviews_owner_select on public.reviews for select to authenticated
  using (detailer_id = (select auth.uid()));
grant select on public.audit_log to authenticated;
create policy audit_log_owner_select on public.audit_log for select to authenticated
  using (detailer_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- Public booking page data. The only entry point for anon.
-- Returns null for unknown or unpublished handles.
-- ---------------------------------------------------------------------------
create function public.get_booking_page(p_handle text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'handle',       d.handle,
    'businessName', d.business_name,
    'tagline',      d.tagline,
    'serviceArea',  d.service_area,
    'timezone',     d.timezone,
    'rating',       r.rating,
    'reviewCount',  coalesce(r.review_count, 0),
    'services', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', s.id,
               'name', s.name,
               'description', s.description,
               'durationMin', s.duration_min,
               'priceCents', jsonb_build_object(
                 'sedan', s.price_sedan_cents,
                 'suv',   s.price_suv_cents,
                 'truck', s.price_truck_cents))
             order by s.sort_order, s.name)
      from public.services s
      where s.detailer_id = d.id and s.active), '[]'::jsonb),
    'addOns', coalesce((
      select jsonb_agg(jsonb_build_object('id', a.id, 'name', a.name, 'priceCents', a.price_cents)
             order by a.sort_order, a.name)
      from public.add_ons a
      where a.detailer_id = d.id and a.active), '[]'::jsonb),
    'weeklySlots', coalesce((
      select jsonb_object_agg(w.weekday::text, w.times)
      from (
        select v.weekday, jsonb_agg(to_char(v.start_time, 'HH24:MI') order by v.start_time) as times
        from public.availability_slots v
        where v.detailer_id = d.id
        group by v.weekday
      ) w), '{}'::jsonb)
  )
  from public.detailers d
  left join lateral (
    select round(avg(rv.rating)::numeric, 1)::float8 as rating, count(*)::int as review_count
    from public.reviews rv
    where rv.detailer_id = d.id and not rv.hidden
  ) r on true
  where d.handle = lower(p_handle) and d.is_published;
$$;

revoke execute on function public.get_booking_page(text) from public;
grant execute on function public.get_booking_page(text) to anon, authenticated;
