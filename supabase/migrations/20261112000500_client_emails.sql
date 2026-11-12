-- Client emails (owner request 2026-11-12): an optional email at booking gets
-- the confirmation, a day-before reminder, reschedule and cancellation notices
-- and the receipt. Sent by the web app through Brevo. One email per event:
-- unique (booking, kind, dedupe). Transactional only, never marketing.

create type public.email_kind as enum ('confirmation', 'reminder', 'rescheduled', 'cancelled', 'receipt');

create table public.client_emails (
  id          uuid primary key default gen_random_uuid(),
  detailer_id uuid not null references public.detailers (id) on delete cascade,
  booking_id  uuid not null references public.bookings (id) on delete cascade,
  kind        public.email_kind not null,
  -- Distinguishes repeat events of one kind (each new time after a reschedule).
  dedupe      text not null default '' check (char_length(dedupe) <= 64),
  status      public.message_status not null default 'queued',
  error       text check (char_length(error) <= 300),
  attempts    integer not null default 0,
  created_at  timestamptz not null default now(),
  sent_at     timestamptz,
  unique (booking_id, kind, dedupe)
);
create index client_emails_queued_idx on public.client_emails (created_at) where status = 'queued';
alter table public.client_emails enable row level security;
revoke all on public.client_emails from anon, authenticated;
grant select on public.client_emails to authenticated;
create policy client_emails_owner_select on public.client_emails for select to authenticated
  using (detailer_id = (select auth.uid()));

-- Queue one email if the client gave an address. Returns true when queued.
create function public.enqueue_client_email(p_booking_id uuid, p_kind public.email_kind, p_dedupe text default '')
returns boolean language plpgsql volatile security definer set search_path = '' as $$
declare
  v_detailer uuid;
begin
  select b.detailer_id into v_detailer
    from public.bookings b join public.clients c on c.id = b.client_id
   where b.id = p_booking_id and c.email is not null;
  if not found then return false; end if;
  insert into public.client_emails (detailer_id, booking_id, kind, dedupe)
  values (v_detailer, p_booking_id, p_kind, coalesce(p_dedupe, ''))
  on conflict do nothing;
  return found;
end $$;

-- Booking page: save the client's email on their client record and queue the confirmation.
create function public.set_client_email(p_booking_id uuid, p_email text)
returns boolean language plpgsql volatile security definer set search_path = '' as $$
begin
  if p_email is null or char_length(p_email) > 254 or p_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then return false; end if;
  update public.clients c set email = lower(trim(p_email))
    from public.bookings b where b.id = p_booking_id and c.id = b.client_id;
  if not found then return false; end if;
  return public.enqueue_client_email(p_booking_id, 'confirmation');
end $$;

-- Changes the client should hear about.
create function public.bookings_queue_emails() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.status = 'cancelled' and old.status in ('pending_payment', 'confirmed') then
    perform public.enqueue_client_email(new.id, 'cancelled');
  elsif new.status = 'completed' and old.status is distinct from 'completed' then
    perform public.enqueue_client_email(new.id, 'receipt');
  elsif new.starts_at is distinct from old.starts_at and new.status = 'confirmed' then
    perform public.enqueue_client_email(new.id, 'rescheduled', to_char(new.starts_at at time zone 'UTC', 'YYYYMMDDHH24MI'));
  end if;
  return null;
end $$;
create trigger bookings_queue_emails after update of starts_at, status on public.bookings
  for each row execute function public.bookings_queue_emails();

-- Day-before reminders, sent between 10:00 and 20:00 in the business's time zone.
create function public.enqueue_due_emails()
returns integer language plpgsql volatile security definer set search_path = '' as $$
declare
  n integer := 0;
  r record;
begin
  for r in
    select b.id from public.bookings b
      join public.detailers d on d.id = b.detailer_id
      join public.clients c on c.id = b.client_id
     where b.status = 'confirmed' and c.email is not null
       and (b.starts_at at time zone d.timezone)::date = (now() at time zone d.timezone)::date + 1
       and extract(hour from now() at time zone d.timezone) between 10 and 19
  loop
    if public.enqueue_client_email(r.id, 'reminder') then n := n + 1; end if;
  end loop;
  return n;
end $$;

-- Everything one email needs (server only).
create function public.email_context(p_email_id uuid)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'id', e.id, 'kind', e.kind, 'status', e.status, 'attempts', e.attempts,
    'to', c.email, 'firstName', split_part(c.name, ' ', 1),
    'businessName', d.business_name, 'handle', d.handle, 'contactPhone', d.contact_phone,
    'country', d.country, 'timezone', d.timezone, 'trade', d.trade, 'visitMode', d.visit_mode,
    'serviceArea', d.service_area, 'paymentLink', d.payment_link, 'paymentNote', d.payment_note,
    'payments', public.payments_mode(),
    'serviceName', b.service_name, 'vehicleSize', b.vehicle_size, 'startsAt', b.starts_at,
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

create function public.queued_emails(p_limit integer default 50)
returns setof uuid language sql stable security definer set search_path = '' as $$
  select id from public.client_emails where status = 'queued' and attempts < 5 order by created_at limit p_limit;
$$;

create function public.mark_email(p_email_id uuid, p_status public.message_status, p_error text default null)
returns void language sql volatile security definer set search_path = '' as $$
  update public.client_emails
     set status = p_status, error = left(p_error, 300), attempts = attempts + 1,
         sent_at = case when p_status = 'sent' then now() else sent_at end
   where id = p_email_id;
$$;

revoke all on function public.enqueue_client_email(uuid, public.email_kind, text), public.set_client_email(uuid, text),
  public.bookings_queue_emails(), public.enqueue_due_emails(), public.email_context(uuid), public.queued_emails(integer),
  public.mark_email(uuid, public.message_status, text) from public, anon, authenticated;
grant execute on function public.enqueue_client_email(uuid, public.email_kind, text), public.set_client_email(uuid, text),
  public.enqueue_due_emails(), public.email_context(uuid), public.queued_emails(integer),
  public.mark_email(uuid, public.message_status, text) to service_role;
