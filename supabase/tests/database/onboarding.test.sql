-- Onboarding. Run: npx supabase test db
begin;
create extension if not exists pgtap with schema extensions;
select plan(11);

insert into auth.users (instance_id, id, aud, role, email, encrypted_password, created_at, updated_at) values
  ('00000000-0000-0000-0000-000000000000', '56565656-0000-4000-8000-000000000000', 'authenticated', 'authenticated', 'o1@test.local', '', now(), now()),
  ('00000000-0000-0000-0000-000000000000', '78787878-0000-4000-8000-000000000000', 'authenticated', 'authenticated', 'o2@test.local', '', now(), now());

set local role anon;
select throws_ok($$ select public.handle_available('anything') $$, '42501', null, 'anon cannot probe handles');
reset role;

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"56565656-0000-4000-8000-000000000000","role":"authenticated"}', true);
select ok(public.handle_available('shine-time'), 'a free handle is available');
select ok(not public.handle_available('api'), 'reserved handles are not available');
select ok(not public.handle_available('Bad Handle!'), 'malformed handles are not available');

select is(public.create_detailer_profile('Shine-Time', 'Shine Time', 'Austin, TX', 'America/Chicago',
  '[{"name":"Full detail","description":"Inside and out","durationMin":180,"priceCents":{"sedan":18000,"suv":21000,"truck":23000}}]',
  '[{"name":"Pet hair","priceCents":4000}]',
  '[{"weekday":1,"time":"08:00"},{"weekday":1,"time":"08:00"},{"weekday":2,"time":"12:30"}]') ->> 'ok',
  'true', 'onboarding creates the business');
select is((select count(*)::int from public.availability_slots), 2, 'duplicate start times are collapsed');
select is((public.get_booking_page('shine-time') -> 'services' -> 0 ->> 'name'), 'Full detail', 'the booking page is published');
select is(public.create_detailer_profile('another', 'X', '', 'America/Chicago', '[{"name":"W","durationMin":60,"priceCents":{"sedan":1,"suv":1,"truck":1}}]', '[]', '[]') ->> 'error',
  'exists', 'onboarding runs once per account');

select set_config('request.jwt.claims', '{"sub":"78787878-0000-4000-8000-000000000000","role":"authenticated"}', true);
select is(public.create_detailer_profile('shine-time', 'Copycat', '', 'America/Chicago', '[{"name":"W","durationMin":60,"priceCents":{"sedan":1,"suv":1,"truck":1}}]', '[]', '[]') ->> 'error',
  'handle_taken', 'a taken handle is refused');
select is(public.create_detailer_profile('fresh-one', 'Bad prices', '', 'America/Chicago', '[{"name":"W","durationMin":60,"priceCents":{"sedan":-5,"suv":1,"truck":1}}]', '[]', '[]') ->> 'error',
  'invalid', 'invalid prices are refused');
select is((select count(*)::int from public.detailers where id = '78787878-0000-4000-8000-000000000000'), 0,
  'a refused onboarding leaves nothing behind');

select * from finish();
rollback;
