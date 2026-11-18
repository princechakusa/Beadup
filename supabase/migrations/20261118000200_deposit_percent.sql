-- 2026-11-18: each business sets its own deposit percentage.
-- Allowed 10 to 50 in steps of 5 (default 30). 0% leaves no no-show protection
-- and 100% turns the booking into a full prepayment to a link Beadup does not
-- hold, which is the pattern scammers use, so neither is offered.

alter table public.detailers
  add column deposit_percent integer not null default 30
  check (deposit_percent between 10 and 50 and deposit_percent % 5 = 0);
grant update (deposit_percent) on public.detailers to authenticated;

-- Same integer math as apps/web/src/lib/pricing.ts: round half up.
create function public.deposit_cents(p_total integer, p_percent integer) returns integer
language sql immutable set search_path = '' as $$
  select ((p_total * p_percent + 50) / 100)::integer;
$$;
revoke execute on function public.deposit_cents(integer, integer) from public, anon, authenticated;

create or replace function public.create_booking(
  p_handle       text,
  p_service_id   uuid,
  p_vehicle_size public.vehicle_size,
  p_add_on_ids   uuid[],
  p_date         date,
  p_time         time,
  p_name         text,
  p_phone        text,
  p_address      text,
  p_sms_consent  boolean,
  p_consent_text text,
  p_staff_id     uuid default null
) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare
  d          public.detailers%rowtype;
  s          public.services%rowtype;
  v_add_ons  jsonb;
  v_extras   integer;
  v_count    integer;
  v_starts   timestamptz;
  v_today    date;
  v_subtotal integer;
  v_deposit  integer;
  v_fee      integer;
  v_client   uuid;
  v_booking  uuid;
  v_token    text;
  v_external boolean;
  v_address  text;
  v_has_team boolean;
  v_staff    uuid;
  v_chosen   uuid;
