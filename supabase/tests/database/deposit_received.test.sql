-- Detailers mark deposits paid to them directly. Run: npx supabase test db
begin;
create extension if not exists pgtap with schema extensions;
select plan(8);

insert into auth.users (instance_id, id, aud, role, email, encrypted_password, created_at, updated_at) values
  ('00000000-0000-0000-0000-000000000000', 'dddddddd-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'd1@test.local', '', now(), now()),
  ('00000000-0000-0000-0000-000000000000', 'dddddddd-0000-4000-8000-000000000002', 'authenticated', 'authenticated', 'd2@test.local', '', now(), now());
insert into public.detailers (id, handle, business_name, timezone, is_published) values
  ('dddddddd-0000-4000-8000-000000000001', 'test-d1', 'D1', 'America/Chicago', true),
  ('dddddddd-0000-4000-8000-000000000002', 'test-d2', 'D2', 'America/Chicago', true);
insert into public.clients (id, detailer_id, name, phone) values
  ('dddddddd-0000-4000-8000-0000000000c1', 'dddddddd-0000-4000-8000-000000000001', 'Pat', '+15125550111');
insert into public.bookings (id, detailer_id, client_id, service_name, vehicle_size, starts_at, duration_min, address, subtotal_cents, deposit_cents, status) values
  ('dddddddd-0000-4000-8000-0000000000b1', 'dddddddd-0000-4000-8000-000000000001', 'dddddddd-0000-4000-8000-0000000000c1',
   'Wash', 'sedan', now() + interval '2 days', 60, 'Addr', 10000, 3000, 'confirmed'),
  ('dddddddd-0000-4000-8000-0000000000b2', 'dddddddd-0000-4000-8000-000000000001', 'dddddddd-0000-4000-8000-0000000000c1',
   'Wash', 'sedan', now() + interval '3 days', 60, 'Addr', 10000, 3000, 'cancelled');

set local role anon;
select throws_ok($$ select public.mark_deposit_received('dddddddd-0000-4000-8000-0000000000b1', true) $$,
  '42501', null, 'anon cannot mark deposits');
reset role;

set local role authenticated;
set local request.jwt.claims = '{"sub": "dddddddd-0000-4000-8000-000000000001", "role": "authenticated"}';
select is(public.mark_deposit_received('dddddddd-0000-4000-8000-0000000000b1', true) ->> 'ok', 'true', 'owner marks the deposit received');
select isnt((select deposit_received_at from public.bookings where id = 'dddddddd-0000-4000-8000-0000000000b1'), null, 'the time is stamped');
select is(public.mark_deposit_received('dddddddd-0000-4000-8000-0000000000b2', true) ->> 'error', 'status', 'a cancelled booking cannot be marked');
select throws_ok($$ update public.bookings set deposit_received_at = now() where id = 'dddddddd-0000-4000-8000-0000000000b1' $$,
  '42501', null, 'the column is not writable directly');
select is(public.mark_deposit_received('dddddddd-0000-4000-8000-0000000000b1', false) ->> 'ok', 'true', 'owner can undo');
select is((select deposit_received_at from public.bookings where id = 'dddddddd-0000-4000-8000-0000000000b1'), null, 'undo clears it');

set local request.jwt.claims = '{"sub": "dddddddd-0000-4000-8000-000000000002", "role": "authenticated"}';
select is(public.mark_deposit_received('dddddddd-0000-4000-8000-0000000000b1', true) ->> 'error', 'not_found', 'another detailer cannot mark it');

select * from finish();
rollback;
