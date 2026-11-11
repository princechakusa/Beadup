-- Audit 2026-11-11, stage 2 (P1).
--
-- 1. Days off: whole dates a detailer doesn't work (holiday, sick day). The
--    booking page hides them and create_booking() refuses them, without the
--    detailer deleting their weekly times.
-- 2. Public contact phone: the confirmation tells clients to contact the
--    detailer, so the page has to show how. Optional, E.164, detailer-set.
-- 3. "I've sent the deposit": in external payments mode Beadup can't see the
--    payment, so the client can say they've paid (payment submitted) and the
--    detailer confirms it (deposit_received_at, unchanged). The client proves
--    it's their booking with a random token returned only to the browser that
--    made the booking. This never marks anything paid.

-- ---------------------------------------------------------------------------
create table public.days_off (
  detailer_id uuid not null references public.detailers (id) on delete cascade,
  day         date not null,
  created_at  timestamptz not null default now(),
  primary key (detailer_id, day)
);
alter table public.days_off enable row level security;
revoke all on public.days_off from anon, authenticated;
grant select, insert, delete on public.days_off to authenticated;
create policy days_off_owner on public.days_off for all to authenticated
  using (detailer_id = (select auth.uid())) with check (detailer_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
alter table public.detailers
  add column contact_phone text check (contact_phone is null or contact_phone ~ '^\+[1-9][0-9]{7,14}$');
grant update (contact_phone) on public.detailers to authenticated;

-- ---------------------------------------------------------------------------
alter table public.bookings
  add column deposit_reported_at timestamptz,
  add column client_token text unique default encode(extensions.gen_random_bytes(24), 'hex')
    check (client_token ~ '^[0-9a-f]{48}$');
update public.bookings set client_token = encode(extensions.gen_random_bytes(24), 'hex') where client_token is null;
alter table public.bookings alter column client_token set not null;
-- The token is a secret for the client's browser; the detailer app never needs it.
revoke select on public.bookings from authenticated;
grant select (id, detailer_id, client_id, service_id, service_name, vehicle_size, add_ons, starts_at, duration_min,
              address, notes, subtotal_cents, deposit_cents, booking_fee_cents, status, payment_intent_id,
              created_at, updated_at, deposit_received_at, completed_at, review_token, deposit_reported_at)
  on public.bookings to authenticated;

create function public.report_deposit_sent(p_booking_id uuid, p_token text)
returns jsonb language plpgsql volatile security definer set search_path = '' as $$
declare
  b public.bookings%rowtype;
begin
  select * into b from public.bookings where id = p_booking_id and client_token = p_token for update;
  if not found then return jsonb_build_object('ok', false, 'error', 'not_found'); end if;
  if b.status <> 'confirmed' then return jsonb_build_object('ok', false, 'error', 'status'); end if;
  if b.deposit_received_at is not null or b.deposit_reported_at is not null then
    return jsonb_build_object('ok', true, 'first', false); -- already known: no second alert
  end if;

  update public.bookings set deposit_reported_at = now() where id = b.id;
  insert into public.audit_log (detailer_id, actor, event, data)
  values (b.detailer_id, 'client', 'deposit.reported', jsonb_build_object('booking_id', b.id, 'deposit_cents', b.deposit_cents));
  return jsonb_build_object('ok', true, 'first', true);
end $$;

revoke all on function public.report_deposit_sent(uuid, text) from public, anon, authenticated;
grant execute on function public.report_deposit_sent(uuid, text) to service_role;

-- ---------------------------------------------------------------------------
-- create_booking: refuses days off; returns the client token.
-- ---------------------------------------------------------------------------
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
            s.duration_min, p_address, v_subtotal, v_deposit, v_fee,
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

-- ---------------------------------------------------------------------------
-- Booking page: days off and the public contact phone.
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
    'country',      d.country,
    'currency',     upper(public.country_currency(d.country)),
    'rating',       r.rating,
    'reviewCount',  coalesce(r.review_count, 0),
    'payments',     public.payments_mode(),
    'paymentLink',  d.payment_link,
    'paymentNote',  d.payment_note,
    'contactPhone', d.contact_phone,
    'bufferMin',    d.buffer_min,
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
