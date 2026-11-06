-- Stripe Connect payments. All functions here are service_role only and are
-- called by server code after it has verified the request (webhook signature,
-- session token or booking ownership).

alter table public.detailer_accounts
  add column charges_enabled   boolean not null default false,
  add column payouts_enabled   boolean not null default false,
  add column details_submitted boolean not null default false;

alter table public.payments
  add column stripe_checkout_session_id text unique,
  add column stripe_account_id          text;

-- "stripe" is used by /stripe/return (Connect onboarding).
alter table public.detailers drop constraint if exists detailers_handle_check1;
alter table public.detailers add constraint detailers_handle_reserved
  check (handle not in ('api', 'app', 'admin', 'login', 'signup', 'settings', 'pricing', 'privacy', 'terms',
                        'support', 'help', 'delete-account', 'about', 'blog', 'pro', 'book', 'auth', 'webhooks',
                        'www', 'beadup', 'stripe', 'connect', 'billing', 'account', 'dashboard', 'legal'));

-- ---------------------------------------------------------------------------
-- Connect accounts
-- ---------------------------------------------------------------------------
create function public.set_stripe_account(p_detailer_id uuid, p_account_id text)
returns void language plpgsql volatile security definer set search_path = '' as $$
begin
  insert into public.detailer_accounts (detailer_id, stripe_account_id)
  values (p_detailer_id, p_account_id)
  on conflict (detailer_id) do update set stripe_account_id = coalesce(public.detailer_accounts.stripe_account_id, excluded.stripe_account_id);
  insert into public.audit_log (detailer_id, actor, event, data)
  values (p_detailer_id, p_detailer_id::text, 'stripe.account_linked', jsonb_build_object('account', p_account_id));
end $$;

-- Payment context for a fresh booking hold: the connected account to charge.
create function public.checkout_context(p_booking_id uuid)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'bookingId', b.id, 'handle', d.handle, 'businessName', d.business_name, 'serviceName', b.service_name,
    'depositCents', b.deposit_cents, 'bookingFeeCents', b.booking_fee_cents,
    'stripeAccountId', a.stripe_account_id, 'chargesEnabled', coalesce(a.charges_enabled, false))
  from public.bookings b
  join public.detailers d on d.id = b.detailer_id
  left join public.detailer_accounts a on a.detailer_id = d.id
  where b.id = p_booking_id and b.status = 'pending_payment';
$$;

create function public.attach_checkout_session(p_booking_id uuid, p_session_id text, p_account_id text)
returns void language sql volatile security definer set search_path = '' as $$
  insert into public.payments (detailer_id, booking_id, kind, status, amount_cents, booking_fee_cents,
                               stripe_checkout_session_id, stripe_account_id)
  select b.detailer_id, b.id, 'deposit', 'pending', b.deposit_cents, b.booking_fee_cents, p_session_id, p_account_id
  from public.bookings b where b.id = p_booking_id;
$$;

-- What the "You're booked" page may show. Requires the Checkout session id,
-- which only the paying browser has, so booking ids cannot be enumerated.
create function public.booking_receipt(p_booking_id uuid, p_session_id text)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'bookingId', b.id, 'status', b.status, 'paymentStatus', p.status,
    'businessName', d.business_name, 'serviceName', b.service_name, 'timezone', d.timezone,
    'startsAt', b.starts_at, 'paidCents', b.deposit_cents + b.booking_fee_cents,
    'stripeAccountId', p.stripe_account_id)
  from public.payments p
  join public.bookings b on b.id = p.booking_id
  join public.detailers d on d.id = b.detailer_id
  where p.booking_id = p_booking_id and p.stripe_checkout_session_id = p_session_id;
$$;

