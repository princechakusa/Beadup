-- Server-side booking creation, rate limiting and taken slots.
-- create_booking() and hit_rate_limit() are callable by service_role only
-- (the Next.js server action); clients never write bookings directly.

-- ---------------------------------------------------------------------------
-- Pricing. Mirrors apps/web/src/lib/pricing.ts with the same integer math.
-- ---------------------------------------------------------------------------
create function public.deposit_cents(p_total integer) returns integer
language sql immutable set search_path = '' as $$
  select ((p_total * 3 + 5) / 10)::integer; -- 30%, rounded half up
$$;

-- Fee so the detailer nets the full charge after 2.9% + 30c.
create function public.booking_fee_cents(p_charge integer) returns integer
language sql immutable set search_path = '' as $$
  select case when p_charge <= 0 then 0
              else (((p_charge + 30) * 1000 + 970) / 971 - p_charge)::integer end;
$$;

-- ---------------------------------------------------------------------------
-- Rate limiting (fixed window). Keys are hashed by the caller.
-- ---------------------------------------------------------------------------
create table public.rate_limits (
  key          text not null check (char_length(key) <= 128),
  window_start timestamptz not null,
  hits         integer not null default 1,
  primary key (key, window_start)
);
alter table public.rate_limits enable row level security;
revoke all on public.rate_limits from anon, authenticated;

create function public.hit_rate_limit(p_key text, p_limit integer, p_window_seconds integer)
returns boolean -- true when the request is allowed
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_window timestamptz := to_timestamp(floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds);
  v_hits integer;
begin
  insert into public.rate_limits (key, window_start) values (p_key, v_window)
  on conflict (key, window_start) do update set hits = public.rate_limits.hits + 1
  returning hits into v_hits;
  -- Opportunistic cleanup keeps the table small without a cron job.
  if random() < 0.01 then
    delete from public.rate_limits where window_start < now() - interval '1 day';
  end if;
  return v_hits <= p_limit;
end $$;

-- ---------------------------------------------------------------------------
-- Booking creation.
-- Returns {"ok":true,...} or {"ok":false,"error":"<code>"}.
-- ---------------------------------------------------------------------------
create function public.create_booking(
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
begin
  select * into d from public.detailers where handle = lower(p_handle) and is_published;
  if not found then return jsonb_build_object('ok', false, 'error', 'not_found'); end if;

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
  -- at least an hour out and within three weeks.
  v_today := (now() at time zone d.timezone)::date;
  v_starts := (p_date + p_time) at time zone d.timezone;
  if p_date > v_today + 21
     or v_starts < now() + interval '1 hour'
     or not exists (select 1 from public.availability_slots v
                     where v.detailer_id = d.id and v.weekday = extract(dow from p_date) and v.start_time = p_time)
  then
    return jsonb_build_object('ok', false, 'error', 'slot_unavailable');
  end if;

  -- Unpaid holds older than 30 minutes release their slot.
  update public.bookings set status = 'cancelled'
   where detailer_id = d.id and starts_at = v_starts and status = 'pending_payment'
     and created_at < now() - interval '30 minutes';

  v_subtotal := case p_vehicle_size when 'sedan' then s.price_sedan_cents
                                    when 'suv'   then s.price_suv_cents
                                    else s.price_truck_cents end + v_extras;
  v_deposit := public.deposit_cents(v_subtotal);
  v_fee := public.booking_fee_cents(v_deposit);

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
                                 duration_min, address, subtotal_cents, deposit_cents, booking_fee_cents)
    values (d.id, v_client, s.id, s.name, p_vehicle_size, v_add_ons, v_starts,
            s.duration_min, p_address, v_subtotal, v_deposit, v_fee)
    returning id into v_booking;
  exception when unique_violation then
    return jsonb_build_object('ok', false, 'error', 'slot_taken');
  end;

  insert into public.audit_log (detailer_id, actor, event, data)
  values (d.id, 'booking_page', 'booking.created',
          jsonb_build_object('booking_id', v_booking, 'subtotal_cents', v_subtotal, 'deposit_cents', v_deposit));

  return jsonb_build_object('ok', true, 'bookingId', v_booking, 'startsAt', v_starts,
                            'subtotalCents', v_subtotal, 'depositCents', v_deposit, 'bookingFeeCents', v_fee);
end $$;

revoke execute on function public.deposit_cents(integer), public.booking_fee_cents(integer) from public, anon, authenticated;
revoke execute on function public.hit_rate_limit(text, integer, integer) from public, anon, authenticated;
revoke execute on function public.create_booking(text, uuid, public.vehicle_size, uuid[], date, time, text, text, text, boolean, text)
  from public, anon, authenticated;
grant execute on function public.hit_rate_limit(text, integer, integer) to service_role;
grant execute on function public.create_booking(text, uuid, public.vehicle_size, uuid[], date, time, text, text, text, boolean, text)
  to service_role;

-- ---------------------------------------------------------------------------
-- Booking page: also return taken start times ("YYYY-MM-DD HH:MM", detailer
-- local time) so the UI can hide them. Times only, never who booked.
-- ---------------------------------------------------------------------------
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
    'rating',       r.rating,
    'reviewCount',  coalesce(r.review_count, 0),
    'services', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', s.id,
               'name', s.name,
               'description', s.description,
               'durationMin', s.duration_min,
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
    'taken', coalesce((
      select jsonb_agg(to_char(b.starts_at at time zone d.timezone, 'YYYY-MM-DD HH24:MI') order by b.starts_at)
      from public.bookings b
      where b.detailer_id = d.id
        and b.starts_at between now() and now() + interval '22 days'
        and (b.status = 'confirmed'
             or (b.status = 'pending_payment' and b.created_at >= now() - interval '30 minutes'))), '[]'::jsonb)
  )
  from public.detailers d
  left join lateral (
    select round(avg(rv.rating)::numeric, 1)::float8 as rating, count(*)::int as review_count
    from public.reviews rv
    where rv.detailer_id = d.id and not rv.hidden
  ) r on true
  where d.handle = lower(p_handle) and d.is_published;
$$;
