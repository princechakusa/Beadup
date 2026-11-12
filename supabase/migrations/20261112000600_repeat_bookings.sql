-- Repeat clients (owner request 2026-11-12): the business books a client in
-- from the app, once or on a repeat (every 1, 2 or 4 weeks, up to 12 times).
-- Each visit goes through the same overlap rules as online bookings; visits
-- that clash are skipped and reported, never forced in.

create function public.detailer_book(
  p_client_id    uuid,
  p_service_id   uuid,
  p_vehicle_size public.vehicle_size,
  p_starts_at    timestamptz,
  p_address      text,
  p_every_weeks  integer default 0,
  p_count        integer default 1
) returns jsonb language plpgsql volatile security definer set search_path = '' as $$
declare
  d        public.detailers%rowtype;
  s        public.services%rowtype;
  v_price  integer;
  v_at     timestamptz;
  v_id     uuid;
  v_made   jsonb := '[]'::jsonb;
  v_skip   jsonb := '[]'::jsonb;
  i        integer;
begin
  select * into d from public.detailers where id = auth.uid();
  if not found then return jsonb_build_object('ok', false, 'error', 'not_found'); end if;
  if not exists (select 1 from public.clients where id = p_client_id and detailer_id = d.id) then
    return jsonb_build_object('ok', false, 'error', 'client');
  end if;
  select * into s from public.services where id = p_service_id and detailer_id = d.id;
  if not found then return jsonb_build_object('ok', false, 'error', 'service'); end if;
  if p_every_weeks not in (0, 1, 2, 4) or p_count not between 1 and 12 or (p_every_weeks = 0 and p_count <> 1) then
    return jsonb_build_object('ok', false, 'error', 'repeat');
  end if;
  if p_starts_at < now() or p_starts_at > now() + interval '366 days' then
    return jsonb_build_object('ok', false, 'error', 'time');
  end if;
  p_address := coalesce(nullif(trim(p_address), ''), left('At ' || d.business_name, 200));

  v_price := case p_vehicle_size when 'sedan' then s.price_sedan_cents when 'suv' then s.price_suv_cents else s.price_truck_cents end;
  for i in 0 .. p_count - 1 loop
    v_at := p_starts_at + make_interval(weeks => i * p_every_weeks);
    begin
      insert into public.bookings (detailer_id, client_id, service_id, service_name, vehicle_size, starts_at, duration_min,
                                   address, subtotal_cents, deposit_cents, booking_fee_cents, status)
      values (d.id, p_client_id, s.id, s.name, p_vehicle_size, v_at, s.duration_min, left(p_address, 200),
              v_price, public.deposit_cents(v_price), 0, 'confirmed')
      returning id into v_id;
      v_made := v_made || jsonb_build_array(jsonb_build_object('id', v_id, 'startsAt', v_at));
    exception when exclusion_violation or unique_violation then
      v_skip := v_skip || jsonb_build_array(v_at);
    end;
  end loop;

  insert into public.audit_log (detailer_id, actor, event, data)
  values (d.id, 'detailer', 'booking.created_by_detailer',
          jsonb_build_object('client_id', p_client_id, 'made', jsonb_array_length(v_made), 'skipped', jsonb_array_length(v_skip),
                             'every_weeks', p_every_weeks));
  return jsonb_build_object('ok', true, 'made', v_made, 'skipped', v_skip);
end $$;

revoke all on function public.detailer_book(uuid, uuid, public.vehicle_size, timestamptz, text, integer, integer) from public, anon;
grant execute on function public.detailer_book(uuid, uuid, public.vehicle_size, timestamptz, text, integer, integer) to authenticated;
