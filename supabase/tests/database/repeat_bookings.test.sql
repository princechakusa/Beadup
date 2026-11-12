-- The business books a client in, once or on a repeat; clashes are skipped.
begin;
create extension if not exists pgtap with schema extensions;
select plan(9);

insert into auth.users (instance_id, id, aud, role, email, encrypted_password, created_at, updated_at) values
  ('00000000-0000-0000-0000-000000000000', 'c6c6c6c6-0000-4000-8000-000000000000', 'authenticated', 'authenticated', 'c6@test.local', '', now(), now()),
  ('00000000-0000-0000-0000-000000000000', 'd6d6d6d6-0000-4000-8000-000000000000', 'authenticated', 'authenticated', 'd6@test.local', '', now(), now());
insert into public.detailers (id, handle, business_name, timezone, is_published) values
  ('c6c6c6c6-0000-4000-8000-000000000000', 'test-c6', 'C6 Barber', 'UTC', true),
  ('d6d6d6d6-0000-4000-8000-000000000000', 'test-d6', 'D6', 'UTC', true);
insert into public.clients (id, detailer_id, name, phone) values
  ('c6c6c6c6-0000-4000-8000-0000000000c1', 'c6c6c6c6-0000-4000-8000-000000000000', 'Regular Joe', '+15125550161'),
  ('d6d6d6d6-0000-4000-8000-0000000000c1', 'd6d6d6d6-0000-4000-8000-000000000000', 'Other', '+15125550162');
insert into public.services (id, detailer_id, name, duration_min, price_sedan_cents, price_suv_cents, price_truck_cents) values
  ('c6c6c6c6-0000-4000-8000-00000000000a', 'c6c6c6c6-0000-4000-8000-000000000000', 'Haircut', 45, 3000, 3000, 3000);

create temporary table t as select date_trunc('day', now()) + interval '7 days 10 hours' as at;
grant select on t to authenticated;
-- Something already booked three weeks after the first visit.
insert into public.bookings (detailer_id, client_id, service_name, vehicle_size, starts_at, duration_min, address, subtotal_cents, deposit_cents, status)
select 'c6c6c6c6-0000-4000-8000-000000000000', 'c6c6c6c6-0000-4000-8000-0000000000c1', 'Haircut', 'sedan', at + interval '14 days', 45, 'x', 3000, 900, 'confirmed' from t;

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"c6c6c6c6-0000-4000-8000-000000000000","role":"authenticated"}', true);
create temporary table r on commit drop as
select public.detailer_book('c6c6c6c6-0000-4000-8000-0000000000c1', 'c6c6c6c6-0000-4000-8000-00000000000a', 'sedan',
                            (select at from t), '', 1, 4) as res;
select is((select res ->> 'ok' from r), 'true', 'weekly series booked');
select is((select jsonb_array_length(res -> 'made') from r), 3, 'three visits made');
select is((select jsonb_array_length(res -> 'skipped') from r), 1, 'the clashing week is skipped, not forced');
select is((select count(*)::int from public.bookings where service_name = 'Haircut' and status = 'confirmed'), 4, '3 new + the existing one');
select is((select address from public.bookings where service_name = 'Haircut' order by starts_at limit 1), 'At C6 Barber', 'no address: at the business');
select is(public.detailer_book('d6d6d6d6-0000-4000-8000-0000000000c1', 'c6c6c6c6-0000-4000-8000-00000000000a', 'sedan',
                               (select at from t) + interval '30 days', '', 0, 1) ->> 'error', 'client', 'cannot book another business''s client');
select is(public.detailer_book('c6c6c6c6-0000-4000-8000-0000000000c1', 'c6c6c6c6-0000-4000-8000-00000000000a', 'sedan',
                               (select at from t), '', 3, 2) ->> 'error', 'repeat', 'only 1, 2 or 4 weeks');
select is(public.detailer_book('c6c6c6c6-0000-4000-8000-0000000000c1', 'c6c6c6c6-0000-4000-8000-00000000000a', 'sedan',
                               now() - interval '1 day', '', 0, 1) ->> 'error', 'time', 'not in the past');
reset role;
set local role anon;
select throws_ok($$ select public.detailer_book(gen_random_uuid(), gen_random_uuid(), 'sedan', now(), '', 0, 1) $$, '42501', null, 'anon cannot book');
reset role;

select * from finish();
rollback;
