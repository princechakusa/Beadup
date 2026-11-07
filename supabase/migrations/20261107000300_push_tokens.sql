-- Expo push tokens for detailers who turned on booking alerts. Optional:
-- the app works fully without them (Apple 4.5.4).

create table public.push_tokens (
  token       text primary key check (token ~ '^(Exponent|Expo)PushToken\[[A-Za-z0-9_-]{10,200}\]$'),
  detailer_id uuid not null references public.detailers (id) on delete cascade,
  platform    text not null check (platform in ('ios', 'android')),
  created_at  timestamptz not null default now()
);
create index push_tokens_detailer_idx on public.push_tokens (detailer_id);

alter table public.push_tokens enable row level security;
revoke all on public.push_tokens from anon, authenticated;
grant select, insert, delete on public.push_tokens to authenticated;

-- A detailer manages only their own device tokens. Because the token is the
-- primary key, a token already registered to someone else cannot be taken
-- over: the insert fails instead of reassigning it.
create policy push_tokens_owner on public.push_tokens for all to authenticated
  using (detailer_id = (select auth.uid())) with check (detailer_id = (select auth.uid()));
