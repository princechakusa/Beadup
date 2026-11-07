-- Plan config read by the website and the app (never hardcode prices or
-- limits: the owner changes them here; store prices live in App Store
-- Connect / Play Console and the app shows the store's own price string).
-- Also: account deletion requests from the public web page.

create table public.plan_config (
  key        text primary key check (key ~ '^[a-z_]{1,60}$'),
  value      jsonb not null,
  updated_at timestamptz not null default now()
);
alter table public.plan_config enable row level security;
revoke all on public.plan_config from anon, authenticated;

insert into public.plan_config (key, value) values
  ('free_bookings_per_month', '5'),
  -- Marketing display only (US). Edit here when the store price changes.
  ('pro_price_display', '"$19"'),
  ('pro_price_period', '"month"');

create function public.get_public_config()
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_object_agg(key, value) from public.plan_config;
$$;
revoke execute on function public.get_public_config() from public;
grant execute on function public.get_public_config() to anon, authenticated;

-- Deletion requests from beadup.app/delete-account (Google Play requires a
-- web path). Processed by support; the in-app path deletes immediately.
create table public.deletion_requests (
  id           bigint generated always as identity primary key,
  email        text not null check (char_length(email) <= 254 and email ~ '^[^@\s]+@[^@\s]+$'),
  note         text not null default '' check (char_length(note) <= 500),
  status       text not null default 'open' check (status in ('open', 'done', 'no_account')),
  created_at   timestamptz not null default now(),
  processed_at timestamptz
);
alter table public.deletion_requests enable row level security;
revoke all on public.deletion_requests from anon, authenticated;
