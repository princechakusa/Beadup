-- The client's booking page: token lookup, expiry, change requests, isolation.
begin;
create extension if not exists pgtap with schema extensions;
select plan(32);
update public.plan_config set value = '"external"' where key = 'payments_mode';

insert into auth.users (instance_id, id, aud, role, email, encrypted_password, created_at, updated_at) values
  ('00000000-0000-0000-0000-000000000000', 'a7a7a7a7-0000-4000-8000-000000000000', 'authenticated', 'authenticated', 'a7@test.local', '', now(), now()),
  ('00000000-0000-0000-0000-000000000000', 'b7b7b7b7-0000-4000-8000-000000000000', 'authenticated', 'authenticated', 'b7@test.local', '', now(), now());
insert into public.detailers (id, handle, business_name, timezone, is_published, contact_phone, payment_note) values
  ('a7a7a7a7-0000-4000-8000-000000000000', 'test-a7', 'A7 Detail', 'UTC', true, '+15125550177', 'Zelle: a7'),
  ('b7b7b7b7-0000-4000-8000-000000000000', 'test-b7', 'B7 Detail', 'UTC', true, null, null);
insert into public.clients (id, detailer_id, name, phone) values
  ('a7a7a7a7-0000-4000-8000-0000000000c1', 'a7a7a7a7-0000-4000-8000-000000000000', 'Ann Lee', '+15125550101'),
  ('a7a7a7a7-0000-4000-8000-0000000000c2', 'a7a7a7a7-0000-4000-8000-000000000000', 'Bob Ray', '+15125550102'),
  ('b7b7b7b7-0000-4000-8000-0000000000c1', 'b7b7b7b7-0000-4000-8000-000000000000', 'Cat Wu', '+15125550103');
insert into public.bookings (id, detailer_id, client_id, service_name, vehicle_size, add_ons, starts_at, duration_min, address,
                             subtotal_cents, deposit_cents, status, client_token) values
  -- Ann: upcoming, A7.
  ('a7a7a7a7-0000-4000-8000-0000000000b1', 'a7a7a7a7-0000-4000-8000-000000000000', 'a7a7a7a7-0000-4000-8000-0000000000c1',
   'Full detail', 'suv', '[{"name":"Pet hair","priceCents":3500}]', now() + interval '3 days', 180, '1 Secret Lane',
   24500, 7350, 'confirmed', repeat('a', 48)),
  -- Bob: upcoming, A7.
  ('a7a7a7a7-0000-4000-8000-0000000000b2', 'a7a7a7a7-0000-4000-8000-000000000000', 'a7a7a7a7-0000-4000-8000-0000000000c2',
   'Wash', 'sedan', '[]', now() + interval '4 days', 60, '2 Secret Lane', 10000, 3000, 'confirmed', repeat('b', 48)),
  -- Ann: long past, A7 (access window over).
  ('a7a7a7a7-0000-4000-8000-0000000000b3', 'a7a7a7a7-0000-4000-8000-000000000000', 'a7a7a7a7-0000-4000-8000-0000000000c1',
   'Wash', 'sedan', '[]', now() - interval '40 days', 60, '1 Secret Lane', 10000, 3000, 'completed', repeat('c', 48)),
  -- Cat: B7, cancelled.
  ('b7b7b7b7-0000-4000-8000-0000000000b1', 'b7b7b7b7-0000-4000-8000-000000000000', 'b7b7b7b7-0000-4000-8000-0000000000c1',
   'Wash', 'sedan', '[]', now() + interval '5 days', 60, '3 Secret Lane', 10000, 3000, 'cancelled', repeat('d', 48));

set local role service_role;

-- 1. Lookup.
select is(public.client_booking(repeat('a', 48)) ->> 'serviceName', 'Full detail', 'valid token shows the booking');
select is(public.client_booking(repeat('a', 48)) ->> 'firstName', 'Ann', 'first name only');
select ok(public.client_booking(repeat('a', 48))::text !~ 'Secret Lane|\+15125550101|Lee', 'no address, phone or surname on the page');
select ok(not (public.client_booking(repeat('a', 48)) ? 'clientToken'), 'the token is not echoed back');
select is(public.client_booking(repeat('a', 48)) ->> 'contactPhone', '+15125550177', 'detailer contact phone shown');
select is(public.client_booking(repeat('a', 48)) -> 'addOns', '["Pet hair"]'::jsonb, 'add-on names');
select is(public.client_booking(repeat('a', 48)) ->> 'depositStatus', 'due', 'deposit due');
select is(public.client_booking(repeat('a', 48)) ->> 'ref', upper(left(replace('a7a7a7a7-0000-4000-8000-0000000000b1', '-', ''), 8)), 'short reference');
select is(public.client_booking(repeat('0', 48)), null, 'unknown token: nothing');
select is(public.client_booking('a'), null, 'malformed token: nothing');
select is(public.client_booking(repeat('a', 47) || '%'), null, 'no pattern matching on the token');
select is(public.client_booking(repeat('c', 48)), '{"expired": true, "handle": "test-a7", "businessName": "A7 Detail"}'::jsonb,
          'past the 30-day window: expired, no details');

