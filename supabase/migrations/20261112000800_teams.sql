-- Teams (owner request 2026-11-12): a business can have staff (chairs,
-- groomers, cleaners). Each person has their own calendar: bookings overlap
-- only when they're for the same person. Clients pick a person or "anyone"
-- (the server gives the first free one). Solo businesses are unchanged: no
-- staff means staff_id stays null and everything works as before. A booking
-- with no person (made before the team existed) still blocks everyone.

create table public.staff_members (
  id          uuid primary key default gen_random_uuid(),
  detailer_id uuid not null references public.detailers (id) on delete cascade,
  name        text not null check (char_length(trim(name)) between 1 and 40),
  active      boolean not null default true,
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now(),
  unique (id, detailer_id)
);
create index staff_members_detailer_idx on public.staff_members (detailer_id, sort_order);
alter table public.staff_members enable row level security;
revoke all on public.staff_members from anon, authenticated;
grant select, insert, delete on public.staff_members to authenticated;
grant update (name, active, sort_order) on public.staff_members to authenticated;
create policy staff_members_owner on public.staff_members for all to authenticated
  using (detailer_id = (select auth.uid())) with check (detailer_id = (select auth.uid()));

alter table public.bookings add column staff_id uuid;
alter table public.bookings add constraint bookings_staff_fk
  foreign key (staff_id, detailer_id) references public.staff_members (id, detailer_id) on delete set null (staff_id);
create index bookings_staff_idx on public.bookings (staff_id) where staff_id is not null;
grant select (staff_id) on public.bookings to authenticated;
grant update (staff_id) on public.bookings to authenticated;

-- Two people can start at the same time; one person can't be booked twice.
drop index public.bookings_no_double_book;
create unique index bookings_no_double_book on public.bookings
  (detailer_id, coalesce(staff_id, '00000000-0000-0000-0000-000000000000'::uuid), starts_at)
  where status in ('pending_payment', 'confirmed');

create or replace function public.bookings_check_overlap() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_buffer integer;
begin
  if new.status not in ('pending_payment', 'confirmed') then return new; end if;
  -- A person left the team: their bookings are kept, unassigned. Never refused.
  if tg_op = 'UPDATE' and old.staff_id is not null and new.staff_id is null
     and old.starts_at = new.starts_at and old.duration_min = new.duration_min and old.status = new.status then
    return new;
  end if;
  if tg_op = 'UPDATE' and old.status in ('pending_payment', 'confirmed')
     and old.starts_at = new.starts_at and old.duration_min = new.duration_min
     and old.staff_id is not distinct from new.staff_id then
    return new;
  end if;

  perform pg_advisory_xact_lock(hashtextextended('bookings:' || new.detailer_id::text, 0));
  select buffer_min into v_buffer from public.detailers where id = new.detailer_id;
  v_buffer := coalesce(v_buffer, 0);

  if exists (
    select 1 from public.bookings b
     where b.detailer_id = new.detailer_id
       and b.id <> new.id
       and public.booking_is_live(b.status, b.created_at)
       -- Same person, or either booking has no person (blocks the whole team).
       and (new.staff_id is null or b.staff_id is null or b.staff_id = new.staff_id)
       and b.starts_at < new.starts_at + make_interval(mins => new.duration_min + v_buffer)
       and new.starts_at < b.starts_at + make_interval(mins => b.duration_min + v_buffer)
  ) then
    raise exception 'booking overlaps another booking' using errcode = '23P01';
  end if;
  return new;
end $$;

drop trigger bookings_overlap_check on public.bookings;
create trigger bookings_overlap_check
  before insert or update of starts_at, duration_min, status, staff_id on public.bookings
  for each row execute function public.bookings_check_overlap();

-- create_booking gains p_staff_id (the old 11-argument version is replaced).
drop function public.create_booking(text, uuid, public.vehicle_size, uuid[], date, time, text, text, text, boolean, text);
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
revoke all on function public.create_booking(text, uuid, public.vehicle_size, uuid[], date, time, text, text, text, boolean, text, uuid)
  from public, anon, authenticated;
grant execute on function public.create_booking(text, uuid, public.vehicle_size, uuid[], date, time, text, text, text, boolean, text, uuid)
  to service_role;

drop function public.detailer_book(uuid, uuid, public.vehicle_size, timestamptz, text, integer, integer);
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
              v_price, public.deposit_cents(v_price), 0, 'confirmed', p_staff_id)
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
revoke all on function public.detailer_book(uuid, uuid, public.vehicle_size, timestamptz, text, integer, integer, uuid) from public, anon;
grant execute on function public.detailer_book(uuid, uuid, public.vehicle_size, timestamptz, text, integer, integer, uuid) to authenticated;

-- Booking page: team members and per-person busy ranges.
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

-- Client page: who the appointment is with.
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
      'staffName',     (select m.name from public.staff_members m where m.id = b.staff_id),
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

-- Emails: who the appointment is with.
create or replace function public.email_context(p_email_id uuid)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'id', e.id, 'kind', e.kind, 'status', e.status, 'attempts', e.attempts,
    'to', c.email, 'firstName', split_part(c.name, ' ', 1),
    'businessName', d.business_name, 'handle', d.handle, 'contactPhone', d.contact_phone,
    'country', d.country, 'timezone', d.timezone, 'trade', d.trade, 'visitMode', d.visit_mode,
    'serviceArea', d.service_area, 'paymentLink', d.payment_link, 'paymentNote', d.payment_note,
    'payments', public.payments_mode(),
    'serviceName', b.service_name, 'staffName', (select m.name from public.staff_members m where m.id = b.staff_id), 'vehicleSize', b.vehicle_size, 'startsAt', b.starts_at,
    'durationMin', b.duration_min, 'address', b.address, 'subtotalCents', b.subtotal_cents,
    'depositCents', b.deposit_cents, 'depositReceived', b.deposit_received_at is not null,
    'clientToken', b.client_token, 'reviewToken', b.review_token,
    'ref', upper(left(replace(b.id::text, '-', ''), 8)))
  from public.client_emails e
  join public.bookings b on b.id = e.booking_id
  join public.detailers d on d.id = b.detailer_id
  join public.clients c on c.id = b.client_id
  where e.id = p_email_id;
$$;
