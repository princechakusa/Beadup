-- Archiving finished jobs: only finished ones, only your own, nothing deleted.
begin;
create extension if not exists pgtap with schema extensions;
select plan(5);

insert into auth.users (instance_id, id, aud, role, email, encrypted_password, created_at, updated_at) values
  ('00000000-0000-0000-0000-000000000000', 'a4c4c4c4-0000-4000-8000-000000000000', 'authenticated', 'authenticated', 'a4@test.local', '', now(), now()),
  ('00000000-0000-0000-0000-000000000000', 'a4c4c4c4-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'a4b@test.local', '', now(), now());
insert into public.detailers (id, handle, business_name, timezone, is_published) values
  ('a4c4c4c4-0000-4000-8000-000000000000', 'test-a4', 'A4', 'UTC', true),
  ('a4c4c4c4-0000-4000-8000-000000000001', 'test-a4b', 'A4B', 'UTC', true);
insert into public.clients (id, detailer_id, name, phone) values
  ('a4c4c4c4-0000-4000-8000-0000000000c1', 'a4c4c4c4-0000-4000-8000-000000000000', 'Cli', '+15125550133');
insert into public.bookings (id, detailer_id, client_id, service_name, vehicle_size, address, starts_at, duration_min, subtotal_cents, deposit_cents, status) values
  ('a4c4c4c4-0000-4000-8000-0000000000b1', 'a4c4c4c4-0000-4000-8000-000000000000', 'a4c4c4c4-0000-4000-8000-0000000000c1', 'Wash', 'sedan', 'x', now() - interval '3 days', 60, 10000, 3000, 'completed'),
  ('a4c4c4c4-0000-4000-8000-0000000000b2', 'a4c4c4c4-0000-4000-8000-000000000000', 'a4c4c4c4-0000-4000-8000-0000000000c1', 'Wash', 'sedan', 'x', now() + interval '3 days', 60, 10000, 3000, 'confirmed');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"a4c4c4c4-0000-4000-8000-000000000000","role":"authenticated"}', true);
update public.bookings set archived_at = now() where id = 'a4c4c4c4-0000-4000-8000-0000000000b1';
select isnt((select archived_at from public.bookings where id = 'a4c4c4c4-0000-4000-8000-0000000000b1'), null, 'a finished job can be archived');
select throws_ok($$ update public.bookings set archived_at = now() where id = 'a4c4c4c4-0000-4000-8000-0000000000b2' $$, '42501', null, 'an upcoming job cannot be archived');
update public.bookings set archived_at = null where id = 'a4c4c4c4-0000-4000-8000-0000000000b1';
select is((select archived_at from public.bookings where id = 'a4c4c4c4-0000-4000-8000-0000000000b1'), null, 'and it can be restored');

select set_config('request.jwt.claims', '{"sub":"a4c4c4c4-0000-4000-8000-000000000001","role":"authenticated"}', true);
update public.bookings set archived_at = now() where id = 'a4c4c4c4-0000-4000-8000-0000000000b1';
reset role;
select is((select archived_at from public.bookings where id = 'a4c4c4c4-0000-4000-8000-0000000000b1'), null, 'another business cannot archive it');
select is((select count(*)::int from public.bookings where id in ('a4c4c4c4-0000-4000-8000-0000000000b1', 'a4c4c4c4-0000-4000-8000-0000000000b2')), 2, 'nothing was deleted');

select * from finish();
rollback;
