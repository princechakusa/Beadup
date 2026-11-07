-- M6: reminders, review requests, reviews, STOP handling. Run: npx supabase test db
begin;
create extension if not exists pgtap with schema extensions;
select plan(17);

-- Pick a timezone where it is currently 12:00-17:59, so the 10-20h reminder
-- window and the 9-20h review window are open whenever the test runs.
create temp table tz on commit drop as
select name from pg_timezone_names
where name ~ '^Etc/GMT[+-][0-9]+$' and extract(hour from now() at time zone name) between 12 and 17
limit 1;
select ok((select count(*) = 1 from tz), 'found a timezone inside the sending window');

insert into auth.users (instance_id, id, aud, role, email, encrypted_password, created_at, updated_at) values
  ('00000000-0000-0000-0000-000000000000', 'abababab-0000-4000-8000-000000000000', 'authenticated', 'authenticated', 'm1@test.local', '', now(), now()),
  ('00000000-0000-0000-0000-000000000000', 'cdcdcdcd-0000-4000-8000-000000000000', 'authenticated', 'authenticated', 'm2@test.local', '', now(), now());
insert into public.detailers (id, handle, business_name, timezone)
select 'abababab-0000-4000-8000-000000000000', 'msg-one', 'Msg One', name from tz;
insert into public.detailers (id, handle, business_name, timezone)
select 'cdcdcdcd-0000-4000-8000-000000000000', 'msg-two', 'Msg Two', name from tz;
-- The same phone is a client of both detailers.
insert into public.clients (id, detailer_id, name, phone, sms_consent, sms_consent_at, sms_consent_text) values
  ('abababab-0000-4000-8000-0000000000c1', 'abababab-0000-4000-8000-000000000000', 'Sam Lee', '+15550007777', true, now(), 'c'),
  ('cdcdcdcd-0000-4000-8000-0000000000c1', 'cdcdcdcd-0000-4000-8000-000000000000', 'Sam Lee', '+15550007777', true, now(), 'c');

-- b1 tomorrow (reminder), b2 in 3 days (no reminder), b3 completed 3h ago (review), b4 completed with a review.
insert into public.bookings (id, detailer_id, client_id, service_name, vehicle_size, starts_at, duration_min, address, subtotal_cents, deposit_cents, status)
select 'abababab-0000-4000-8000-0000000000b1', 'abababab-0000-4000-8000-000000000000', 'abababab-0000-4000-8000-0000000000c1',
       'Wash', 'sedan', ((now() at time zone name)::date + 1 + time '10:00') at time zone name, 60, 'Addr', 10000, 3000, 'confirmed' from tz;
insert into public.bookings (id, detailer_id, client_id, service_name, vehicle_size, starts_at, duration_min, address, subtotal_cents, deposit_cents, status)
select 'abababab-0000-4000-8000-0000000000b2', 'abababab-0000-4000-8000-000000000000', 'abababab-0000-4000-8000-0000000000c1',
       'Wash', 'sedan', ((now() at time zone name)::date + 3 + time '10:00') at time zone name, 60, 'Addr', 10000, 3000, 'confirmed' from tz;
insert into public.bookings (id, detailer_id, client_id, service_name, vehicle_size, starts_at, duration_min, address, subtotal_cents, deposit_cents, status, completed_at) values
  ('abababab-0000-4000-8000-0000000000b3', 'abababab-0000-4000-8000-000000000000', 'abababab-0000-4000-8000-0000000000c1',
   'Wash', 'sedan', now() - interval '5 hours', 60, 'Addr', 10000, 3000, 'completed', now() - interval '3 hours'),
  ('abababab-0000-4000-8000-0000000000b4', 'abababab-0000-4000-8000-000000000000', 'abababab-0000-4000-8000-0000000000c1',
   'Wash', 'sedan', now() - interval '6 hours', 60, 'Addr', 10000, 3000, 'completed', now() - interval '4 hours');
insert into public.reviews (detailer_id, booking_id, rating) values ('abababab-0000-4000-8000-000000000000', 'abababab-0000-4000-8000-0000000000b4', 5);

set local role service_role;
select is(public.enqueue_due_messages(), '{"reminders": 1, "reviewRequests": 1}'::jsonb, 'one reminder and one review request are queued');
select is(public.enqueue_due_messages(), '{"reminders": 0, "reviewRequests": 0}'::jsonb, 'running again queues nothing new');
select is((select kind::text from public.messages where booking_id = 'abababab-0000-4000-8000-0000000000b1'), 'reminder', 'the reminder is for tomorrow''s booking');
select is((select kind::text from public.messages where booking_id = 'abababab-0000-4000-8000-0000000000b3'), 'review_request', 'the review request is for the unreviewed job');
reset role;

-- completed_at is stamped by the trigger.
update public.bookings set status = 'completed' where id = 'abababab-0000-4000-8000-0000000000b2';
select ok((select completed_at is not null from public.bookings where id = 'abababab-0000-4000-8000-0000000000b2'), 'completing a job stamps completed_at');
update public.bookings set status = 'confirmed', completed_at = null where id = 'abababab-0000-4000-8000-0000000000b2';

-- Reviews through the link.
set local role service_role;
select is(public.submit_review('0000', 5, '') ->> 'error', 'not_found', 'a malformed token is refused');
select is(public.submit_review((select review_token from public.bookings where id = 'abababab-0000-4000-8000-0000000000b1'), 5, '') ->> 'error',
          'not_completed', 'an unfinished job cannot be reviewed');
select is(public.submit_review((select review_token from public.bookings where id = 'abababab-0000-4000-8000-0000000000b3'), 6, '') ->> 'error',
          'invalid', 'ratings outside 1-5 are refused');
select is(public.submit_review((select review_token from public.bookings where id = 'abababab-0000-4000-8000-0000000000b3'), 4, '  Great job  ') ->> 'ok',
          'true', 'a completed job can be reviewed once');
select is(public.submit_review((select review_token from public.bookings where id = 'abababab-0000-4000-8000-0000000000b3'), 1, '') ->> 'error',
          'already_reviewed', 'a second review is refused');
select is((select body from public.reviews where booking_id = 'abababab-0000-4000-8000-0000000000b3'), 'Great job', 'the review text is trimmed');

-- STOP applies to every detailer's record for the phone and drops queued texts.
select is(public.record_sms_opt_out('+15550007777', true), 2, 'STOP updates both client records');
select is((select count(*)::int from public.messages where client_id = 'abababab-0000-4000-8000-0000000000c1' and status = 'queued'), 0,
          'queued texts to the number are dropped');
select is((public.message_context((select id from public.messages where booking_id = 'abababab-0000-4000-8000-0000000000b1')) ->> 'canText')::boolean,
          false, 'an opted-out number cannot be texted');
select is(public.record_sms_opt_out('+15550007777', false), 2, 'START updates both client records');
select ok((select bool_and(sms_opted_out_at is null) from public.clients where phone = '+15550007777'), 'START lifts the opt-out');

select * from finish();
rollback;
