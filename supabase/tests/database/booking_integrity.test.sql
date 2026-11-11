-- Overlap prevention, travel buffer, detailer status guard, reschedule.
begin;
create extension if not exists pgtap with schema extensions;
select plan(26);
update public.plan_config set value = '"external"' where key = 'payments_mode';

insert into auth.users (instance_id, id, aud, role, email, encrypted_password, created_at, updated_at) values
  ('00000000-0000-0000-0000-000000000000', 'e1e1e1e1-0000-4000-8000-000000000000', 'authenticated', 'authenticated', 'e1@test.local', '', now(), now()),
  ('00000000-0000-0000-0000-000000000000', 'e2e2e2e2-0000-4000-8000-000000000000', 'authenticated', 'authenticated', 'e2@test.local', '', now(), now());
insert into public.detailers (id, handle, business_name, timezone, is_published) values
  ('e1e1e1e1-0000-4000-8000-000000000000', 'test-e1', 'E1 Detail', 'UTC', true),
  ('e2e2e2e2-0000-4000-8000-000000000000', 'test-e2', 'E2 Detail', 'UTC', true);
insert into public.detailer_accounts (detailer_id, plan) values ('e1e1e1e1-0000-4000-8000-000000000000', 'pro');
insert into public.services (id, detailer_id, name, duration_min, price_sedan_cents, price_suv_cents, price_truck_cents) values
  ('e1e1e1e1-0000-4000-8000-00000000000a', 'e1e1e1e1-0000-4000-8000-000000000000', 'Ceramic', 360, 50000, 60000, 70000),
  ('e1e1e1e1-0000-4000-8000-00000000000b', 'e1e1e1e1-0000-4000-8000-000000000000', 'Wash', 60, 5000, 6000, 7000);
-- Every hour from 08:00 to 17:00, every day.
insert into public.availability_slots (detailer_id, weekday, start_time)
select 'e1e1e1e1-0000-4000-8000-000000000000', wd, make_time(h, 0, 0) from generate_series(0, 6) wd, generate_series(8, 17) h;

create temporary table d as select (current_date + 7) as day;
grant select on d to anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 1. Overlaps through the booking page.
set local role service_role;
select is(public.create_booking('test-e1', 'e1e1e1e1-0000-4000-8000-00000000000a', 'sedan', '{}', (select day from d), '08:00',
          'Ann', '+15125550101', '1 Main St', false, null) ->> 'ok', 'true', '6 h job at 08:00 books');
select is(public.create_booking('test-e1', 'e1e1e1e1-0000-4000-8000-00000000000a', 'sedan', '{}', (select day from d), '09:00',
          'Bob', '+15125550102', '2 Main St', false, null) ->> 'error', 'slot_taken', 'a job starting inside it is refused');
select is(public.create_booking('test-e1', 'e1e1e1e1-0000-4000-8000-00000000000b', 'sedan', '{}', (select day from d), '13:00',
          'Bob', '+15125550102', '2 Main St', false, null) ->> 'error', 'slot_taken', 'a short job in the last hour is refused');
select is(public.create_booking('test-e1', 'e1e1e1e1-0000-4000-8000-00000000000b', 'sedan', '{}', (select day from d), '14:00',
          'Bob', '+15125550102', '2 Main St', false, null) ->> 'ok', 'true', 'a job starting when it ends books');
select is((select count(*)::int from public.bookings where detailer_id = 'e1e1e1e1-0000-4000-8000-000000000000'), 2,
          'only the two non-overlapping bookings exist');

-- 2. Travel buffer.
reset role;
update public.detailers set buffer_min = 30 where id = 'e1e1e1e1-0000-4000-8000-000000000000';
set local role service_role;
select is(public.create_booking('test-e1', 'e1e1e1e1-0000-4000-8000-00000000000b', 'sedan', '{}', (select day from d), '15:00',
          'Cat', '+15125550103', '3 Main St', false, null) ->> 'error', 'slot_taken', 'no gap for the 30 min buffer: refused');
select is(public.create_booking('test-e1', 'e1e1e1e1-0000-4000-8000-00000000000b', 'sedan', '{}', (select day from d), '16:00',
          'Cat', '+15125550103', '3 Main St', false, null) ->> 'ok', 'true', 'a gap of an hour: books');

-- 3. Even the server can't insert an overlapping live booking directly.
reset role;
select throws_ok(
  $$ insert into public.bookings (detailer_id, client_id, service_name, vehicle_size, starts_at, duration_min, address,
                                  subtotal_cents, deposit_cents, status)
     select detailer_id, client_id, 'X', 'sedan', starts_at + interval '30 minutes', 60, 'x', 100, 30, 'confirmed'
     from public.bookings where detailer_id = 'e1e1e1e1-0000-4000-8000-000000000000' order by starts_at limit 1 $$,
  '23P01', null, 'direct overlapping insert is rejected');