begin
  select * into d from public.detailers where handle = lower(p_handle) and is_published;
  if not found then return jsonb_build_object('ok', false, 'error', 'not_found'); end if;
  -- The client comes to the business: their address isn't needed.
  v_address := case when d.visit_mode = 'studio' and coalesce(trim(p_address), '') = ''
                    then left('At ' || d.business_name, 200) else p_address end;

  select * into s from public.services where id = p_service_id and detailer_id = d.id and active;
  if not found then return jsonb_build_object('ok', false, 'error', 'service'); end if;

  p_add_on_ids := coalesce((select array_agg(distinct x) from unnest(p_add_on_ids) x), '{}');
  select coalesce(jsonb_agg(jsonb_build_object('id', a.id, 'name', a.name, 'priceCents', a.price_cents) order by a.sort_order), '[]'),
         coalesce(sum(a.price_cents), 0), count(*)
    into v_add_ons, v_extras, v_count
    from public.add_ons a
   where a.id = any(p_add_on_ids) and a.detailer_id = d.id and a.active;
  if v_count <> cardinality(p_add_on_ids) then return jsonb_build_object('ok', false, 'error', 'add_on'); end if;

  -- The slot must be one of the detailer's weekly start times, in their timezone,
  -- at least an hour out, within three weeks, and not on a day off.
  v_today := (now() at time zone d.timezone)::date;
  v_starts := (p_date + p_time) at time zone d.timezone;
  if p_date > v_today + 21
     or v_starts < now() + interval '1 hour'
     or not exists (select 1 from public.availability_slots v
                     where v.detailer_id = d.id and v.weekday = extract(dow from p_date) and v.start_time = p_time)
     or exists (select 1 from public.days_off o where o.detailer_id = d.id and o.day = p_date)
  then
    return jsonb_build_object('ok', false, 'error', 'slot_unavailable');
  end if;

  -- Free plan: a monthly cap on paid bookings (limit from plan_config, never
  -- hardcoded). Counts this month's paid bookings plus live holds.
  if not public.detailer_is_pro(d.id) and (
       select count(*) from public.bookings b
        where b.detailer_id = d.id
          and (b.created_at at time zone d.timezone) >= date_trunc('month', now() at time zone d.timezone)
          and (b.status in ('confirmed', 'completed', 'no_show')
               or (b.status = 'pending_payment' and b.created_at >= now() - interval '30 minutes'))
     ) >= public.free_booking_limit() then
    return jsonb_build_object('ok', false, 'error', 'plan_limit');
  end if;

  -- Unpaid holds older than 30 minutes release their time.
  update public.bookings set status = 'cancelled'
   where detailer_id = d.id and status = 'pending_payment'
     and created_at < now() - interval '30 minutes';

  v_subtotal := case p_vehicle_size when 'sedan' then s.price_sedan_cents
                                    when 'suv'   then s.price_suv_cents
                                    else s.price_truck_cents end + v_extras;
  v_deposit := public.deposit_cents(v_subtotal, d.deposit_percent);
  -- External mode: the client pays the deposit to the detailer directly, so
  -- there is no card processing and no booking fee, and the booking is
  -- confirmed now (no unpaid hold).
  v_external := public.payments_mode() = 'external';
  v_fee := case when v_external then 0 else public.booking_fee_cents(v_deposit) end;

  insert into public.clients as c (detailer_id, name, phone, sms_consent, sms_consent_at, sms_consent_text, sms_opted_out_at)
  values (d.id, p_name, p_phone, p_sms_consent,
          case when p_sms_consent then now() end,
          case when p_sms_consent then p_consent_text end,
          null)
  on conflict (detailer_id, phone) do update set
    name             = excluded.name,
    sms_consent      = c.sms_consent or excluded.sms_consent,
    sms_consent_at   = case when excluded.sms_consent then excluded.sms_consent_at else c.sms_consent_at end,
    sms_consent_text = case when excluded.sms_consent then excluded.sms_consent_text else c.sms_consent_text end,
    sms_opted_out_at = case when excluded.sms_consent then null else c.sms_opted_out_at end
  returning c.id into v_client;

  v_has_team := exists (select 1 from public.staff_members m where m.detailer_id = d.id and m.active);
  if p_staff_id is not null and not exists (select 1 from public.staff_members m where m.id = p_staff_id and m.detailer_id = d.id and m.active) then
    return jsonb_build_object('ok', false, 'error', 'staff');
  end if;

  -- One try for a chosen person (or a solo business); every active person in order for "anyone".
  for v_staff in
    select x from (
      select p_staff_id as x, 0 as o where p_staff_id is not null or not v_has_team
      union all
      select m.id, m.sort_order + 1 from public.staff_members m
       where p_staff_id is null and v_has_team and m.detailer_id = d.id and m.active
    ) c order by o
  loop
    begin
      insert into public.bookings (detailer_id, client_id, service_id, service_name, vehicle_size, add_ons, starts_at,
                                   duration_min, address, subtotal_cents, deposit_cents, booking_fee_cents, status, staff_id)
      values (d.id, v_client, s.id, s.name, p_vehicle_size, v_add_ons, v_starts,
              s.duration_min, v_address, v_subtotal, v_deposit, v_fee,
              case when v_external then 'confirmed' else 'pending_payment' end::public.booking_status, v_staff)
      returning id, client_token into v_booking, v_token;
      v_chosen := v_staff;
      exit;
    exception when unique_violation or exclusion_violation then
      null; -- that person is busy: try the next
    end;
  end loop;
  if v_booking is null then
    return jsonb_build_object('ok', false, 'error', 'slot_taken');
  end if;

  insert into public.audit_log (detailer_id, actor, event, data)
  values (d.id, 'booking_page', 'booking.created',
          jsonb_build_object('booking_id', v_booking, 'subtotal_cents', v_subtotal, 'deposit_cents', v_deposit,
                             'payments', case when v_external then 'external' else 'stripe' end));

  return jsonb_build_object('ok', true, 'bookingId', v_booking, 'startsAt', v_starts,
                            'subtotalCents', v_subtotal, 'depositCents', v_deposit, 'bookingFeeCents', v_fee,
                            'payments', case when v_external then 'external' else 'stripe' end,
                            'clientToken', v_token, 'staffId', v_chosen);
