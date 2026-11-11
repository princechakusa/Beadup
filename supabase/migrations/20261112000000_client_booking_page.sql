-- Stage 4: the client's own booking page, beadup.app/b/<client_token>.
--
-- Reuses bookings.client_token (192-bit random, unreadable by the detailer app,
-- returned only to the browser that made the booking) and report_deposit_sent().
-- New: a read function for the page, and change REQUESTS. A client never moves
-- or cancels a booking themselves: they ask, the detailer decides in the app
-- (reschedule_booking / cancel_booking), and the request closes automatically.
--
-- Token rules: found only by exact match (no listing, no prefix search); the
-- page stops showing details 30 days after the appointment; deleting the
-- detailer's account deletes the booking and so the token.

create type public.booking_request_kind as enum ('reschedule', 'cancel');
create type public.booking_request_status as enum ('open', 'done', 'dismissed');

create table public.booking_requests (
  id          uuid primary key default gen_random_uuid(),
  detailer_id uuid not null references public.detailers (id) on delete cascade,
  booking_id  uuid not null,
  kind        public.booking_request_kind not null,
  -- Up to three preferred start times, "YYYY-MM-DD HH:MM" in the detailer's zone.
  preferred   jsonb not null default '[]'::jsonb
              check (jsonb_typeof(preferred) = 'array' and jsonb_array_length(preferred) <= 3),
  note        text not null default '' check (char_length(note) <= 300),
  status      public.booking_request_status not null default 'open',
  created_at  timestamptz not null default now(),
  resolved_at timestamptz,
  foreign key (booking_id, detailer_id) references public.bookings (id, detailer_id) on delete cascade
);
-- At most one open request per booking: a new one replaces it.
create unique index booking_requests_one_open on public.booking_requests (booking_id) where status = 'open';
create index booking_requests_detailer_open on public.booking_requests (detailer_id) where status = 'open';
-- Covers the foreign key, so deleting a booking (or an account) doesn't scan every request.
create index booking_requests_booking_idx on public.booking_requests (booking_id, detailer_id);

