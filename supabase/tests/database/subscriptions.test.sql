-- Pro subscriptions and the free-plan booking limit. Run: npx supabase test db
begin;
create extension if not exists pgtap with schema extensions;
select plan(13);

insert into auth.users (instance_id, id, aud, role, email, encrypted_password, created_at, updated_at) values
  ('00000000-0000-0000-0000-000000000000', 'efefefef-0000-4000-8000-000000000000', 'authenticated', 'authenticated', 's1@test.local', '', now(), now());
insert into public.detailers (id, handle, business_name, timezone, is_published) values
  ('efefefef-0000-4000-8000-000000000000', 'sub-test', 'Sub Test', 'America/New_York', true);
insert into public.services (id, detailer_id, name, duration_min, price_sedan_cents, price_suv_cents, price_truck_cents) values
  ('efefefef-0000-4000-8000-00000000000a', 'efefefef-0000-4000-8000-000000000000', 'Wash', 60, 5000, 5000, 5000);
insert into public.availability_slots (detailer_id, weekday, start_time)
select 'efefefef-0000-4000-8000-000000000000', wd, t::time
from generate_series(0, 6) wd cross join unnest(array['08:00', '10:00', '12:00', '14:00', '16:00', '18:00']) t;
insert into public.clients (id, detailer_id, name, phone) values
  ('efefefef-0000-4000-8000-0000000000c1', 'efefefef-0000-4000-8000-000000000000', 'C', '+15550004444');
-- Five paid bookings created this month.
insert into public.bookings (detailer_id, client_id, service_name, vehicle_size, starts_at, duration_min, address, subtotal_cents, deposit_cents, status)
select 'efefefef-0000-4000-8000-000000000000', 'efefefef-0000-4000-8000-0000000000c1', 'Wash', 'sedan',
       now() + (n || ' days')::interval, 60, 'A', 5000, 1500, 'confirmed'
from generate_series(10, 14) n;

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"efefefef-0000-4000-8000-000000000000","role":"authenticated"}', true);
select is((public.plan_usage() ->> 'used')::int, 5, 'usage counts this month''s paid bookings');
select is(public.plan_usage() ->> 'plan', 'free', 'a new detailer is on the free plan');
select throws_ok($$ select public.apply_subscription_event('x', 'efefefef-0000-4000-8000-000000000000', true, now() + interval '30 days', now(), 'INITIAL_PURCHASE') $$,
  '42501', null, 'a client cannot grant itself Pro');
reset role;

set local role service_role;
select is(public.create_booking('sub-test', 'efefefef-0000-4000-8000-00000000000a', 'sedan', '{}',
          ((now() at time zone 'America/New_York')::date + 3), '12:00', 'New', '+15550004445', 'Somewhere', false, null) ->> 'error',
          'plan_limit', 'the 6th booking of the month is refused on the free plan');

select is(public.apply_subscription_event('evt_rc_1', 'efefefef-0000-4000-8000-000000000000', true,
          now() + interval '30 days', now() - interval '1 minute', 'INITIAL_PURCHASE'), 'applied', 'a purchase is applied');
select is(public.apply_subscription_event('evt_rc_1', 'efefefef-0000-4000-8000-000000000000', true,
          now() + interval '30 days', now() - interval '1 minute', 'INITIAL_PURCHASE'), 'duplicate', 'a replayed event is ignored');
select ok(public.detailer_is_pro('efefefef-0000-4000-8000-000000000000'), 'the detailer is now Pro');
select is(public.create_booking('sub-test', 'efefefef-0000-4000-8000-00000000000a', 'sedan', '{}',
          ((now() at time zone 'America/New_York')::date + 3), '12:00', 'New', '+15550004445', 'Somewhere', false, null) ->> 'ok',
          'true', 'Pro has no monthly limit');

select is(public.apply_subscription_event('evt_rc_old', 'efefefef-0000-4000-8000-000000000000', false,
          null, now() - interval '1 hour', 'EXPIRATION'), 'stale', 'an older event delivered late cannot downgrade');
select ok(public.detailer_is_pro('efefefef-0000-4000-8000-000000000000'), 'still Pro after the stale event');
select is(public.apply_subscription_event('evt_rc_2', 'efefefef-0000-4000-8000-000000000000', false,
          null, now(), 'EXPIRATION'), 'applied', 'an expiration downgrades');
select ok(not public.detailer_is_pro('efefefef-0000-4000-8000-000000000000'), 'back on the free plan');
select is(public.apply_subscription_event('evt_rc_3', '00000000-0000-4000-8000-0000000000ff', true,
          now() + interval '30 days', now(), 'INITIAL_PURCHASE'), 'ignored', 'unknown users are ignored');

select * from finish();
rollback;
