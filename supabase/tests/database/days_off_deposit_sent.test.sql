-- Days off, public contact phone, and the client's "I've sent the deposit".
begin;
create extension if not exists pgtap with schema extensions;
select plan(22);
update public.plan_config set value = '"external"' where key = 'payments_mode';

insert into auth.users (instance_id, id, aud, role, email, encrypted_password, created_at, updated_at) values
  ('00000000-0000-0000-0000-000000000000', 'f1f1f1f1-0000-4000-8000-000000000000', 'authenticated', 'authenticated', 'f1@test.local', '', now(), now()),
  ('00000000-0000-0000-0000-000000000000', 'f2f2f2f2-0000-4000-8000-000000000000', 'authenticated', 'authenticated', 'f2@test.local', '', now(), now());
insert into public.detailers (id, handle, business_name, timezone, is_published) values
  ('f1f1f1f1-0000-4000-8000-000000000000', 'test-f1', 'F1 Detail', 'UTC', true),
  ('f2f2f2f2-0000-4000-8000-000000000000', 'test-f2', 'F2 Detail', 'UTC', true);
insert into public.detailer_accounts (detailer_id, plan) values ('f1f1f1f1-0000-4000-8000-000000000000', 'pro');
insert into public.services (id, detailer_id, name, duration_min, price_sedan_cents, price_suv_cents, price_truck_cents) values
  ('f1f1f1f1-0000-4000-8000-00000000000a', 'f1f1f1f1-0000-4000-8000-000000000000', 'Wash', 60, 10000, 10000, 10000);
insert into public.availability_slots (detailer_id, weekday, start_time)
select 'f1f1f1f1-0000-4000-8000-000000000000', wd, '10:00' from generate_series(0, 6) wd;
insert into public.days_off (detailer_id, day) values
  ('f1f1f1f1-0000-4000-8000-000000000000', current_date + 5),
  ('f2f2f2f2-0000-4000-8000-000000000000', current_date + 6);

-- ---------------------------------------------------------------------------
-- Days off: the detailer manages only their own.
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"f1f1f1f1-0000-4000-8000-000000000000","role":"authenticated"}', true);
select results_eq('select day from public.days_off', $$ values (current_date + 5) $$, 'F1 sees only own days off');
select lives_ok($$ insert into public.days_off (detailer_id, day) values ('f1f1f1f1-0000-4000-8000-000000000000', current_date + 9) $$,
  'F1 adds a day off');
select throws_ok($$ insert into public.days_off (detailer_id, day) values ('f2f2f2f2-0000-4000-8000-000000000000', current_date + 9) $$,
  '42501', null, 'F1 cannot add a day off for F2');
select is_empty($$ delete from public.days_off where detailer_id = 'f2f2f2f2-0000-4000-8000-000000000000' returning day $$,
  'F1 cannot delete F2''s days off');

-- Contact phone: E.164 only.
select throws_ok($$ update public.detailers set contact_phone = '512-555-0101' $$, '23514', null, 'contact phone must be E.164');
select lives_ok($$ update public.detailers set contact_phone = '+15125550101' $$, 'contact phone saved');
select lives_ok($$ update public.detailers set buffer_min = 30 $$, 'detailer sets own travel buffer');

reset role;
set local role anon;
select throws_ok('select * from public.days_off', '42501', null, 'anon cannot read days off');
select is(public.get_booking_page('test-f1') -> 'daysOff',
          jsonb_build_array(to_char(current_date + 5, 'YYYY-MM-DD'), to_char(current_date + 9, 'YYYY-MM-DD')),
          'page lists upcoming days off');
select is(public.get_booking_page('test-f1') ->> 'contactPhone', '+15125550101', 'page shows the contact phone');

-- The server refuses a day off.
reset role;
set local role service_role;
select is(public.create_booking('test-f1', 'f1f1f1f1-0000-4000-8000-00000000000a', 'sedan', '{}', current_date + 5, '10:00',
          'Ann', '+15125550111', '1 Main St', false, null) ->> 'error', 'slot_unavailable', 'no booking on a day off');

-- ---------------------------------------------------------------------------
-- "I've sent the deposit".
create temporary table bk on commit drop as
select public.create_booking('test-f1', 'f1f1f1f1-0000-4000-8000-00000000000a', 'sedan', '{}', current_date + 4, '10:00',
       'Ann', '+15125550111', '1 Main St', false, null) as r;
select ok((select (r ->> 'clientToken') ~ '^[0-9a-f]{48}$' from bk), 'booking returns a client token');

select is(public.report_deposit_sent((select (r ->> 'bookingId')::uuid from bk), repeat('0', 48)) ->> 'error',
          'not_found', 'a wrong token is refused');
select is(public.report_deposit_sent((select (r ->> 'bookingId')::uuid from bk), (select r ->> 'clientToken' from bk)),
          '{"ok": true, "first": true}'::jsonb, 'the client reports the deposit sent');
select is(public.report_deposit_sent((select (r ->> 'bookingId')::uuid from bk), (select r ->> 'clientToken' from bk)),
          '{"ok": true, "first": false}'::jsonb, 'a second report is a no-op (no second alert)');
reset role;
select ok((select deposit_reported_at is not null and deposit_received_at is null from public.bookings
            where id = (select (r ->> 'bookingId')::uuid from bk)),
          'reported, but NOT marked received: only the detailer confirms');
select is((select count(*)::int from public.audit_log where event = 'deposit.reported' and detailer_id = 'f1f1f1f1-0000-4000-8000-000000000000'), 1, 'report is audited once');

-- Only the server may call it; the detailer app can't read the token.
set local role anon;
select throws_ok($$ select public.report_deposit_sent(gen_random_uuid(), 'x') $$, '42501', null, 'anon cannot call report_deposit_sent');
reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"f1f1f1f1-0000-4000-8000-000000000000","role":"authenticated"}', true);
select throws_ok($$ select client_token from public.bookings $$, '42501', null, 'detailer app cannot read client tokens');
select is((select deposit_reported_at is not null from public.bookings limit 1), true, 'detailer sees the report');
select throws_ok($$ select public.report_deposit_sent(gen_random_uuid(), 'x') $$, '42501', null, 'detailer cannot call it either');
reset role;

-- A cancelled booking can't be reported.
update public.bookings set status = 'cancelled', deposit_reported_at = null where id = (select (r ->> 'bookingId')::uuid from bk);
set local role service_role;
select is(public.report_deposit_sent((select (r ->> 'bookingId')::uuid from bk), (select r ->> 'clientToken' from bk)) ->> 'error',
          'status', 'cancelled booking: refused');
reset role;

select * from finish();
rollback;
