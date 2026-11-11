-- Booking integrity (audit 2026-11-11, P0).
--
-- 1. Overlaps. bookings_no_double_book only stopped two bookings with the SAME
--    start time, so a 6 h job at 08:00 and another at 09:30 were both accepted.
--    A trigger now rejects any live booking whose time range (plus the
--    detailer's travel buffer) overlaps another live booking. It takes a
--    per-detailer advisory lock first, so two concurrent bookings can't both
--    pass the check. A trigger rather than an exclusion constraint so the
--    migration can't fail on overlapping rows that already exist in production;
--    those are left alone and only new or moved bookings are checked.
-- 2. Travel time: detailers.buffer_min, minutes kept free between jobs.
-- 3. Status changes written directly by the detailer app are limited to real
--    transitions (job done, no-show, undo). Cancelling goes through
--    cancel_booking() (refund policy), rescheduling through reschedule_booking()
--    (audited). Server functions run as the owner and are not limited.
-- 4. The public page gets busy ranges (start + minutes) and the buffer, so it
--    can hide start times that would overlap, not just identical ones.

alter table public.detailers
  add column buffer_min smallint not null default 0 check (buffer_min between 0 and 240);
grant update (buffer_min) on public.detailers to authenticated;

-- A booking holds its time while confirmed, or while an unpaid hold is fresh.
create function public.booking_is_live(p_status public.booking_status, p_created_at timestamptz)
returns boolean language sql stable set search_path = '' as $$
  select p_status = 'confirmed' or (p_status = 'pending_payment' and p_created_at >= now() - interval '30 minutes');
$$;

create function public.bookings_check_overlap() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_buffer integer;
begin
  if new.status not in ('pending_payment', 'confirmed') then return new; end if;
  -- Unchanged times on a booking that already held them (e.g. a paid hold
  -- becoming confirmed): nothing new to check.
  if tg_op = 'UPDATE' and old.status in ('pending_payment', 'confirmed')
     and old.starts_at = new.starts_at and old.duration_min = new.duration_min then
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
       and b.starts_at < new.starts_at + make_interval(mins => new.duration_min + v_buffer)
       and new.starts_at < b.starts_at + make_interval(mins => b.duration_min + v_buffer)
  ) then
    raise exception 'booking overlaps another booking' using errcode = '23P01'; -- exclusion_violation
  end if;
  return new;
end $$;

create trigger bookings_overlap_check -- fires after bookings_guard_detailer_update (name order)
  before insert or update of starts_at, duration_min, status on public.bookings
  for each row execute function public.bookings_check_overlap();

-- Direct writes from the detailer app (role "authenticated").
create function public.bookings_guard_detailer_update() returns trigger
language plpgsql set search_path = '' as $$
begin
  if current_user <> 'authenticated' then return new; end if;
  if new.status is distinct from old.status and not (
       (old.status = 'confirmed' and new.status in ('completed', 'no_show'))
    or (old.status in ('completed', 'no_show') and new.status = 'confirmed')
  ) then
    raise exception 'status change % -> % not allowed', old.status, new.status using errcode = '42501';
  end if;
  return new;
end $$;

create trigger bookings_guard_detailer_update
  before update on public.bookings
  for each row execute function public.bookings_guard_detailer_update();

-- Times change only through reschedule_booking(), which logs the change.
revoke update (starts_at, duration_min) on public.bookings from authenticated;

create function public.reschedule_booking(p_booking_id uuid, p_starts_at timestamptz)
returns jsonb language plpgsql volatile security definer set search_path = '' as $$
declare
  b public.bookings%rowtype;
begin
  select * into b from public.bookings where id = p_booking_id and detailer_id = auth.uid() for update;
  if not found then return jsonb_build_object('ok', false, 'error', 'not_found'); end if;
  if b.status not in ('pending_payment', 'confirmed') then
    return jsonb_build_object('ok', false, 'error', 'status');
  end if;
  if p_starts_at < now() or p_starts_at > now() + interval '366 days' then
    return jsonb_build_object('ok', false, 'error', 'time');
  end if;

  begin
    update public.bookings set starts_at = p_starts_at where id = b.id;
  exception when exclusion_violation or unique_violation then
    return jsonb_build_object('ok', false, 'error', 'overlap');
  end;

  insert into public.audit_log (detailer_id, actor, event, data)
  values (b.detailer_id, 'detailer', 'booking.rescheduled',
          jsonb_build_object('booking_id', b.id, 'from', b.starts_at, 'to', p_starts_at));
  return jsonb_build_object('ok', true, 'startsAt', p_starts_at);
end $$;

revoke all on function public.booking_is_live(public.booking_status, timestamptz) from public, anon, authenticated;
revoke all on function public.bookings_check_overlap() from public, anon, authenticated;
revoke all on function public.bookings_guard_detailer_update() from public, anon, authenticated;
revoke all on function public.reschedule_booking(uuid, timestamptz) from public, anon;
grant execute on function public.reschedule_booking(uuid, timestamptz) to authenticated;

