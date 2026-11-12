-- External payments mode (owner decision 2026-11-07): the client pays the
-- deposit to the detailer directly. Run: npx supabase test db
begin;
create extension if not exists pgtap with schema extensions;
select plan(12);

insert into auth.users (instance_id, id, aud, role, email, encrypted_password, created_at, updated_at) values
  ('00000000-0000-0000-0000-000000000000', 'eeeeeeee-0000-4000-8000-000000000000', 'authenticated', 'authenticated', 'e@test.local', '', now(), now()),
  ('00000000-0000-0000-0000-000000000000', 'eeeeeeee-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'e2@test.local', '', now(), now());
insert into public.detailers (id, handle, business_name, timezone, is_published) values
  ('eeeeeeee-0000-4000-8000-000000000000', 'test-e', 'E Detail', 'America/Chicago', true),
  ('eeeeeeee-0000-4000-8000-000000000001', 'test-e2', 'E2 Detail', 'America/Chicago', true);
insert into public.services (id, detailer_id, name, duration_min, price_sedan_cents, price_suv_cents, price_truck_cents) values
  ('eeeeeeee-0000-4000-8000-00000000000a', 'eeeeeeee-0000-4000-8000-000000000000', 'E wash', 60, 10000, 12000, 14000);
insert into public.availability_slots (detailer_id, weekday, start_time)
select 'eeeeeeee-0000-4000-8000-000000000000', wd, '10:00' from generate_series(0, 6) wd;

select is(public.payments_mode(), 'external', 'launch default is external payments');

-- Bookings are confirmed at once, with the deposit and no booking fee.
set local role service_role;
select is(
  (select r - 'bookingId' - 'startsAt' - 'clientToken' - 'staffId' from public.create_booking('test-e', 'eeeeeeee-0000-4000-8000-00000000000a', 'sedan', '{}',
     current_date + 3, '10:00', 'Pat', '+15125550199', '1 Main St, Austin', false, null) r),
  '{"ok": true, "payments": "external", "depositCents": 3000, "subtotalCents": 10000, "bookingFeeCents": 0}'::jsonb,
  'external booking: 30% deposit, no booking fee');
select is((select status::text from public.bookings where detailer_id = 'eeeeeeee-0000-4000-8000-000000000000'),
          'confirmed', 'external booking is confirmed straight away');
select is((select public.create_booking('test-e', 'eeeeeeee-0000-4000-8000-00000000000a', 'suv', '{}',
             current_date + 3, '10:00', 'Sam', '+15125550198', '2 Main St, Austin', false, null) ->> 'error'),
          'slot_taken', 'a confirmed external booking holds its slot');
reset role;

-- Detailers set their own link and note; only https links are accepted.
set local role authenticated;
set local request.jwt.claims = '{"sub": "eeeeeeee-0000-4000-8000-000000000000", "role": "authenticated"}';
select lives_ok(
  $$ update public.detailers set payment_link = 'https://square.link/u/abc123', payment_note = 'Zelle: 512-555-0101'
     where id = 'eeeeeeee-0000-4000-8000-000000000000' $$,
  'a detailer can set their payment link and note');
select throws_ok(
  $$ update public.detailers set payment_link = 'javascript:alert(1)' where id = 'eeeeeeee-0000-4000-8000-000000000000' $$,
  '23514', null, 'non-https links are rejected');
select throws_ok(
  $$ update public.detailers set payment_link = 'http://example.com/pay' where id = 'eeeeeeee-0000-4000-8000-000000000000' $$,
  '23514', null, 'plain http links are rejected');
select throws_ok(
  $$ update public.detailers set payment_note = repeat('x', 201) where id = 'eeeeeeee-0000-4000-8000-000000000000' $$,
  '23514', null, 'payment note is capped at 200 characters');
-- RLS: another detailer's row is untouched.
update public.detailers set payment_link = 'https://evil.example/pay' where id = 'eeeeeeee-0000-4000-8000-000000000001';
reset role;
select is((select payment_link from public.detailers where id = 'eeeeeeee-0000-4000-8000-000000000001'), null,
          'a detailer cannot set another detailer''s link');

-- The public page shows the mode, link and note.
set local role anon;
select is((select public.get_booking_page('test-e') ->> 'payments'), 'external', 'booking page shows the payment mode');
select is((select public.get_booking_page('test-e') ->> 'paymentLink'), 'https://square.link/u/abc123', 'booking page shows the link');
select is((select public.get_booking_page('test-e') ->> 'paymentNote'), 'Zelle: 512-555-0101', 'booking page shows the note');
reset role;

select * from finish();
rollback;
