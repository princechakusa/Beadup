-- Booking creation, pricing and rate limit tests. Run: npx supabase test db
begin;
create extension if not exists pgtap with schema extensions;
select plan(16);

insert into auth.users (instance_id, id, aud, role, email, encrypted_password, created_at, updated_at) values
  ('00000000-0000-0000-0000-000000000000', 'cccccccc-0000-4000-8000-000000000000', 'authenticated', 'authenticated', 'c@test.local', '', now(), now());
insert into public.detailers (id, handle, business_name, timezone, is_published) values
  ('cccccccc-0000-4000-8000-000000000000', 'test-c', 'C Detail', 'America/New_York', true);
insert into public.services (id, detailer_id, name, duration_min, price_sedan_cents, price_suv_cents, price_truck_cents) values
  ('cccccccc-0000-4000-8000-00000000000a', 'cccccccc-0000-4000-8000-000000000000', 'C wash', 60, 10000, 12000, 14000);
insert into public.add_ons (id, detailer_id, name, price_cents) values
  ('cccccccc-0000-4000-8000-0000000000a1', 'cccccccc-0000-4000-8000-000000000000', 'Wax', 2500);
-- Open every day at 10:00 so the test date is always valid.
insert into public.availability_slots (detailer_id, weekday, start_time)
select 'cccccccc-0000-4000-8000-000000000000', wd, '10:00' from generate_series(0, 6) wd;

-- Pricing matches apps/web/src/lib/pricing.ts.
select is(public.deposit_cents(21000), 6300, 'deposit is 30%');
select is(public.deposit_cents(5), 2, 'deposit rounds half up');
select is(public.booking_fee_cents(6300), 220, 'booking fee covers 2.9% + 30c');
select is(public.booking_fee_cents(0), 0, 'no fee on zero');
select is_empty(
  $$ select c from generate_series(1, 100000) c where public.booking_fee_cents(c) <> ceil((c + 30) / 0.971::numeric) - c $$,
  'integer fee formula equals exact ceiling');

-- Only the server (service_role) may create bookings.
set local role anon;
select throws_ok(
  $$ select public.create_booking('test-c', 'cccccccc-0000-4000-8000-00000000000a', 'sedan', '{}', current_date + 3, '10:00', 'X', '+15550000001', 'Somewhere 1', false, null) $$,
  '42501', null, 'anon cannot create bookings');
reset role;
set local role authenticated;
select throws_ok(
  $$ select public.hit_rate_limit('k', 1, 60) $$, '42501', null, 'authenticated cannot touch rate limits');
reset role;
set local role service_role;

create temp table r on commit drop as
select public.create_booking('test-c', 'cccccccc-0000-4000-8000-00000000000a', 'suv',
  array['cccccccc-0000-4000-8000-0000000000a1']::uuid[], current_date + 3, '10:00',
  'Pat', '+15550000001', '1 Test Road', true, 'consent words') as j;

select is((select j ->> 'ok' from r), 'true', 'booking is created');
select is((select (j ->> 'subtotalCents')::int from r), 14500, 'subtotal uses size price plus add-ons from the database');
select is((select starts_at from public.bookings where id = (select (j ->> 'bookingId')::uuid from r)),
          ((current_date + 3) + time '10:00') at time zone 'America/New_York', 'start time uses the detailer timezone');
select is((select sms_consent_text from public.clients where phone = '+15550000001'), 'consent words', 'consent text is recorded');

select is(public.create_booking('test-c', 'cccccccc-0000-4000-8000-00000000000a', 'sedan', '{}', current_date + 3, '10:00',
          'Sam', '+15550000002', '2 Test Road', false, null) ->> 'error', 'slot_taken', 'double booking is refused');
select is(public.create_booking('test-c', 'cccccccc-0000-4000-8000-00000000000a', 'sedan', '{}', current_date + 3, '11:00',
          'Sam', '+15550000002', '2 Test Road', false, null) ->> 'error', 'slot_unavailable', 'times outside availability are refused');
select is(public.create_booking('test-c', 'cccccccc-0000-4000-8000-00000000000a', 'sedan',
          array['bbbbbbbb-0000-4000-8000-0000000000a1']::uuid[], current_date + 4, '10:00',
          'Sam', '+15550000002', '2 Test Road', false, null) ->> 'error', 'add_on', 'foreign add-ons are refused');

-- Stale unpaid holds release the slot.
reset role;
update public.bookings set created_at = now() - interval '31 minutes' where detailer_id = 'cccccccc-0000-4000-8000-000000000000';
set local role service_role;
select is(public.create_booking('test-c', 'cccccccc-0000-4000-8000-00000000000a', 'sedan', '{}', current_date + 3, '10:00',
          'Sam', '+15550000002', '2 Test Road', false, null) ->> 'ok', 'true', 'a stale hold is released');

select is(array[public.hit_rate_limit('t', 2, 600), public.hit_rate_limit('t', 2, 600), public.hit_rate_limit('t', 2, 600)],
          array[true, true, false], 'rate limit blocks after the limit');

select * from finish();
rollback;
