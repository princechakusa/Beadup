-- Balance payments after the job, and a transactional outbox for customer
-- texts (receipts, balance links). Email receipts are sent by Stripe.

create type public.message_kind as enum ('booking_confirmed', 'balance_link', 'balance_receipt');
create type public.message_status as enum ('queued', 'sent', 'failed', 'skipped');

create table public.messages (
  id           uuid primary key default gen_random_uuid(),
  detailer_id  uuid not null references public.detailers (id) on delete cascade,
  booking_id   uuid not null references public.bookings (id) on delete cascade,
  client_id    uuid not null references public.clients (id) on delete cascade,
  channel      text not null default 'sms' check (channel = 'sms'),
  kind         public.message_kind not null,
  status       public.message_status not null default 'queued',
  link_url     text check (char_length(link_url) <= 1000),
  body         text check (char_length(body) <= 1600),
  provider_id  text,
  error        text check (char_length(error) <= 300),
  attempts     integer not null default 0,
  created_at   timestamptz not null default now(),
  sent_at      timestamptz
);
-- Receipts go out once per booking; balance links may be re-sent.
create unique index messages_once_per_booking on public.messages (booking_id, kind) where kind <> 'balance_link';
create index messages_queued_idx on public.messages (created_at) where status = 'queued';
create index messages_detailer_idx on public.messages (detailer_id, created_at desc);

alter table public.messages enable row level security;
revoke all on public.messages from anon, authenticated;
grant select on public.messages to authenticated;
create policy messages_owner_select on public.messages for select to authenticated
  using (detailer_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- Outbox helpers (service_role only)
-- ---------------------------------------------------------------------------
create function public.enqueue_message(p_booking_id uuid, p_kind public.message_kind, p_link text default null)
returns uuid language plpgsql volatile security definer set search_path = '' as $$
declare v_id uuid;
begin
  insert into public.messages (detailer_id, booking_id, client_id, kind, link_url)
  select b.detailer_id, b.id, b.client_id, p_kind, p_link from public.bookings b where b.id = p_booking_id
  on conflict do nothing
  returning id into v_id;
  return v_id;
end $$;

-- Everything the sender needs to render and route one message.
create function public.message_context(p_message_id uuid)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'id', m.id, 'kind', m.kind, 'status', m.status, 'linkUrl', m.link_url,
    'phone', c.phone, 'clientName', c.name,
    'canText', c.sms_consent and c.sms_opted_out_at is null,
    'businessName', d.business_name, 'timezone', d.timezone,
    'serviceName', b.service_name, 'startsAt', b.starts_at, 'address', b.address,
    'subtotalCents', b.subtotal_cents, 'depositCents', b.deposit_cents,
    'paidCents', coalesce((select sum(p.amount_cents + p.booking_fee_cents) from public.payments p
                            where p.booking_id = b.id and p.status = 'succeeded'), 0))
  from public.messages m
  join public.bookings b on b.id = m.booking_id
  join public.clients c on c.id = m.client_id
  join public.detailers d on d.id = m.detailer_id
  where m.id = p_message_id;
$$;

create function public.queued_messages(p_booking_id uuid default null, p_limit integer default 50)
returns setof uuid language sql stable security definer set search_path = '' as $$
  select id from public.messages
  where status = 'queued' and attempts < 5 and (p_booking_id is null or booking_id = p_booking_id)
  order by created_at limit p_limit;
$$;

create function public.mark_message(p_message_id uuid, p_status public.message_status, p_body text,
                                    p_provider_id text default null, p_error text default null)
returns void language sql volatile security definer set search_path = '' as $$
  update public.messages set
    status = case when p_status = 'failed' and attempts + 1 < 5 then 'queued'::public.message_status else p_status end,
    attempts = attempts + 1,
    body = coalesce(p_body, body), provider_id = p_provider_id, error = left(p_error, 300),
    sent_at = case when p_status = 'sent' then now() else sent_at end
  where id = p_message_id;
$$;

-- ---------------------------------------------------------------------------
-- Balance payment. The client pays the remaining amount plus a booking fee
-- that covers its card processing, like the deposit.
-- ---------------------------------------------------------------------------
create function public.balance_context(p_booking_id uuid, p_detailer_id uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  b public.bookings%rowtype;
  v_paid integer;
  v_balance integer;
  v_account text;
begin
  select * into b from public.bookings where id = p_booking_id and detailer_id = p_detailer_id;
  if not found then return jsonb_build_object('ok', false, 'error', 'not_found'); end if;
  if b.status not in ('confirmed', 'completed') then return jsonb_build_object('ok', false, 'error', 'not_confirmed'); end if;

  select coalesce(sum(amount_cents), 0) into v_paid from public.payments
   where booking_id = b.id and status = 'succeeded' and kind in ('deposit', 'balance');
  v_balance := b.subtotal_cents - v_paid;
  if v_balance <= 0 then return jsonb_build_object('ok', false, 'error', 'paid_in_full'); end if;

  select stripe_account_id into v_account from public.detailer_accounts
   where detailer_id = b.detailer_id and charges_enabled;
  if v_account is null then return jsonb_build_object('ok', false, 'error', 'payments_not_ready'); end if;

  return jsonb_build_object('ok', true, 'bookingId', b.id, 'serviceName', b.service_name,
    'balanceCents', v_balance, 'bookingFeeCents', public.booking_fee_cents(v_balance), 'stripeAccountId', v_account,
    'businessName', (select business_name from public.detailers where id = b.detailer_id),
    'handle', (select handle from public.detailers where id = b.detailer_id));
end $$;

create function public.attach_balance_session(p_booking_id uuid, p_session_id text, p_account_id text,
                                              p_amount integer, p_fee integer)
returns void language sql volatile security definer set search_path = '' as $$
  insert into public.payments (detailer_id, booking_id, kind, status, amount_cents, booking_fee_cents,
                               stripe_checkout_session_id, stripe_account_id)
  select b.detailer_id, b.id, 'balance', 'pending', p_amount, p_fee, p_session_id, p_account_id
  from public.bookings b where b.id = p_booking_id;
$$;

-- The receipt page also serves balance sessions.
create or replace function public.booking_receipt(p_booking_id uuid, p_session_id text)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'bookingId', b.id, 'status', b.status, 'paymentStatus', p.status, 'kind', p.kind,
    'businessName', d.business_name, 'serviceName', b.service_name, 'timezone', d.timezone,
    'startsAt', b.starts_at, 'paidCents', p.amount_cents + p.booking_fee_cents,
    'stripeAccountId', p.stripe_account_id)
  from public.payments p
  join public.bookings b on b.id = p.booking_id
  join public.detailers d on d.id = b.detailer_id
  where p.booking_id = p_booking_id and p.stripe_checkout_session_id = p_session_id;
$$;

-- ---------------------------------------------------------------------------
-- Webhook handler, now aware of balance payments, client emails and texts.
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
    exception when unique_violation then
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

revoke execute on function
  public.enqueue_message(uuid, public.message_kind, text), public.message_context(uuid),
  public.queued_messages(uuid, integer), public.mark_message(uuid, public.message_status, text, text, text),
  public.balance_context(uuid, uuid), public.attach_balance_session(uuid, text, text, integer, integer)
  from public, anon, authenticated;
grant execute on function
  public.enqueue_message(uuid, public.message_kind, text), public.message_context(uuid),
  public.queued_messages(uuid, integer), public.mark_message(uuid, public.message_status, text, text, text),
  public.balance_context(uuid, uuid), public.attach_balance_session(uuid, text, text, integer, integer)
  to service_role;