alter table public.booking_requests enable row level security;
revoke all on public.booking_requests from anon, authenticated;
grant select on public.booking_requests to authenticated;
create policy booking_requests_owner_select on public.booking_requests for select to authenticated
  using (detailer_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- What the client's page shows. Null for an unknown token. After the access
-- window only {expired, businessName, handle}. First name only, no phone or
-- address, in case the link is forwarded.
-- ---------------------------------------------------------------------------
create function public.client_booking(p_token text)
returns jsonb language sql stable security definer set search_path = '' as $$
  select case
    when b.starts_at < now() - interval '30 days' then
      jsonb_build_object('expired', true, 'businessName', d.business_name, 'handle', d.handle)
    else jsonb_build_object(
      'expired',       false,
      'bookingId',     b.id,
      'ref',           upper(left(replace(b.id::text, '-', ''), 8)),
      'handle',        d.handle,
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

-- ---------------------------------------------------------------------------
-- A client asks to move or cancel. Only for upcoming live bookings.
-- ---------------------------------------------------------------------------
create function public.request_booking_change(p_token text, p_kind public.booking_request_kind, p_preferred jsonb, p_note text)
returns jsonb language plpgsql volatile security definer set search_path = '' as $$
declare
  b  public.bookings%rowtype;
  tz text;
  v  jsonb;
  t  timestamptz;
begin
  if p_token !~ '^[0-9a-f]{48}$' then return jsonb_build_object('ok', false, 'error', 'not_found'); end if;
  select * into b from public.bookings where client_token = p_token for update;
  if not found then return jsonb_build_object('ok', false, 'error', 'not_found'); end if;
  if b.status not in ('pending_payment', 'confirmed') or b.starts_at <= now() then
    return jsonb_build_object('ok', false, 'error', 'status');
  end if;

  p_preferred := coalesce(p_preferred, '[]'::jsonb);
  p_note := coalesce(trim(p_note), '');
  if jsonb_typeof(p_preferred) <> 'array' or jsonb_array_length(p_preferred) > 3 or char_length(p_note) > 300
     or (p_kind = 'cancel' and jsonb_array_length(p_preferred) > 0)
     or (p_kind = 'reschedule' and jsonb_array_length(p_preferred) = 0 and p_note = '') then
    return jsonb_build_object('ok', false, 'error', 'invalid');
  end if;
  select timezone into tz from public.detailers where id = b.detailer_id;
  for v in select * from jsonb_array_elements(p_preferred) loop
    if jsonb_typeof(v) <> 'string' or (v #>> '{}') !~ '^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$' then
      return jsonb_build_object('ok', false, 'error', 'invalid');
    end if;
    begin
      t := (v #>> '{}')::timestamp at time zone tz;
    exception when others then
      return jsonb_build_object('ok', false, 'error', 'invalid');
    end;
    if t <= now() or t > now() + interval '60 days' then
      return jsonb_build_object('ok', false, 'error', 'invalid');
    end if;
  end loop;

  update public.booking_requests set kind = p_kind, preferred = p_preferred, note = p_note, created_at = now()
   where booking_id = b.id and status = 'open';
  if not found then
    insert into public.booking_requests (detailer_id, booking_id, kind, preferred, note)
    values (b.detailer_id, b.id, p_kind, p_preferred, p_note);
  end if;

  insert into public.audit_log (detailer_id, actor, event, data)
  values (b.detailer_id, 'client', 'booking.change_requested',
          jsonb_build_object('booking_id', b.id, 'kind', p_kind, 'preferred', p_preferred));
  return jsonb_build_object('ok', true, 'bookingId', b.id);
end $$;

-- The detailer closes a request without acting on it.
create function public.dismiss_booking_request(p_request_id uuid)
returns jsonb language plpgsql volatile security definer set search_path = '' as $$
declare
  r public.booking_requests%rowtype;
begin
  update public.booking_requests set status = 'dismissed', resolved_at = now()
   where id = p_request_id and detailer_id = auth.uid() and status = 'open'
  returning * into r;
  if not found then return jsonb_build_object('ok', false, 'error', 'not_found'); end if;
  insert into public.audit_log (detailer_id, actor, event, data)
  values (r.detailer_id, 'detailer', 'booking.request_dismissed', jsonb_build_object('booking_id', r.booking_id, 'kind', r.kind));
  return jsonb_build_object('ok', true);
end $$;

-- Acting on the booking closes the matching request: a new time closes a
-- reschedule request; leaving the live states (cancelled, done, no-show)
-- closes any request.
create function public.bookings_resolve_requests() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.status not in ('pending_payment', 'confirmed') and old.status in ('pending_payment', 'confirmed') then
    update public.booking_requests set status = 'done', resolved_at = now() where booking_id = new.id and status = 'open';
  elsif new.starts_at is distinct from old.starts_at then
    update public.booking_requests set status = 'done', resolved_at = now()
     where booking_id = new.id and status = 'open' and kind = 'reschedule';
  end if;
  return null;
end $$;

create trigger bookings_resolve_requests
  after update of starts_at, status on public.bookings
  for each row execute function public.bookings_resolve_requests();

revoke all on function public.client_booking(text) from public, anon, authenticated;
revoke all on function public.request_booking_change(text, public.booking_request_kind, jsonb, text) from public, anon, authenticated;
revoke all on function public.dismiss_booking_request(uuid) from public, anon;
revoke all on function public.bookings_resolve_requests() from public, anon, authenticated;
grant execute on function public.client_booking(text) to service_role;
grant execute on function public.request_booking_change(text, public.booking_request_kind, jsonb, text) to service_role;
grant execute on function public.dismiss_booking_request(uuid) to authenticated;