-- ---------------------------------------------------------------------------
-- Webhook events. Idempotency and effects commit in one transaction.
-- Returns: 'duplicate' | 'ignored' | 'applied' | 'refund_needed'
-- ---------------------------------------------------------------------------
create function public.apply_stripe_event(p_event_id text, p_type text, p_account_id text, p_object jsonb)
returns text language plpgsql volatile security definer set search_path = '' as $$
declare
  v_payment public.payments%rowtype;
  v_inserted integer;
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
      update public.bookings set status = 'cancelled' where id = v_payment.booking_id and status = 'pending_payment';
      insert into public.audit_log (detailer_id, actor, event, data)
      values (v_payment.detailer_id, 'stripe', 'payment.failed', jsonb_build_object('booking_id', v_payment.booking_id, 'event', p_event_id));
      return 'applied';
    end if;

    if p_object ->> 'payment_status' <> 'paid' then return 'ignored'; end if; -- async methods settle later

    update public.payments set status = 'succeeded', stripe_payment_intent_id = p_object ->> 'payment_intent'
     where id = v_payment.id;
    insert into public.audit_log (detailer_id, actor, event, data)
    values (v_payment.detailer_id, 'stripe', 'payment.succeeded',
            jsonb_build_object('booking_id', v_payment.booking_id, 'amount_cents', v_payment.amount_cents, 'event', p_event_id));

    begin
      -- A late payment for an expired hold re-confirms only if the slot is still free.
      update public.bookings set status = 'confirmed'
       where id = v_payment.booking_id and status in ('pending_payment', 'cancelled');
    exception when unique_violation then
      insert into public.audit_log (detailer_id, actor, event, data)
      values (v_payment.detailer_id, 'stripe', 'payment.slot_lost', jsonb_build_object('booking_id', v_payment.booking_id));
      return 'refund_needed';
    end;
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

-- Lets the webhook retry an event whose follow-up (a refund) failed.
create function public.forget_stripe_event(p_event_id text)
returns void language sql volatile security definer set search_path = '' as $$
  delete from public.processed_events where id = p_event_id and source = 'stripe';
$$;

-- ---------------------------------------------------------------------------
-- Cancellation policy (shown to clients at checkout):
--   * detailer cancels: full refund, deposit and booking fee
--   * client cancels 24h or more before the start: deposit refunded,
--     booking fee kept (it paid the card processing)
--   * client cancels later than that: no refund
-- Returns what to refund; the caller issues the Stripe refund.
-- ---------------------------------------------------------------------------
create function public.cancel_booking(p_booking_id uuid, p_by text, p_detailer_id uuid default null)
returns jsonb language plpgsql volatile security definer set search_path = '' as $$
declare
  b public.bookings%rowtype;
  p public.payments%rowtype;
  v_refund integer := 0;
begin
  if p_by not in ('detailer', 'client') then raise exception 'bad actor'; end if;
  select * into b from public.bookings where id = p_booking_id for update;
  if not found or (p_by = 'detailer' and b.detailer_id is distinct from p_detailer_id) then
    return jsonb_build_object('ok', false, 'error', 'not_found');
  end if;
  if b.status not in ('pending_payment', 'confirmed') then
    return jsonb_build_object('ok', false, 'error', 'not_cancellable');
  end if;

  select * into p from public.payments
   where booking_id = b.id and kind = 'deposit' and status = 'succeeded' order by created_at desc limit 1;
  if found then
    if p_by = 'detailer' then
      v_refund := p.amount_cents + p.booking_fee_cents;
    elsif b.starts_at - now() >= interval '24 hours' then
      v_refund := p.amount_cents;
    end if;
  end if;

  update public.bookings set status = 'cancelled' where id = b.id;
  insert into public.audit_log (detailer_id, actor, event, data)
  values (b.detailer_id, p_by, 'booking.cancelled', jsonb_build_object('booking_id', b.id, 'refund_cents', v_refund));

  return jsonb_build_object('ok', true, 'refundCents', v_refund,
                            'paymentIntentId', p.stripe_payment_intent_id, 'stripeAccountId', p.stripe_account_id);
end $$;

-- ---------------------------------------------------------------------------
revoke execute on function
  public.set_stripe_account(uuid, text), public.checkout_context(uuid), public.attach_checkout_session(uuid, text, text),
  public.booking_receipt(uuid, text), public.apply_stripe_event(text, text, text, jsonb),
  public.forget_stripe_event(text), public.cancel_booking(uuid, text, uuid)
  from public, anon, authenticated;
grant execute on function
  public.set_stripe_account(uuid, text), public.checkout_context(uuid), public.attach_checkout_session(uuid, text, text),
  public.booking_receipt(uuid, text), public.apply_stripe_event(text, text, text, jsonb),
  public.forget_stripe_event(text), public.cancel_booking(uuid, text, uuid)
  to service_role;
