-- Error monitoring without a third party: crashes from the website and the
-- app land here (via /api/log, rate limited), and /admin shows the latest.
-- No personal data: message, where it happened, and a short stack only.
create table public.error_log (
  id         bigint generated always as identity primary key,
  source     text not null check (source in ('web', 'app', 'server')),
  message    text not null check (char_length(message) <= 500),
  where_at   text not null default '' check (char_length(where_at) <= 300),
  stack      text not null default '' check (char_length(stack) <= 2000),
  release    text not null default '' check (char_length(release) <= 60),
  created_at timestamptz not null default now()
);
alter table public.error_log enable row level security;
revoke all on public.error_log from anon, authenticated;
grant select, insert, delete on public.error_log to service_role;
create index error_log_created_idx on public.error_log (created_at desc);

-- Keep 30 days.
create or replace function public.prune_error_log()
returns void language sql security definer set search_path = '' as $$
  delete from public.error_log where created_at < now() - interval '30 days';
$$;
revoke all on function public.prune_error_log() from public, anon, authenticated;
grant execute on function public.prune_error_log() to service_role;
