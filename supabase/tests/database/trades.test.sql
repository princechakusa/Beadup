-- Trades, visit mode and service photos.
begin;
create extension if not exists pgtap with schema extensions;
select plan(14);
update public.plan_config set value = '"external"' where key = 'payments_mode';

insert into auth.users (instance_id, id, aud, role, email, encrypted_password, created_at, updated_at) values
  ('00000000-0000-0000-0000-000000000000', 'a9a9a9a9-0000-4000-8000-000000000000', 'authenticated', 'authenticated', 'a9@test.local', '', now(), now()),
  ('00000000-0000-0000-0000-000000000000', 'b9b9b9b9-0000-4000-8000-000000000000', 'authenticated', 'authenticated', 'b9@test.local', '', now(), now());
insert into public.detailers (id, handle, business_name, timezone, is_published) values
  ('a9a9a9a9-0000-4000-8000-000000000000', 'test-salon9', 'Nandi Hair', 'Africa/Johannesburg', true),
  ('b9b9b9b9-0000-4000-8000-000000000000', 'test-mech9', 'Sipho Mechanics', 'Africa/Johannesburg', true);
insert into public.detailer_accounts (detailer_id, plan) values ('a9a9a9a9-0000-4000-8000-000000000000', 'pro');
insert into public.services (id, detailer_id, name, duration_min, price_sedan_cents, price_suv_cents, price_truck_cents) values
  ('a9a9a9a9-0000-4000-8000-00000000000a', 'a9a9a9a9-0000-4000-8000-000000000000', 'Knotless braids', 240, 85000, 85000, 85000),
  ('b9b9b9b9-0000-4000-8000-00000000000a', 'b9b9b9b9-0000-4000-8000-000000000000', 'Oil change', 60, 60000, 60000, 60000);
insert into public.availability_slots (detailer_id, weekday, start_time)
select 'a9a9a9a9-0000-4000-8000-000000000000', wd, '09:00' from generate_series(0, 6) wd;

select is((select trade from public.detailers where handle = 'test-mech9'), 'detailing', 'existing businesses default to car detailing');
select is((select visit_mode from public.detailers where handle = 'test-mech9'), 'mobile', 'and to going to the client');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"a9a9a9a9-0000-4000-8000-000000000000","role":"authenticated"}', true);
select lives_ok($$ update public.detailers set trade = 'hair_salon', visit_mode = 'studio' $$, 'a business sets its trade and visit mode');
select throws_ok($$ update public.detailers set trade = 'astrology' $$, '23514', null, 'unknown trade refused');
select throws_ok($$ update public.detailers set visit_mode = 'online' $$, '23514', null, 'unknown visit mode refused');
select lives_ok($$ update public.services set photo_path = 'a9a9a9a9-0000-4000-8000-000000000000/braidsphoto001.jpg' $$, 'service photo in own folder');
select throws_ok($$ update public.services set photo_path = 'b9b9b9b9-0000-4000-8000-000000000000/braidsphoto001.jpg'
                    where id = 'a9a9a9a9-0000-4000-8000-00000000000a' $$, '23514', null, 'service photo from another folder refused');
select is_empty($$ update public.services set name = 'hacked' where id = 'b9b9b9b9-0000-4000-8000-00000000000a' returning id $$,
                'cannot touch another business''s services');
reset role;

set local role anon;
select is(public.get_booking_page('test-salon9') ->> 'trade', 'hair_salon', 'page has the trade');
select is(public.get_booking_page('test-salon9') ->> 'visitMode', 'studio', 'page has the visit mode');
select is(public.get_booking_page('test-salon9') -> 'services' -> 0 ->> 'photo',
          left(md5('a9a9a9a9-0000-4000-8000-000000000000/braidsphoto001.jpg'), 10), 'service photo version, not the path');
reset role;

set local role service_role;
select is(public.media_path('test-salon9', 'a9a9a9a9-0000-4000-8000-00000000000a'),
          'a9a9a9a9-0000-4000-8000-000000000000/braidsphoto001.jpg', 'media route finds the service photo');
-- A salon booking without an address: the client comes to the salon.
select is(public.create_booking('test-salon9', 'a9a9a9a9-0000-4000-8000-00000000000a', 'sedan', '{}', current_date + 3, '09:00',
          'Lerato', '+27821234511', '', false, null) ->> 'ok', 'true', 'studio booking needs no client address');
reset role;
select is((select address from public.bookings where detailer_id = 'a9a9a9a9-0000-4000-8000-000000000000'), 'At Nandi Hair',
          'address reads "At <business>"');

select * from finish();
rollback;