-- 2. Deposit reporting reuses report_deposit_sent().
select is(public.report_deposit_sent('a7a7a7a7-0000-4000-8000-0000000000b1', repeat('a', 48)) ->> 'ok', 'true', 'Ann reports her deposit');
select is(public.client_booking(repeat('a', 48)) ->> 'depositStatus', 'reported', 'page shows "reported", not paid');
select is(public.report_deposit_sent('a7a7a7a7-0000-4000-8000-0000000000b2', repeat('a', 48)) ->> 'error', 'not_found',
          'Ann''s token cannot report Bob''s deposit');

-- 3. Change requests.
select is(public.request_booking_change(repeat('a', 48), 'reschedule',
          jsonb_build_array(to_char(now() + interval '6 days', 'YYYY-MM-DD') || ' 10:00'), 'Mornings better') ->> 'ok', 'true',
          'reschedule request with a preferred time');
select is((public.client_booking(repeat('a', 48)) -> 'request' ->> 'kind'), 'reschedule', 'page shows the open request');
select is(public.request_booking_change(repeat('a', 48), 'cancel', '[]', 'Car sold') ->> 'ok', 'true', 'a new request replaces it');
select is((select count(*)::int from public.booking_requests where booking_id = 'a7a7a7a7-0000-4000-8000-0000000000b1'), 1,
          'still one request per booking');
select is(public.request_booking_change(repeat('a', 48), 'reschedule', '["2020-01-01 10:00"]', '') ->> 'error', 'invalid', 'past time refused');
select is(public.request_booking_change(repeat('a', 48), 'reschedule', '["tomorrow at ten"]', '') ->> 'error', 'invalid', 'garbage time refused');
select is(public.request_booking_change(repeat('a', 48), 'reschedule', '[]', '') ->> 'error', 'invalid', 'reschedule needs a time or a note');
select is(public.request_booking_change(repeat('a', 48), 'cancel', '["2099-01-01 10:00"]', '') ->> 'error', 'invalid', 'cancel takes no times');
select is(public.request_booking_change(repeat('d', 48), 'cancel', '[]', '') ->> 'error', 'status', 'cancelled booking: no requests');
select is(public.request_booking_change(repeat('0', 48), 'cancel', '[]', '') ->> 'error', 'not_found', 'unknown token refused');
select is((select count(*)::int from public.booking_requests where booking_id = 'a7a7a7a7-0000-4000-8000-0000000000b2'), 0,
          'Bob''s booking untouched by Ann''s requests');
select is((select count(*)::int from public.audit_log where event = 'booking.change_requested' and detailer_id = 'a7a7a7a7-0000-4000-8000-000000000000'), 2, 'requests are audited');

-- 4. The detailer sees only their own requests; acting closes them.
reset role;
select set_config('test.req', (select id::text from public.booking_requests limit 1), true);
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"b7b7b7b7-0000-4000-8000-000000000000","role":"authenticated"}', true);
select is_empty('select id from public.booking_requests', 'B7 cannot see A7''s requests');
select is(public.dismiss_booking_request(current_setting('test.req')::uuid) ->> 'error', 'not_found', 'B7 cannot dismiss A7''s request');
reset role;
select is((select status::text from public.booking_requests where id = current_setting('test.req')::uuid), 'open', 'and it is still open');
set local role service_role;
select is((public.cancel_booking('a7a7a7a7-0000-4000-8000-0000000000b1', 'detailer', 'a7a7a7a7-0000-4000-8000-000000000000') ->> 'ok'), 'true',
          'detailer cancels');
reset role;
select is((select status::text from public.booking_requests where booking_id = 'a7a7a7a7-0000-4000-8000-0000000000b1'), 'done',
          'cancelling closes the request');

select * from finish();
rollback;
