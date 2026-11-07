-- External payments (owner decision 2026-11-07): the client pays the deposit to
-- the detailer directly, so Beadup can't see it. The detailer marks it received
-- in the app; this is the record. Only through mark_deposit_received(), which
-- checks ownership, stamps the time on the server and writes the audit log.

alter table public.bookings add column deposit_received_at timestamptz;

create function public.mark_deposit_received(p_booking_id uuid, p_received boolean)
returns jsonb
language plpgsql volatile security definer set search_path = ''
as $$
declare
  b public.bookings%rowtype;
begin
  select * into b from public.bookings where id = p_booking_id and detailer_id = auth.uid() for update;
  if not found then return jsonb_build_object('ok', false, 'error', 'not_found'); end if;
  if b.status not in ('confirmed', 'completed', 'no_show') then
    return jsonb_build_object('ok', false, 'error', 'status');
  end if;

  update public.bookings
     set deposit_received_at = case when p_received then coalesce(b.deposit_received_at, now()) end
   where id = b.id;

  insert into public.audit_log (detailer_id, actor, event, data)
  values (b.detailer_id, 'detailer', case when p_received then 'deposit.received' else 'deposit.unmarked' end,
          jsonb_build_object('booking_id', b.id, 'deposit_cents', b.deposit_cents));

  return jsonb_build_object('ok', true);
end $$;

revoke all on function public.mark_deposit_received(uuid, boolean) from public, anon;
grant execute on function public.mark_deposit_received(uuid, boolean) to authenticated;