end $$;

create or replace function public.detailer_book(
  p_client_id    uuid,
  p_service_id   uuid,
  p_vehicle_size public.vehicle_size,
  p_starts_at    timestamptz,
  p_address      text,
  p_every_weeks  integer default 0,
  p_count        integer default 1,
  p_staff_id     uuid default null
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
  if p_staff_id is not null and not exists (select 1 from public.staff_members m where m.id = p_staff_id and m.detailer_id = d.id) then
    return jsonb_build_object('ok', false, 'error', 'staff');
  end if;
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
                                   address, subtotal_cents, deposit_cents, booking_fee_cents, status, staff_id)
      values (d.id, p_client_id, s.id, s.name, p_vehicle_size, v_at, s.duration_min, left(p_address, 200),
              v_price, public.deposit_cents(v_price, d.deposit_percent), 0, 'confirmed', p_staff_id)
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

create or replace function public.get_booking_page(p_handle text)
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
    'country',      d.country,
    'currency',     upper(public.country_currency(d.country)),
    'rating',       r.rating,
    'reviewCount',  coalesce(r.review_count, 0),
    'payments',     public.payments_mode(),
    'paymentLink',  d.payment_link,
    'paymentNote',  d.payment_note,
    'depositPercent', d.deposit_percent,
    'contactPhone', d.contact_phone,
    'bufferMin',    d.buffer_min,
    'staff', coalesce((
      select jsonb_agg(jsonb_build_object('id', m.id, 'name', m.name) order by m.sort_order, m.created_at)
      from public.staff_members m where m.detailer_id = d.id and m.active), '[]'::jsonb),
    'trade',        d.trade,
    'visitMode',    d.visit_mode,
    -- Changes whenever the photo changes, so browsers fetch the new one.
    'photo',        case when d.photo_path is null then null else left(md5(d.photo_path), 10) end,
    'portfolio', coalesce((
      select jsonb_agg(jsonb_build_object('id', p.id, 'caption', p.caption) order by p.sort_order, p.created_at)
      from public.portfolio_items p
      where p.detailer_id = d.id), '[]'::jsonb),
    'services', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', s.id,
               'name', s.name,
               'description', s.description,
               'durationMin', s.duration_min,
               'photo', case when s.photo_path is null then null else left(md5(s.photo_path), 10) end,
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
      ) w), '{}'::jsonb),
    'daysOff', coalesce((
      select jsonb_agg(to_char(o.day, 'YYYY-MM-DD') order by o.day)
      from public.days_off o
      where o.detailer_id = d.id
        and o.day between (now() at time zone d.timezone)::date and (now() at time zone d.timezone)::date + 22), '[]'::jsonb),
    'taken', coalesce((
      select jsonb_agg(to_char(b.starts_at at time zone d.timezone, 'YYYY-MM-DD HH24:MI') order by b.starts_at)
      from public.bookings b
      where b.detailer_id = d.id
        and b.starts_at between now() and now() + interval '22 days'
        and public.booking_is_live(b.status, b.created_at)), '[]'::jsonb),
    'busy', coalesce((
      select jsonb_agg(jsonb_build_object(
               'start', to_char(b.starts_at at time zone d.timezone, 'YYYY-MM-DD HH24:MI'),
               'minutes', b.duration_min,
               'staffId', b.staff_id) order by b.starts_at)
      from public.bookings b
      where b.detailer_id = d.id
        and b.starts_at between now() - interval '13 hours' and now() + interval '22 days'
        and public.booking_is_live(b.status, b.created_at)), '[]'::jsonb)
  )
  from public.detailers d
  left join lateral (
    select round(avg(rv.rating)::numeric, 1)::float8 as rating, count(*)::int as review_count
    from public.reviews rv
    where rv.detailer_id = d.id and not rv.hidden
  ) r on true
  where d.handle = lower(p_handle) and d.is_published;
$$;
