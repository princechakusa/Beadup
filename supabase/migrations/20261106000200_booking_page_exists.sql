-- Cheap check used by the web proxy to return a real HTTP 404 for unknown
-- handles before the page starts streaming. Reveals only what the booking
-- page itself reveals: whether a bookable page exists.
create function public.booking_page_exists(p_handle text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.detailers d
    where d.handle = lower(p_handle)
      and d.is_published
      and exists (select 1 from public.services s where s.detailer_id = d.id and s.active)
  );
$$;

revoke execute on function public.booking_page_exists(text) from public;
grant execute on function public.booking_page_exists(text) to anon, authenticated;