-- ---------------------------------------------------------------------------
-- create_booking: overlaps come back as slot_taken, and every expired unpaid
-- hold of this detailer is released first (not only one at the same start).
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
    returning id into v_booking;
  exception when unique_violation or exclusion_violation then
    return jsonb_build_object('ok', false, 'error', 'slot_taken');
  end;

  insert into public.audit_log (detailer_id, actor, event, data)
  values (d.id, 'booking_page', 'booking.created',
          jsonb_build_object('booking_id', v_booking, 'subtotal_cents', v_subtotal, 'deposit_cents', v_deposit,
                             'payments', case when v_external then 'external' else 'stripe' end));

  return jsonb_build_object('ok', true, 'bookingId', v_booking, 'startsAt', v_starts,
                            'subtotalCents', v_subtotal, 'depositCents', v_deposit, 'bookingFeeCents', v_fee,
                            'payments', case when v_external then 'external' else 'stripe' end);
end $$;

-- ---------------------------------------------------------------------------
-- Booking page: busy ranges ("YYYY-MM-DD HH:MM" local start + minutes) and the
-- detailer's buffer. Times only, never who booked. Includes jobs that started
-- earlier today and are still running.
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

-- ---------------------------------------------------------------------------
-- apply_stripe_event: a late payment whose time was taken by an overlapping
-- booking (not only one at the same start) still answers refund_needed.
-- Unchanged otherwise.
-- ---------------------------------------------------------------------------
create or replace function public.apply_stripe_event(p_event_id text, p_type text, p_account_id text, p_object jsonb)
returns text language plpgsql volatile security definer set search_path = '' as $$
declare
  v_payment public.payments%rowtype;
  v_inserted integer;
  v_email text;
begin
  insert into public.processed_events (id, source) values (p_event_id, 'stripe') on conflict do nothing;
  get diagnostics v_inserted = row_count;
  if v_inserted = 0 then return 'duplicate'; end if;

  if p_type = 'account.updated' then
    update public.detailer_accounts set
      charges_enabled   = coalesce((p_object ->> 'charges_enabled')::boolean, false),
      payouts_enabled   = coalesce((p_object ->> 'payouts_enabled')::boolean, false),
      details_submitted = coalesce((p_object ->> 'details_submitted')::boolean, false)
    where stripe_account_id = p_object ->> 'id';
    return 'applied';
  end if;

  if p_type in ('checkout.session.completed', 'checkout.session.async_payment_succeeded',
                'checkout.session.expired', 'checkout.session.async_payment_failed') then
    select * into v_payment from public.payments
     where stripe_checkout_session_id = p_object ->> 'id' and stripe_account_id is not distinct from p_account_id
     for update;
    if not found then return 'ignored'; end if;

    if p_type in ('checkout.session.expired', 'checkout.session.async_payment_failed') then
      update public.payments set status = 'failed' where id = v_payment.id and status = 'pending';
      if v_payment.kind = 'deposit' then
        update public.bookings set status = 'cancelled' where id = v_payment.booking_id and status = 'pending_payment';
      end if;
      insert into public.audit_log (detailer_id, actor, event, data)
      values (v_payment.detailer_id, 'stripe', 'payment.failed',
              jsonb_build_object('booking_id', v_payment.booking_id, 'kind', v_payment.kind, 'event', p_event_id));
      return 'applied';
    end if;

    if p_object ->> 'payment_status' <> 'paid' then return 'ignored'; end if; -- async methods settle later

    update public.payments set status = 'succeeded', stripe_payment_intent_id = p_object ->> 'payment_intent'
     where id = v_payment.id;
    insert into public.audit_log (detailer_id, actor, event, data)
    values (v_payment.detailer_id, 'stripe', 'payment.succeeded',
            jsonb_build_object('booking_id', v_payment.booking_id, 'kind', v_payment.kind,
                               'amount_cents', v_payment.amount_cents, 'event', p_event_id));

    -- Keep the email Checkout collected, for receipts. Invalid values are skipped.
    v_email := lower(p_object -> 'customer_details' ->> 'email');
    if v_email is not null and char_length(v_email) <= 254 and v_email ~ '^[^@\s]+@[^@\s]+$' then
      update public.clients c set email = v_email
        from public.bookings b where b.id = v_payment.booking_id and c.id = b.client_id;
    end if;

    if v_payment.kind = 'balance' then
      update public.bookings set status = 'completed' where id = v_payment.booking_id and status = 'confirmed';
      perform public.enqueue_message(v_payment.booking_id, 'balance_receipt');
      return 'applied';
    end if;

    begin
      -- A late payment for an expired hold re-confirms only if the slot is still free.
      update public.bookings set status = 'confirmed'
       where id = v_payment.booking_id and status in ('pending_payment', 'cancelled');
    exception when unique_violation or exclusion_violation then
      insert into public.audit_log (detailer_id, actor, event, data)
      values (v_payment.detailer_id, 'stripe', 'payment.slot_lost', jsonb_build_object('booking_id', v_payment.booking_id));
      return 'refund_needed';
    end;
    perform public.enqueue_message(v_payment.booking_id, 'booking_confirmed');
    return 'applied';
  end if;

  if p_type = 'charge.refunded' then
    update public.payments set status = 'refunded'
     where stripe_payment_intent_id = p_object ->> 'payment_intent'
       and (p_object ->> 'amount_refunded')::int >= (p_object ->> 'amount')::int
    returning * into v_payment;
    if found then
      insert into public.audit_log (detailer_id, actor, event, data)
      values (v_payment.detailer_id, 'stripe', 'payment.refunded',
              jsonb_build_object('booking_id', v_payment.booking_id, 'amount_refunded', (p_object ->> 'amount_refunded')::int));
    end if;
    return 'applied';
  end if;

  return 'ignored';
end $$;
