-- Archive finished jobs: they leave the job lists (Money, Calendar) but stay in earnings,
-- client history and the audit trail. Nothing with money on it is ever deleted here.
alter table public.bookings add column archived_at timestamptz;

-- The detailer app may read and set it (column-level grants, like staff_id).
grant select (archived_at) on public.bookings to authenticated;
grant update (archived_at) on public.bookings to authenticated;

-- Only finished jobs can be archived (not upcoming, not unpaid holds).
create or replace function public.bookings_guard_detailer_update() returns trigger
language plpgsql set search_path = '' as $$
begin
  if current_user <> 'authenticated' then return new; end if;
  if new.status is distinct from old.status and not (
       (old.status = 'confirmed' and new.status in ('completed', 'no_show'))
    or (old.status in ('completed', 'no_show') and new.status = 'confirmed')
  ) then
    raise exception 'status change % -> % not allowed', old.status, new.status using errcode = '42501';
  end if;
  if new.archived_at is not null and new.archived_at is distinct from old.archived_at
     and new.status not in ('completed', 'no_show', 'cancelled') then
    raise exception 'only finished jobs can be archived' using errcode = '42501';
  end if;
  return new;
end $$;
revoke all on function public.bookings_guard_detailer_update() from public, anon, authenticated;
