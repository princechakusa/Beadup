-- Stripe event handling and cancellation policy. Run: npx supabase test db
begin;
create extension if not exists pgtap with schema extensions;
select plan(20);

insert into auth.users (instance_id, id, aud, role, email, encrypted_password, created_at, updated_at) values
  ('00000000-0000-0000-0000-000000000000', 'dddddddd-0000-4000-8000-000000000000', 'authenticated', 'authenticated', 'd@test.local', '', now(), now());
insert into public.detailers (id, handle, business_name, is_published) values
  ('dddddddd-0000-4000-8000-000000000000', 'test-d', 'D Detail', true);
insert into public.detailer_accounts (detailer_id, stripe_account_id) values ('dddddddd-0000-4000-8000-000000000000', 'acct_d');
insert into public.clients (id, detailer_id, name, phone) values
  ('dddddddd-0000-4000-8000-0000000000c1', 'dddddddd-0000-4000-8000-000000000000', 'Client', '+15550000101');
-- b1: far out, b2: tomorrow-ish (inside 24h), b3: same slot as b1 for the lost-slot case.
insert into public.bookings (id, detailer_id, client_id, service_name, vehicle_size, starts_at, duration_min, address,
                             subtotal_cents, deposit_cents, booking_fee_cents, status) values
  ('dddddddd-0000-4000-8000-0000000000b1', 'dddddddd-0000-4000-8000-000000000000', 'dddddddd-0000-4000-8000-0000000000c1',
   'Wash', 'sedan', date_trunc('hour', now()) + interval '5 days', 60, 'Addr', 10000, 3000, 124, 'pending_payment'),
  ('dddddddd-0000-4000-8000-0000000000b2', 'dddddddd-0000-4000-8000-000000000000', 'dddddddd-0000-4000-8000-0000000000c1',
   'Wash', 'sedan', date_trunc('hour', now()) + interval '6 hours', 60, 'Addr', 10000, 3000, 124, 'pending_payment');

set local role authenticated;
select throws_ok($$ select public.apply_stripe_event('evt_x', 'account.updated', null, '{}') $$, '42501', null,
                 'clients cannot apply Stripe events');
select throws_ok($$ select public.cancel_booking('dddddddd-0000-4000-8000-0000000000b1', 'client') $$, '42501', null,
                 'clients cannot call cancel_booking directly');
reset role;
set local role service_role;

select lives_ok($$ select public.attach_checkout_session('dddddddd-0000-4000-8000-0000000000b1', 'cs_1', 'acct_d') $$, 'checkout session attached');
select lives_ok($$ select public.attach_checkout_session('dddddddd-0000-4000-8000-0000000000b2', 'cs_2', 'acct_d') $$, 'second session attached');
select is(public.booking_receipt('dddddddd-0000-4000-8000-0000000000b1', 'cs_wrong'), null, 'receipt needs the matching session id');

-- Payment completes.
select is(public.apply_stripe_event('evt_1', 'checkout.session.completed', 'acct_d',
          '{"id":"cs_1","payment_status":"paid","payment_intent":"pi_1"}'), 'applied', 'completed checkout is applied');
select is((select status::text from public.bookings where id = 'dddddddd-0000-4000-8000-0000000000b1'), 'confirmed', 'booking is confirmed');
select is((select status::text from public.payments where stripe_checkout_session_id = 'cs_1'), 'succeeded', 'payment succeeded');
select is(public.apply_stripe_event('evt_1', 'checkout.session.completed', 'acct_d', '{"id":"cs_1","payment_status":"paid"}'),
          'duplicate', 'replayed event is ignored');
select is(public.apply_stripe_event('evt_spoof', 'checkout.session.completed', 'acct_other',
          '{"id":"cs_2","payment_status":"paid","payment_intent":"pi_x"}'), 'ignored', 'event from another account cannot confirm a booking');
select is((select (public.booking_receipt('dddddddd-0000-4000-8000-0000000000b1', 'cs_1')) ->> 'paymentStatus'), 'succeeded', 'receipt shows paid');

-- Expiry cancels an unpaid hold.
select is(public.apply_stripe_event('evt_2', 'checkout.session.expired', 'acct_d', '{"id":"cs_2"}'), 'applied', 'expiry applied');
select is((select status::text from public.bookings where id = 'dddddddd-0000-4000-8000-0000000000b2'), 'cancelled', 'expired hold is cancelled');

-- Account status sync.
select is(public.apply_stripe_event('evt_3', 'account.updated', 'acct_d',
          '{"id":"acct_d","charges_enabled":true,"payouts_enabled":true,"details_submitted":true}'), 'applied', 'account.updated applied');
select ok((select charges_enabled from public.detailer_accounts where stripe_account_id = 'acct_d'), 'charges_enabled synced');

-- Late payment for a slot someone else took: needs a refund.
reset role;
update public.bookings set status = 'cancelled' where id = 'dddddddd-0000-4000-8000-0000000000b1';
insert into public.bookings (detailer_id, client_id, service_name, vehicle_size, starts_at, duration_min, address,
                             subtotal_cents, deposit_cents, status)
select detailer_id, client_id, 'Wash', 'sedan', starts_at, 60, 'Other', 10000, 3000, 'confirmed'
from public.bookings where id = 'dddddddd-0000-4000-8000-0000000000b1';
update public.payments set status = 'pending' where stripe_checkout_session_id = 'cs_1';
set local role service_role;
select is(public.apply_stripe_event('evt_4', 'checkout.session.completed', 'acct_d',
          '{"id":"cs_1","payment_status":"paid","payment_intent":"pi_1"}'), 'refund_needed', 'lost slot asks for a refund');

-- Cancellation policy.
reset role;
update public.bookings set status = 'confirmed' where id in ('dddddddd-0000-4000-8000-0000000000b2');
update public.payments set status = 'succeeded', stripe_payment_intent_id = 'pi_2' where stripe_checkout_session_id = 'cs_2';
update public.bookings set starts_at = starts_at + interval '1 minute', status = 'confirmed' where id = 'dddddddd-0000-4000-8000-0000000000b1';
set local role service_role;
select is((public.cancel_booking('dddddddd-0000-4000-8000-0000000000b2', 'client') ->> 'refundCents')::int, 0,
          'client cancelling inside 24h gets no refund');
select is((public.cancel_booking('dddddddd-0000-4000-8000-0000000000b1', 'client') ->> 'refundCents')::int, 3000,
          'client cancelling 24h+ ahead gets the deposit back, not the fee');
reset role;
update public.bookings set status = 'confirmed' where id = 'dddddddd-0000-4000-8000-0000000000b1';
set local role service_role;
select is(public.cancel_booking('dddddddd-0000-4000-8000-0000000000b1', 'detailer', 'bbbbbbbb-0000-4000-8000-000000000000') ->> 'error',
          'not_found', 'a detailer cannot cancel another detailer''s booking');
select is((public.cancel_booking('dddddddd-0000-4000-8000-0000000000b1', 'detailer', 'dddddddd-0000-4000-8000-000000000000') ->> 'refundCents')::int,
          3124, 'detailer cancelling refunds deposit and booking fee');

select * from finish();
rollback;
