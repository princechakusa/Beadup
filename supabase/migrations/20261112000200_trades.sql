-- Trades (owner request 2026-11-12): Beadup for any appointment business, not
-- only car detailers. A business picks its trade at sign-up; the web and app
-- read how it books from apps/*/src/lib/trades.ts. Prices keep their three tier
-- columns (labelled per trade; single-price trades store one price in all
-- three). Services can carry a photo (a hairstyle, a nail set) that clients see
-- and pick from. visit_mode "studio" means the client comes to the business, so
-- the booking needs no client address.

alter table public.detailers
  add column trade text not null default 'detailing'
    constraint detailers_trade_check check (trade in ('detailing', 'boat_rv', 'pressure_washing', 'window_cleaning', 'house_cleaning', 'pet_grooming', 'hair_salon', 'barber', 'nails_beauty', 'makeup', 'mechanic', 'handyman', 'other')),
  add column visit_mode text not null default 'mobile'
    constraint detailers_visit_mode_check check (visit_mode in ('mobile', 'studio'));
grant update (trade, visit_mode) on public.detailers to authenticated;

alter table public.services add column photo_path text;
alter table public.services add constraint services_photo_path_own
  check (photo_path is null or public.is_own_media_path(detailer_id, photo_path));
grant update (photo_path) on public.services to authenticated;

-- Media: also a service's photo (by service id), published detailers only.
create or replace function public.media_path(p_handle text, p_item_id uuid default null)
returns text language sql stable security definer set search_path = '' as $$
  select case
    when p_item_id is null then d.photo_path
    else coalesce(
      (select p.path from public.portfolio_items p where p.id = p_item_id and p.detailer_id = d.id),
      (select s.photo_path from public.services s where s.id = p_item_id and s.detailer_id = d.id and s.active))
  end
  from public.detailers d
  where d.handle = lower(p_handle) and d.is_published;
$$;

-- create_booking: unchanged except the address for studio visits.
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
  p_consent_text text
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
  v_deposit := public.deposit_cents(v_subtotal);
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

  begin
    insert into public.bookings (detailer_id, client_id, service_id, service_name, vehicle_size, add_ons, starts_at,
                                 duration_min, address, subtotal_cents, deposit_cents, booking_fee_cents, status)
    values (d.id, v_client, s.id, s.name, p_vehicle_size, v_add_ons, v_starts,
            s.duration_min, v_address, v_subtotal, v_deposit, v_fee,
            case when v_external then 'confirmed' else 'pending_payment' end::public.booking_status)
    returning id, client_token into v_booking, v_token;
  exception when unique_violation or exclusion_violation then
    return jsonb_build_object('ok', false, 'error', 'slot_taken');
  end;

  insert into public.audit_log (detailer_id, actor, event, data)
  values (d.id, 'booking_page', 'booking.created',
          jsonb_build_object('booking_id', v_booking, 'subtotal_cents', v_subtotal, 'deposit_cents', v_deposit,
                             'payments', case when v_external then 'external' else 'stripe' end));

  return jsonb_build_object('ok', true, 'bookingId', v_booking, 'startsAt', v_starts,
                            'subtotalCents', v_subtotal, 'depositCents', v_deposit, 'bookingFeeCents', v_fee,
                            'payments', case when v_external then 'external' else 'stripe' end,
                            'clientToken', v_token);
end $$;

-- Booking page: trade, visit mode and service photo versions.
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
    'contactPhone', d.contact_phone,
    'bufferMin',    d.buffer_min,
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
               'minutes', b.duration_min) order by b.starts_at)
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

-- Client booking page: trade and visit mode.
create or replace function public.client_booking(p_token text)
returns jsonb language sql stable security definer set search_path = '' as $$
  select case
    when b.starts_at < now() - interval '30 days' then
      jsonb_build_object('expired', true, 'businessName', d.business_name, 'handle', d.handle)
    else jsonb_build_object(
      'expired',       false,
      'bookingId',     b.id,
      'ref',           upper(left(replace(b.id::text, '-', ''), 8)),
      'handle',        d.handle,
      'trade',         d.trade,
      'visitMode',     d.visit_mode,
      'businessName',  d.business_name,
      'contactPhone',  d.contact_phone,
      'country',       d.country,
      'timezone',      d.timezone,
      'firstName',     split_part(c.name, ' ', 1),
      'serviceName',   b.service_name,
      'vehicleSize',   b.vehicle_size,
      'addOns',        coalesce((select jsonb_agg(a ->> 'name') from jsonb_array_elements(b.add_ons) a), '[]'::jsonb),
      'startsAt',      b.starts_at,
      'durationMin',   b.duration_min,
      'status',        b.status,
      'subtotalCents', b.subtotal_cents,
      'depositCents',  b.deposit_cents,
      'payments',      public.payments_mode(),
      'depositStatus', case
                         when b.deposit_cents = 0 then 'not_required'
                         when b.deposit_received_at is not null
                           or exists (select 1 from public.payments p where p.booking_id = b.id
                                        and p.kind = 'deposit' and p.status = 'succeeded') then 'received'
                         when b.deposit_reported_at is not null then 'reported'
                         else 'due' end,
      'paymentLink',   d.payment_link,
      'paymentNote',   d.payment_note,
      'request', (select jsonb_build_object('kind', r.kind, 'preferred', r.preferred, 'note', r.note, 'createdAt', r.created_at)
                    from public.booking_requests r where r.booking_id = b.id and r.status = 'open'))
  end
  from public.bookings b
  join public.detailers d on d.id = b.detailer_id
  join public.clients c on c.id = b.client_id
  where p_token ~ '^[0-9a-f]{48}$' and b.client_token = p_token;
$$;

-- Receipt: the trade, for size labels.
create or replace function public.receipt_context(p_token text)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'ref',           upper(left(replace(b.id::text, '-', ''), 8)),
    'handle',        d.handle,
    'trade',         d.trade,
    'businessName',  d.business_name,
    'contactPhone',  d.contact_phone,
    'country',       d.country,
    'timezone',      d.timezone,
    'firstName',     split_part(c.name, ' ', 1),
    'serviceName',   b.service_name,
    'vehicleSize',   b.vehicle_size,
    'addOns',        b.add_ons,
    'startsAt',      b.starts_at,
    'completedAt',   b.completed_at,
    'status',        b.status,
    'subtotalCents', b.subtotal_cents,
    'depositCents',  b.deposit_cents,
    'depositPaid',   b.deposit_received_at is not null
                     or exists (select 1 from public.payments p where p.booking_id = b.id and p.kind = 'deposit' and p.status = 'succeeded'))
  from public.bookings b
  join public.detailers d on d.id = b.detailer_id
  join public.clients c on c.id = b.client_id
  where p_token ~ '^[0-9a-f]{48}$' and b.review_token = p_token;
$$;
