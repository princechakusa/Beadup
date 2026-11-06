-- Tenant isolation tests (rules.md section 7). Run: npx supabase test db
begin;
create extension if not exists pgtap with schema extensions;
select plan(45);

-- Two detailers, A and B, each with a service, add-on, client and booking.
insert into auth.users (instance_id, id, aud, role, email, encrypted_password, created_at, updated_at)
values
  ('00000000-0000-0000-0000-000000000000', 'aaaaaaaa-0000-4000-8000-000000000000', 'authenticated', 'authenticated', 'a@test.local', '', now(), now()),
  ('00000000-0000-0000-0000-000000000000', 'bbbbbbbb-0000-4000-8000-000000000000', 'authenticated', 'authenticated', 'b@test.local', '', now(), now());

insert into public.detailers (id, handle, business_name, is_published) values
  ('aaaaaaaa-0000-4000-8000-000000000000', 'test-a', 'A Detail', true),
  ('bbbbbbbb-0000-4000-8000-000000000000', 'test-b', 'B Detail', false);
insert into public.detailer_accounts (detailer_id, stripe_account_id) values
  ('aaaaaaaa-0000-4000-8000-000000000000', 'acct_secret_a'),
  ('bbbbbbbb-0000-4000-8000-000000000000', 'acct_secret_b');
insert into public.services (id, detailer_id, name, duration_min, price_sedan_cents, price_suv_cents, price_truck_cents) values
  ('aaaaaaaa-0000-4000-8000-00000000000a', 'aaaaaaaa-0000-4000-8000-000000000000', 'A wash', 60, 100, 100, 100),
  ('bbbbbbbb-0000-4000-8000-00000000000b', 'bbbbbbbb-0000-4000-8000-000000000000', 'B wash', 60, 100, 100, 100);
insert into public.add_ons (detailer_id, name, price_cents) values
  ('aaaaaaaa-0000-4000-8000-000000000000', 'A wax', 100),
  ('bbbbbbbb-0000-4000-8000-000000000000', 'B wax', 100);
insert into public.clients (id, detailer_id, name, phone) values
  ('aaaaaaaa-0000-4000-8000-0000000000c1', 'aaaaaaaa-0000-4000-8000-000000000000', 'Client of A', '+15125550001'),
  ('bbbbbbbb-0000-4000-8000-0000000000c1', 'bbbbbbbb-0000-4000-8000-000000000000', 'Client of B', '+15125550002');
insert into public.bookings (id, detailer_id, client_id, service_name, vehicle_size, starts_at, duration_min, address,
                             subtotal_cents, deposit_cents, status) values
  ('aaaaaaaa-0000-4000-8000-0000000000b1', 'aaaaaaaa-0000-4000-8000-000000000000', 'aaaaaaaa-0000-4000-8000-0000000000c1',
   'A wash', 'sedan', now() - interval '1 day', 60, 'A street', 10000, 3000, 'completed'),
  ('bbbbbbbb-0000-4000-8000-0000000000b1', 'bbbbbbbb-0000-4000-8000-000000000000', 'bbbbbbbb-0000-4000-8000-0000000000c1',
   'B wash', 'sedan', now() - interval '1 day', 60, 'B street', 10000, 3000, 'completed');
insert into public.reviews (detailer_id, booking_id, rating) values
  ('aaaaaaaa-0000-4000-8000-000000000000', 'aaaaaaaa-0000-4000-8000-0000000000b1', 5),
  ('bbbbbbbb-0000-4000-8000-000000000000', 'bbbbbbbb-0000-4000-8000-0000000000b1', 1);
insert into public.payments (detailer_id, booking_id, kind, status, amount_cents) values
  ('aaaaaaaa-0000-4000-8000-000000000000', 'aaaaaaaa-0000-4000-8000-0000000000b1', 'deposit', 'succeeded', 3000),
  ('bbbbbbbb-0000-4000-8000-000000000000', 'bbbbbbbb-0000-4000-8000-0000000000b1', 'deposit', 'succeeded', 3001);
