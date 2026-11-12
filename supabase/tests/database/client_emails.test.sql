-- Client emails: queued once per event, only with an address, server only.
begin;
create extension if not exists pgtap with schema extensions;
select plan(12);
update public.plan_config set value = '"external"' where key = 'payments_mode';

insert into auth.users (instance_id, id, aud, role, email, encrypted_password, created_at, updated_at) values
  ('00000000-0000-0000-0000-000000000000', 'e5e5e5e5-0000-4000-8000-000000000000', 'authenticated', 'authenticated', 'e5@test.local', '', now(), now());
insert into public.detailers (id, handle, business_name, timezone, is_published) values
  ('e5e5e5e5-0000-4000-8000-000000000000', 'test-e5', 'E5 Detail', 'UTC', true);
insert into public.detailer_accounts (detailer_id, plan) values ('e5e5e5e5-0000-4000-8000-000000000000', 'pro');
insert into public.services (id, detailer_id, name, duration_min, price_sedan_cents, price_suv_cents, price_truck_cents) values
  ('e5e5e5e5-0000-4000-8000-00000000000a', 'e5e5e5e5-0000-4000-8000-000000000000', 'Wash', 60, 10000, 10000, 10000);
insert into public.availability_slots (detailer_id, weekday, start_time)
select 'e5e5e5e5-0000-4000-8000-000000000000', wd, t from generate_series(0, 6) wd, (values ('09:00'::time), ('14:00'::time)) s(t);

set local role service_role;
create temporary table bk on commit drop as
select public.create_booking('test-e5', 'e5e5e5e5-0000-4000-8000-00000000000a', 'sedan', '{}', current_date + 3, '09:00',
       'Ann', '+15125550191', '1 Main St', false, null) ->> 'bookingId' as id,
       public.create_booking('test-e5', 'e5e5e5e5-0000-4000-8000-00000000000a', 'sedan', '{}', current_date + 4, '09:00',
       'Bo', '+15125550192', '2 Main St', false, null) ->> 'bookingId' as id2;

select is(public.set_client_email((select id::uuid from bk), 'not-an-email'), false, 'bad email refused');
select is(public.set_client_email((select id::uuid from bk), 'Ann@Example.com'), true, 'email saved and confirmation queued');
select is((select email from public.clients where name = 'Ann'), 'ann@example.com', 'stored lower-case');
select is(public.set_client_email((select id::uuid from bk), 'ann@example.com'), false, 'confirmation queued only once');
reset role;
select is((select count(*)::int from public.client_emails where booking_id = (select id::uuid from bk)), 1, 'one confirmation');

-- Changes queue their emails (only for clients with an address).
update public.bookings set starts_at = starts_at + interval '5 hours' where id = (select id::uuid from bk);
select is((select count(*)::int from public.client_emails where kind = 'rescheduled'), 1, 'reschedule queues a notice');
update public.bookings set status = 'cancelled' where id = (select id::uuid from bk);
select is((select count(*)::int from public.client_emails where kind = 'cancelled'), 1, 'cancellation queues a notice');
update public.bookings set status = 'cancelled' where id = (select id2::uuid from bk);
select is((select count(*)::int from public.client_emails where booking_id = (select id2::uuid from bk)), 0, 'no email address: nothing queued');

set local role service_role;
select ok((public.email_context((select id from public.client_emails where kind = 'confirmation')) ->> 'to') = 'ann@example.com', 'context has the address');
select is((select count(*)::int from public.queued_emails(10)), 3, 'three queued');
reset role;

set local role anon;
select throws_ok($$ select public.set_client_email(gen_random_uuid(), 'a@b.co') $$, '42501', null, 'anon cannot set emails');
reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"e5e5e5e5-0000-4000-8000-000000000000","role":"authenticated"}', true);
select is((select count(*)::int from public.client_emails), 3, 'business sees its own email log');
reset role;

select * from finish();
rollback;
