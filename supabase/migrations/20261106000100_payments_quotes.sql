-- Payments, quotes and webhook idempotency. Same model as the core schema:
-- RLS on, anon gets nothing, detailers reach only their own rows.

create type public.payment_kind as enum ('deposit', 'balance', 'refund');
create type public.payment_status as enum ('pending', 'succeeded', 'failed', 'refunded');
create type public.quote_status as enum ('draft', 'sent', 'accepted', 'declined', 'expired');

alter table public.bookings add constraint bookings_id_detailer_key unique (id, detailer_id);

-- Written only by the Stripe webhook handler (service role).
create table public.payments (
  id                       uuid primary key default gen_random_uuid(),
  detailer_id              uuid not null references public.detailers (id) on delete cascade,
  booking_id               uuid not null,
  kind                     public.payment_kind not null,
  status                   public.payment_status not null default 'pending',
  amount_cents             integer not null check (amount_cents >= 0),
  booking_fee_cents        integer not null default 0 check (booking_fee_cents >= 0),
  currency                 text not null default 'usd' check (currency ~ '^[a-z]{3}$'),
  stripe_payment_intent_id text unique,
  stripe_refund_id         text unique,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now(),
  foreign key (booking_id, detailer_id) references public.bookings (id, detailer_id) on delete cascade
);
create index payments_detailer_idx on public.payments (detailer_id, created_at desc);
create index payments_booking_idx on public.payments (booking_id);
create trigger payments_updated_at before update on public.payments
  for each row execute function public.set_updated_at();

-- Quotes. `ai_suggestion` is written by the AI endpoint and is never editable
-- by the client app; the detailer's approved numbers live in items/total.
create table public.quotes (
  id              uuid primary key default gen_random_uuid(),
  detailer_id     uuid not null references public.detailers (id) on delete cascade,
  client_id       uuid,
  vehicle_size    public.vehicle_size,
  vehicle_desc    text not null default '' check (char_length(vehicle_desc) <= 120),
  items           jsonb not null default '[]'::jsonb check (jsonb_typeof(items) = 'array'),
  total_cents     integer not null default 0 check (total_cents between 0 and 10000000),
  notes           text not null default '' check (char_length(notes) <= 1000),
  status          public.quote_status not null default 'draft',
  ai_suggestion   jsonb,
  photo_paths     text[] not null default '{}' check (cardinality(photo_paths) <= 10),
  sent_at         timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  foreign key (client_id, detailer_id) references public.clients (id, detailer_id) on delete set null (client_id)
);
create index quotes_detailer_idx on public.quotes (detailer_id, created_at desc);
create trigger quotes_updated_at before update on public.quotes
  for each row execute function public.set_updated_at();

-- Stripe (and later Twilio) event ids already handled. Server only.
create table public.processed_events (
  id           text primary key check (char_length(id) <= 255),
  source       text not null check (source in ('stripe', 'twilio')),
  processed_at timestamptz not null default now()
);

alter table public.payments         enable row level security;
alter table public.quotes           enable row level security;
alter table public.processed_events enable row level security;

revoke all on public.payments, public.quotes, public.processed_events from anon, authenticated;

grant select on public.payments to authenticated;
create policy payments_owner_select on public.payments for select to authenticated
  using (detailer_id = (select auth.uid()));

grant select, delete on public.quotes to authenticated;
grant insert (detailer_id, client_id, vehicle_size, vehicle_desc, items, total_cents, notes, status) on public.quotes to authenticated;
grant update (client_id, vehicle_size, vehicle_desc, items, total_cents, notes, status) on public.quotes to authenticated;
create policy quotes_owner on public.quotes for all to authenticated
  using (detailer_id = (select auth.uid())) with check (detailer_id = (select auth.uid()));