insert into public.quotes (detailer_id, total_cents) values
  ('aaaaaaaa-0000-4000-8000-000000000000', 111),
  ('bbbbbbbb-0000-4000-8000-000000000000', 222);
insert into public.processed_events (id, source) values ('evt_test', 'stripe');
insert into public.audit_log (detailer_id, actor, event) values
  ('aaaaaaaa-0000-4000-8000-000000000000', 'system', 'test'),
  ('bbbbbbbb-0000-4000-8000-000000000000', 'system', 'test');

-- ---------------------------------------------------------------------------
-- 1. Every public table has RLS on.
-- ---------------------------------------------------------------------------
select is_empty(
  $$ select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity $$,
  'RLS is enabled on every public table');

-- ---------------------------------------------------------------------------
-- 2. anon has no table access at all.
-- ---------------------------------------------------------------------------
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);

select throws_ok('select * from public.detailers', '42501', null, 'anon cannot read detailers');
select throws_ok('select * from public.detailer_accounts', '42501', null, 'anon cannot read detailer_accounts');
select throws_ok('select * from public.services', '42501', null, 'anon cannot read services');
select throws_ok('select * from public.clients', '42501', null, 'anon cannot read clients');
select throws_ok('select * from public.bookings', '42501', null, 'anon cannot read bookings');
select throws_ok('select * from public.reviews', '42501', null, 'anon cannot read reviews');
select throws_ok('select * from public.audit_log', '42501', null, 'anon cannot read audit_log');
select throws_ok('select * from public.payments', '42501', null, 'anon cannot read payments');
select throws_ok('select * from public.quotes', '42501', null, 'anon cannot read quotes');
select throws_ok('select * from public.processed_events', '42501', null, 'anon cannot read processed_events');
select throws_ok(
  $$ insert into public.bookings (detailer_id, client_id, service_name, vehicle_size, starts_at, duration_min, address, subtotal_cents, deposit_cents)
     values ('aaaaaaaa-0000-4000-8000-000000000000', 'aaaaaaaa-0000-4000-8000-0000000000c1', 'x', 'sedan', now(), 60, 'x', 0, 0) $$,
  '42501', null, 'anon cannot insert bookings directly');

-- Public page function: published only, public fields only.
select is((public.get_booking_page('test-a') ->> 'businessName'), 'A Detail', 'anon can load a published booking page');
select is((public.get_booking_page('TEST-A') ->> 'handle'), 'test-a', 'handle lookup is case-insensitive');
select is(public.get_booking_page('test-b'), null, 'unpublished detailer is hidden');
select is(public.get_booking_page('nobody-here'), null, 'unknown handle returns null');
select ok(public.booking_page_exists('Test-A'), 'exists check finds a published detailer');
select ok(not public.booking_page_exists('test-b'), 'exists check hides an unpublished detailer');
select ok(not public.booking_page_exists('nobody-here'), 'exists check rejects an unknown handle');
select is((public.get_booking_page('test-a') ->> 'rating')::float8, 5.0::float8, 'rating is computed from reviews');
select ok(
  public.get_booking_page('test-a')::text !~* '(acct_secret|Client of|\+1512|A street)',
  'booking page leaks no payout ids, clients, phones or addresses');

-- ---------------------------------------------------------------------------
-- 3. Detailer A sees and changes only A's rows.
-- ---------------------------------------------------------------------------
reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-4000-8000-000000000000","role":"authenticated"}', true);

