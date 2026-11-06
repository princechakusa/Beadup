-- Balance payments and the customer text outbox. Run: npx supabase test db
begin;
create extension if not exists pgtap with schema extensions;
select plan(17);

insert into auth.users (instance_id, id, aud, role, email, encrypted_password, created_at, updated_at) values
  ('00000000-0000-0000-0000-000000000000', 'eeeeeeee-0000-4000-8000-000000000000', 'authenticated', 'authenticated', 'e@test.local', '', now(), now()),
  ('00000000-0000-0000-0000-000000000000', 'ffffffff-0000-4000-8000-000000000000', 'authenticated', 'authenticated', 'f@test.local', '', now(), now());
insert into public.detailers (id, handle, business_name, is_published) values
  ('eeeeeeee-0000-4000-8000-000000000000', 'test-e', 'E Detail', true),
  ('ffffffff-0000-4000-8000-000000000000', 'test-f', 'F Detail', true);
insert into public.detailer_accounts (detailer_id, stripe_account_id, charges_enabled) values
  ('eeeeeeee-0000-4000-8000-000000000000', 'acct_e', true);
insert into public.clients (id, detailer_id, name, phone, sms_consent, sms_consent_at, sms_consent_text) values
  ('eeeeeeee-0000-4000-8000-0000000000c1', 'eeeeeeee-0000-4000-8000-000000000000', 'Texts OK', '+15550000201', true, now(), 'consent'),
  ('eeeeeeee-0000-4000-8000-0000000000c2', 'eeeeeeee-0000-4000-8000-000000000000', 'No texts', '+15550000202', false, null, null);
insert into public.bookings (id, detailer_id, client_id, service_name, vehicle_size, starts_at, duration_min, address,
                             subtotal_cents, deposit_cents, booking_fee_cents, status) values
  ('eeeeeeee-0000-4000-8000-0000000000b1', 'eeeeeeee-0000-4000-8000-000000000000', 'eeeeeeee-0000-4000-8000-0000000000c1',
   'Wash', 'sedan', now() + interval '3 days', 60, 'Addr', 10000, 3000, 124, 'pending_payment'),
  ('eeeeeeee-0000-4000-8000-0000000000b2', 'eeeeeeee-0000-4000-8000-000000000000', 'eeeeeeee-0000-4000-8000-0000000000c2',
   'Wash', 'sedan', now() + interval '4 days', 60, 'Addr', 10000, 3000, 124, 'pending_payment');

-- Detailers see only their own messages; nobody can write them.
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"eeeeeeee-0000-4000-8000-000000000000","role":"authenticated"}', true);
select throws_ok($$ insert into public.messages (detailer_id, booking_id, client_id, kind)
                    values ('eeeeeeee-0000-4000-8000-000000000000', 'eeeeeeee-0000-4000-8000-0000000000b1',
                            'eeeeeeee-0000-4000-8000-0000000000c1', 'balance_link') $$,
                 '42501', null, 'detailers cannot write to the outbox');
select throws_ok($$ select public.balance_context('eeeeeeee-0000-4000-8000-0000000000b1', 'eeeeeeee-0000-4000-8000-000000000000') $$,
                 '42501', null, 'balance_context is server-only');
reset role;
set local role service_role;

-- Deposit paid: booking confirmed, email kept, confirmation text queued.
select public.attach_checkout_session('eeeeeeee-0000-4000-8000-0000000000b1', 'cs_e1', 'acct_e');
select is(public.apply_stripe_event('evt_e1', 'checkout.session.completed', 'acct_e',
          '{"id":"cs_e1","payment_status":"paid","payment_intent":"pi_e1","customer_details":{"email":"Pat@Example.com"}}'),
          'applied', 'deposit applied');
select is((select email from public.clients where id = 'eeeeeeee-0000-4000-8000-0000000000c1'), 'pat@example.com', 'client email saved, lowercased');
select is((select count(*)::int from public.messages where booking_id = 'eeeeeeee-0000-4000-8000-0000000000b1' and kind = 'booking_confirmed'),
          1, 'confirmation text queued');
select is(public.enqueue_message('eeeeeeee-0000-4000-8000-0000000000b1', 'booking_confirmed'), null, 'confirmation is queued only once');

-- A bad email from upstream never breaks the webhook.
select public.attach_checkout_session('eeeeeeee-0000-4000-8000-0000000000b2', 'cs_e2', 'acct_e');
select is(public.apply_stripe_event('evt_e2', 'checkout.session.completed', 'acct_e',
          '{"id":"cs_e2","payment_status":"paid","payment_intent":"pi_e2","customer_details":{"email":"not an email"}}'),
          'applied', 'invalid email is ignored, payment still applied');

-- Consent is enforced at send time.
select is((public.message_context((select id from public.messages where booking_id = 'eeeeeeee-0000-4000-8000-0000000000b1')) ->> 'canText')::boolean,
          true, 'consenting client can be texted');
select is((public.message_context((select id from public.messages where booking_id = 'eeeeeeee-0000-4000-8000-0000000000b2')) ->> 'canText')::boolean,
          false, 'client without consent cannot be texted');

-- Retry bookkeeping: failed sends re-queue until 5 attempts.
select public.mark_message((select id from public.messages where booking_id = 'eeeeeeee-0000-4000-8000-0000000000b1'), 'failed', 'body', null, 'twilio_500');
select is((select status::text from public.messages where booking_id = 'eeeeeeee-0000-4000-8000-0000000000b1'), 'queued', 'failed send is re-queued');

-- Balance.
select is(public.balance_context('eeeeeeee-0000-4000-8000-0000000000b1', 'ffffffff-0000-4000-8000-000000000000') ->> 'error',
          'not_found', 'another detailer cannot request the balance');
select is((public.balance_context('eeeeeeee-0000-4000-8000-0000000000b1', 'eeeeeeee-0000-4000-8000-000000000000') ->> 'balanceCents')::int,
          7000, 'balance is subtotal minus paid deposit');
select is((public.balance_context('eeeeeeee-0000-4000-8000-0000000000b1', 'eeeeeeee-0000-4000-8000-000000000000') ->> 'bookingFeeCents')::int,
          public.booking_fee_cents(7000), 'balance carries its own processing fee');
select public.attach_balance_session('eeeeeeee-0000-4000-8000-0000000000b1', 'cs_e1_bal', 'acct_e', 7000, public.booking_fee_cents(7000));
select is(public.apply_stripe_event('evt_e3', 'checkout.session.completed', 'acct_e',
          '{"id":"cs_e1_bal","payment_status":"paid","payment_intent":"pi_e3"}'), 'applied', 'balance payment applied');
select is((select status::text from public.bookings where id = 'eeeeeeee-0000-4000-8000-0000000000b1'), 'completed', 'paying the balance completes the job');
select is((select count(*)::int from public.messages where booking_id = 'eeeeeeee-0000-4000-8000-0000000000b1' and kind = 'balance_receipt'),
          1, 'balance receipt text queued');
select is(public.balance_context('eeeeeeee-0000-4000-8000-0000000000b1', 'eeeeeeee-0000-4000-8000-000000000000') ->> 'error',
          'paid_in_full', 'no second balance link once paid');

select * from finish();
rollback;
