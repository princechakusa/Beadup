-- A business can have at most 25 people on its team (stops a runaway or abusive
-- account filling the booking page and the table).
create function public.staff_members_cap() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if (select count(*) from public.staff_members where detailer_id = new.detailer_id) >= 25 then
    raise exception 'team is limited to 25 people' using errcode = '23514';
  end if;
  return new;
end $$;
revoke all on function public.staff_members_cap() from public, anon, authenticated;

create trigger staff_members_cap_check before insert on public.staff_members
  for each row execute function public.staff_members_cap();