select results_eq('select handle from public.detailers', $$ values ('test-a') $$, 'A sees only own profile');
select results_eq('select name from public.services', $$ values ('A wash') $$, 'A sees only own services');
select results_eq('select name from public.add_ons', $$ values ('A wax') $$, 'A sees only own add-ons');
select results_eq('select name from public.clients', $$ values ('Client of A') $$, 'A sees only own clients');
select results_eq('select address from public.bookings', $$ values ('A street') $$, 'A sees only own bookings');
select results_eq('select rating::int from public.reviews', $$ values (5) $$, 'A sees only own reviews');
select results_eq('select stripe_account_id from public.detailer_accounts', $$ values ('acct_secret_a') $$, 'A sees only own account');
select results_eq('select count(*)::int from public.audit_log', $$ values (1) $$, 'A sees only own audit log');
select results_eq('select amount_cents from public.payments', $$ values (3000) $$, 'A sees only own payments');
select results_eq('select total_cents from public.quotes', $$ values (111) $$, 'A sees only own quotes');
select throws_ok('select * from public.processed_events', '42501', null, 'A cannot read processed_events');
select throws_ok(
  $$ insert into public.payments (detailer_id, booking_id, kind, amount_cents)
     values ('aaaaaaaa-0000-4000-8000-000000000000', 'aaaaaaaa-0000-4000-8000-0000000000b1', 'deposit', 1) $$,
  '42501', null, 'A cannot record payments');
select throws_ok(
  $$ insert into public.quotes (detailer_id, ai_suggestion) values ('aaaaaaaa-0000-4000-8000-000000000000', '{}') $$,
  '42501', null, 'A cannot plant an AI suggestion');
select throws_ok(
  $$ insert into public.quotes (detailer_id, total_cents) values ('bbbbbbbb-0000-4000-8000-000000000000', 1) $$,
  '42501', null, 'A cannot create a quote for B');

select throws_ok(
  $$ insert into public.services (detailer_id, name, duration_min, price_sedan_cents, price_suv_cents, price_truck_cents)
     values ('bbbbbbbb-0000-4000-8000-000000000000', 'planted', 60, 1, 1, 1) $$,
  '42501', null, 'A cannot create a service for B');
select is_empty(
  $$ update public.clients set name = 'hacked' where detailer_id = 'bbbbbbbb-0000-4000-8000-000000000000' returning id $$,
  'A cannot update B''s clients');
select is_empty(
  $$ delete from public.services where detailer_id = 'bbbbbbbb-0000-4000-8000-000000000000' returning id $$,
  'A cannot delete B''s services');
select is_empty(
  $$ update public.detailers set business_name = 'hacked' where handle = 'test-b' returning id $$,
  'A cannot edit B''s profile');

-- Server-only columns and tables.
select throws_ok(
  $$ update public.bookings set deposit_cents = 0 where id = 'aaaaaaaa-0000-4000-8000-0000000000b1' $$,
  '42501', null, 'A cannot change money on own bookings');
select throws_ok(
  $$ update public.detailer_accounts set plan = 'pro' $$,
  '42501', null, 'A cannot grant themselves Pro');
select throws_ok(
  $$ update public.clients set sms_consent = true where id = 'aaaaaaaa-0000-4000-8000-0000000000c1' $$,
  '42501', null, 'A cannot forge SMS consent');
select throws_ok(
  $$ insert into public.reviews (detailer_id, booking_id, rating) values ('aaaaaaaa-0000-4000-8000-000000000000', 'aaaaaaaa-0000-4000-8000-0000000000b1', 5) $$,
  '42501', null, 'A cannot write reviews');
select throws_ok(
  $$ delete from public.audit_log $$,
  '42501', null, 'A cannot delete audit log');

-- ---------------------------------------------------------------------------
-- 4. Even the service role cannot link a booking to another tenant's client.
-- ---------------------------------------------------------------------------
reset role;
select throws_ok(
  $$ insert into public.bookings (detailer_id, client_id, service_name, vehicle_size, starts_at, duration_min, address, subtotal_cents, deposit_cents)
     values ('aaaaaaaa-0000-4000-8000-000000000000', 'bbbbbbbb-0000-4000-8000-0000000000c1', 'x', 'sedan', now(), 60, 'x', 0, 0) $$,
  '23503', null, 'a booking cannot reference another detailer''s client');

select * from finish();
rollback;
