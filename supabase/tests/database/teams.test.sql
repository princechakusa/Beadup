-- Teams: each person has their own calendar; "anyone" gets the first free person.
begin;
create extension if not exists pgtap with schema extensions;
select plan(13);
update public.plan_config set value = '"external"' where key = 'payments_mode';

insert into auth.users (instance_id, id, aud, role, email, encrypted_password, created_at, updated_at) values
  ('00000000-0000-0000-0000-000000000000', 'a8a8a8a8-0000-4000-8000-000000000000', 'authenticated', 'authenticated', 'a8@test.local', '', now(), now()),
  ('00000000-0000-0000-0000-000000000000', 'b8b8b8b8-0000-4000-8000-000000000000', 'authenticated', 'authenticated', 'b8@test.local', '', now(), now());
insert into public.detailers (id, handle, business_name, timezone, is_published, trade, visit_mode) values
  ('a8a8a8a8-0000-4000-8000-000000000000', 'test-shop8', 'Shop 8', 'UTC', true, 'barber', 'studio'),
  ('b8b8b8b8-0000-4000-8000-000000000000', 'test-other8', 'Other 8', 'UTC', true, 'barber', 'studio');
insert into public.detailer_accounts (detailer_id, plan) values ('a8a8a8a8-0000-4000-8000-000000000000', 'pro');
insert into public.services (id, detailer_id, name, duration_min, price_sedan_cents, price_suv_cents, price_truck_cents) values
  ('a8a8a8a8-0000-4000-8000-00000000000a', 'a8a8a8a8-0000-4000-8000-000000000000', 'Cut', 60, 3000, 3000, 3000);
insert into public.availability_slots (detailer_id, weekday, start_time)
select 'a8a8a8a8-0000-4000-8000-000000000000', wd, '10:00' from generate_series(0, 6) wd;
insert into public.staff_members (id, detailer_id, name, sort_order) values
  ('a8a8a8a8-0000-4000-8000-0000000000f1', 'a8a8a8a8-0000-4000-8000-000000000000', 'Thabo', 1),
  ('a8a8a8a8-0000-4000-8000-0000000000f2', 'a8a8a8a8-0000-4000-8000-000000000000', 'Lindi', 2);

set local role anon;
select is(jsonb_array_length(public.get_booking_page('test-shop8') -> 'staff'), 2, 'page lists the team');
reset role;

set local role service_role;
create temporary table bk on commit drop as
select public.create_booking('test-shop8', 'a8a8a8a8-0000-4000-8000-00000000000a', 'sedan', '{}', current_date + 3, '10:00', 'C1', '+15125550171', '', false, null, 'a8a8a8a8-0000-4000-8000-0000000000f2') as a,
       public.create_booking('test-shop8', 'a8a8a8a8-0000-4000-8000-00000000000a', 'sedan', '{}', current_date + 3, '10:00', 'C2', '+15125550172', '', false, null, null) as b,
       public.create_booking('test-shop8', 'a8a8a8a8-0000-4000-8000-00000000000a', 'sedan', '{}', current_date + 3, '10:00', 'C3', '+15125550173', '', false, null, null) as c,
       public.create_booking('test-shop8', 'a8a8a8a8-0000-4000-8000-00000000000a', 'sedan', '{}', current_date + 3, '10:00', 'C4', '+15125550174', '', false, null, 'a8a8a8a8-0000-4000-8000-0000000000f2') as d;
select is((select a ->> 'staffId' from bk), 'a8a8a8a8-0000-4000-8000-0000000000f2', 'chosen person: Lindi');
select is((select b ->> 'staffId' from bk), 'a8a8a8a8-0000-4000-8000-0000000000f1', '"anyone" at the same time: the free person, Thabo');
select is((select c ->> 'error' from bk), 'slot_taken', 'both busy: taken');
select is((select d ->> 'error' from bk), 'slot_taken', 'Lindi twice at once: taken');
select is(public.create_booking('test-shop8', 'a8a8a8a8-0000-4000-8000-00000000000a', 'sedan', '{}', current_date + 4, '10:00', 'C5', '+15125550175', '', false, null,
          'b8b8b8b8-0000-4000-8000-0000000000f1') ->> 'error', 'staff', 'someone else''s person refused');
reset role;
select is((select count(*)::int from public.bookings where detailer_id = 'a8a8a8a8-0000-4000-8000-000000000000'), 2, 'two bookings at 10:00, one per person');

set local role anon;
select is((select count(*)::int from jsonb_array_elements(public.get_booking_page('test-shop8') -> 'busy') e where e ->> 'staffId' is not null), 2, 'busy ranges say whose they are');
reset role;

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"b8b8b8b8-0000-4000-8000-000000000000","role":"authenticated"}', true);
select is_empty('select id from public.staff_members', 'another business can''t see the team');
select throws_ok($$ insert into public.staff_members (detailer_id, name) values ('a8a8a8a8-0000-4000-8000-000000000000', 'Spy') $$, '42501', null, 'or add to it');
select set_config('request.jwt.claims', '{"sub":"a8a8a8a8-0000-4000-8000-000000000000","role":"authenticated"}', true);
select lives_ok($$ update public.staff_members set active = false where name = 'Lindi' $$, 'owner manages the team');
-- Moving Thabo's booking onto Lindi's time for Lindi clashes.
select throws_ok($$ update public.bookings set staff_id = 'a8a8a8a8-0000-4000-8000-0000000000f2'
                    where staff_id = 'a8a8a8a8-0000-4000-8000-0000000000f1' $$, '23P01', null, 'reassigning onto a busy person is refused');
select lives_ok($$ delete from public.staff_members where name = 'Thabo' $$, 'removing a person with bookings works (bookings kept, unassigned)');
reset role;

select * from finish();
rollback;
