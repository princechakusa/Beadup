-- M6 messaging: day-before reminders, review requests, STOP handling.
-- All texts still flow through the messages outbox, which checks consent and
-- opt-out at send time.

alter type public.message_kind add value if not exists 'reminder';
alter type public.message_kind add value if not exists 'review_request';

-- When a job was completed (drives the review request) and the unguessable
-- token for its review link.
alter table public.bookings
  add column completed_at timestamptz,
  add column review_token text unique
    default encode(extensions.gen_random_bytes(24), 'hex')
    check (review_token ~ '^[0-9a-f]{48}$');
update public.bookings set review_token = encode(extensions.gen_random_bytes(24), 'hex') where review_token is null;
alter table public.bookings alter column review_token set not null;
update public.bookings set completed_at = updated_at where status = 'completed' and completed_at is null;

create function public.set_completed_at() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.status = 'completed' and old.status is distinct from 'completed' then
    new.completed_at := now();
  end if;
  return new;
end $$;
create trigger bookings_completed_at before update of status on public.bookings
  for each row execute function public.set_completed_at();

-- ---------------------------------------------------------------------------
-- Queue due texts. Run by the cron route every 15 minutes or so.
--   * reminder: confirmed bookings starting tomorrow (detailer's local date),
--     queued only between 10:00 and 20:00 local time (TCPA quiet hours).
--   * review_request: about 2 hours after a job is completed, within 3 days,
--     between 09:00 and 20:00 local time, if no review exists yet.
-- The unique index on messages (booking_id, kind) makes each one go out once.
-- ---------------------------------------------------------------------------
create function public.enqueue_due_messages()
returns jsonb language plpgsql volatile security definer set search_path = '' as $$
declare
  v_reminders integer;
  v_reviews integer;
begin
  with due as (
    select b.id, b.detailer_id, b.client_id
    from public.bookings b
    join public.detailers d on d.id = b.detailer_id
    where b.status = 'confirmed'
      and (b.starts_at at time zone d.timezone)::date = (now() at time zone d.timezone)::date + 1
      and extract(hour from now() at time zone d.timezone) between 10 and 19
  ), ins as (
    insert into public.messages (detailer_id, booking_id, client_id, kind)
    select detailer_id, id, client_id, 'reminder' from due
    on conflict do nothing
    returning 1
  ) select count(*) into v_reminders from ins;

  with due as (
    select b.id, b.detailer_id, b.client_id
    from public.bookings b
    join public.detailers d on d.id = b.detailer_id
    where b.status = 'completed'
      and b.completed_at between now() - interval '3 days' and now() - interval '2 hours'
      and not exists (select 1 from public.reviews r where r.booking_id = b.id)
      and extract(hour from now() at time zone d.timezone) between 9 and 19
  ), ins as (
    insert into public.messages (detailer_id, booking_id, client_id, kind)
    select detailer_id, id, client_id, 'review_request' from due
    on conflict do nothing
    returning 1
  ) select count(*) into v_reviews from ins;

  return jsonb_build_object('reminders', v_reminders, 'reviewRequests', v_reviews);
end $$;

-- Message context now carries the review link token.
create or replace function public.message_context(p_message_id uuid)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'id', m.id, 'kind', m.kind, 'status', m.status, 'linkUrl', m.link_url,
    'phone', c.phone, 'clientName', c.name,
    'canText', c.sms_consent and c.sms_opted_out_at is null,
    'businessName', d.business_name, 'timezone', d.timezone,
    'serviceName', b.service_name, 'startsAt', b.starts_at, 'address', b.address,
    'subtotalCents', b.subtotal_cents, 'depositCents', b.deposit_cents,
    'reviewToken', b.review_token,
    'paidCents', coalesce((select sum(p.amount_cents + p.booking_fee_cents) from public.payments p
                            where p.booking_id = b.id and p.status = 'succeeded'), 0))
  from public.messages m
  join public.bookings b on b.id = m.booking_id
  join public.clients c on c.id = m.client_id
  join public.detailers d on d.id = m.detailer_id
  where m.id = p_message_id;
$$;

-- ---------------------------------------------------------------------------
-- Reviews from the client's review link (verified: completed booking only).
-- ---------------------------------------------------------------------------
create function public.review_context(p_token text)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'businessName', d.business_name, 'handle', d.handle, 'serviceName', b.service_name,
    'firstName', split_part(c.name, ' ', 1),
    'canReview', b.status = 'completed' and r.id is null,
    'alreadyReviewed', r.id is not null)
  from public.bookings b
  join public.detailers d on d.id = b.detailer_id
  join public.clients c on c.id = b.client_id
  left join public.reviews r on r.booking_id = b.id
  where b.review_token = p_token and p_token ~ '^[0-9a-f]{48}$';
$$;

create function public.submit_review(p_token text, p_rating integer, p_body text)
returns jsonb language plpgsql volatile security definer set search_path = '' as $$
declare b public.bookings%rowtype;
begin
  if p_token !~ '^[0-9a-f]{48}$' then return jsonb_build_object('ok', false, 'error', 'not_found'); end if;
  select * into b from public.bookings where review_token = p_token;
  if not found then return jsonb_build_object('ok', false, 'error', 'not_found'); end if;
  if b.status <> 'completed' then return jsonb_build_object('ok', false, 'error', 'not_completed'); end if;
  insert into public.reviews (detailer_id, booking_id, rating, body)
  values (b.detailer_id, b.id, p_rating, left(trim(coalesce(p_body, '')), 1000))
  on conflict (booking_id) do nothing;
  if not found then return jsonb_build_object('ok', false, 'error', 'already_reviewed'); end if;
  return jsonb_build_object('ok', true, 'handle', (select handle from public.detailers where id = b.detailer_id));
exception when check_violation then
  return jsonb_build_object('ok', false, 'error', 'invalid');
end $$;

-- ---------------------------------------------------------------------------
-- STOP / START from the Twilio inbound webhook. One sending number serves all
-- detailers, so an opt-out applies to every client record with that phone.
-- ---------------------------------------------------------------------------
create function public.record_sms_opt_out(p_phone text, p_opted_out boolean)
returns integer language plpgsql volatile security definer set search_path = '' as $$
declare v_count integer;
begin
  update public.clients
     set sms_opted_out_at = case when p_opted_out then coalesce(sms_opted_out_at, now()) else null end
   where phone = p_phone;
  get diagnostics v_count = row_count;
  -- Pending texts to an opted-out number are dropped, not sent later.
  if p_opted_out then
    update public.messages m set status = 'skipped', error = 'opted_out'
      from public.clients c
     where c.id = m.client_id and c.phone = p_phone and m.status = 'queued';
  end if;
  insert into public.audit_log (detailer_id, actor, event, data)
  select c.detailer_id, 'twilio', case when p_opted_out then 'sms.opt_out' else 'sms.opt_in' end,
         jsonb_build_object('client_id', c.id)
  from public.clients c where c.phone = p_phone;
  return v_count;
end $$;

revoke execute on function public.enqueue_due_messages(), public.review_context(text),
  public.submit_review(text, integer, text), public.record_sms_opt_out(text, boolean) from public, anon, authenticated;
grant execute on function public.enqueue_due_messages(), public.review_context(text),
  public.submit_review(text, integer, text), public.record_sms_opt_out(text, boolean) to service_role;