select lives_ok(
  $$ insert into public.bookings (detailer_id, client_id, service_name, vehicle_size, starts_at, duration_min, address,
                                  subtotal_cents, deposit_cents, status)
     select detailer_id, client_id, 'X', 'sedan', starts_at + interval '30 minutes', 60, 'x', 100, 30, 'cancelled'
     from public.bookings where detailer_id = 'e1e1e1e1-0000-4000-8000-000000000000' order by starts_at limit 1 $$,
  'a cancelled booking may sit in a busy time');

-- 4. The booking page shows busy ranges and the buffer.
set local role anon;
select is(public.get_booking_page('test-e1') -> 'bufferMin', '30'::jsonb, 'page has the buffer');
select is(jsonb_array_length(public.get_booking_page('test-e1') -> 'busy'), 3, 'page lists the three live bookings');
select is(public.get_booking_page('test-e1') -> 'busy' -> 0,
          jsonb_build_object('start', to_char((select day from d), 'YYYY-MM-DD') || ' 08:00', 'minutes', 360),
          'busy range is local start + minutes, nothing about the client');

-- ---------------------------------------------------------------------------
-- 5. The detailer app: status guard and reschedule.
reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"e1e1e1e1-0000-4000-8000-000000000000","role":"authenticated"}', true);

select throws_ok(
  $$ update public.bookings set status = 'cancelled' where detailer_id = 'e1e1e1e1-0000-4000-8000-000000000000' and service_name = 'Wash' and starts_at::time = '14:00' $$,
  '42501', null, 'detailer cannot cancel by writing the status (must use cancel_booking)');
select throws_ok(
  $$ update public.bookings set status = 'confirmed' where service_name = 'X' $$,
  '42501', null, 'detailer cannot revive a cancelled booking');
select throws_ok(
  $$ update public.bookings set starts_at = starts_at + interval '1 day' where service_name = 'Wash' $$,
  '42501', null, 'detailer cannot move a booking without reschedule_booking');
select lives_ok(
  $$ update public.bookings set status = 'completed' where service_name = 'Wash' and starts_at::time = '16:00' $$,
  'detailer can mark a job done');
select lives_ok(
  $$ update public.bookings set status = 'confirmed' where service_name = 'Wash' and starts_at::time = '16:00' $$,
  'detailer can undo it');
select lives_ok(
  $$ update public.bookings set notes = 'Gate code 1234' where service_name = 'Ceramic' $$,
  'other edits still work');

select is(public.reschedule_booking(
            (select id from public.bookings where service_name = 'Wash' and starts_at::time = '14:00'),
            (select day from d) + time '10:00') ->> 'error',
          'overlap', 'reschedule into a busy time is refused');
select is(public.reschedule_booking(
            (select id from public.bookings where service_name = 'Wash' and starts_at::time = '14:00'),
            now() - interval '1 hour') ->> 'error',
          'time', 'reschedule into the past is refused');
select is(public.reschedule_booking(
            (select id from public.bookings where service_name = 'Wash' and starts_at::time = '14:00'),
            (select day from d) + 1 + time '09:00') ->> 'ok',
          'true', 'reschedule to a free time works');
select is((select count(*)::int from public.audit_log where event = 'booking.rescheduled' and detailer_id = 'e1e1e1e1-0000-4000-8000-000000000000'), 1, 'reschedule is audited');
select is(public.reschedule_booking(
            (select id from public.bookings where service_name = 'X'),
            (select day from d) + 2 + time '09:00') ->> 'error',
          'status', 'a cancelled booking cannot be rescheduled');

-- Another detailer can't reschedule E1's booking.
select set_config('request.jwt.claims', '{"sub":"e2e2e2e2-0000-4000-8000-000000000000","role":"authenticated"}', true);
select is(public.reschedule_booking(
            (select id from public.bookings b where b.detailer_id = 'e1e1e1e1-0000-4000-8000-000000000000' limit 1),
            (select day from d) + 3 + time '09:00') ->> 'error',
          'not_found', 'reschedule is owner-only');
reset role;
select is((select count(*)::int from public.bookings where detailer_id = 'e1e1e1e1-0000-4000-8000-000000000000'
            and starts_at::date = (select day from d) + 3), 0, 'and nothing moved');

-- anon can't call it at all.
set local role anon;
select throws_ok($$ select public.reschedule_booking(gen_random_uuid(), now()) $$, '42501', null, 'anon cannot reschedule');
reset role;

select * from finish();
rollback;
