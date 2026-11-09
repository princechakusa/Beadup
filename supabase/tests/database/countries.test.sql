-- Countries and currencies. Run: npx supabase test db
begin;
create extension if not exists pgtap with schema extensions;
select plan(13);

insert into auth.users (instance_id, id, aud, role, email, encrypted_password, created_at, updated_at) values
  ('00000000-0000-0000-0000-000000000000', 'c0c0c0c0-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'uk@test.local', '', now(), now()),
  ('00000000-0000-0000-0000-000000000000', 'c0c0c0c0-0000-4000-8000-000000000002', 'authenticated', 'authenticated', 'au@test.local', '', now(), now()),
  ('00000000-0000-0000-0000-000000000000', 'c0c0c0c0-0000-4000-8000-000000000003', 'authenticated', 'authenticated', 'ca@test.local', '', now(), now());

select is(public.country_from_timezone('Australia/Sydney'), 'AU', 'Australian timezones map to AU');
select is(public.country_from_timezone('Europe/London'), 'GB', 'London maps to GB');
select is(public.country_from_timezone('America/Toronto'), 'CA', 'Toronto maps to CA');
select is(public.country_from_timezone('America/Chicago'), 'US', 'US timezones map to US');
select is(public.country_currency('GB'), 'gbp', 'GB prices are in pounds');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"c0c0c0c0-0000-4000-8000-000000000001","role":"authenticated"}', true);
-- The app in review doesn't send a country: it comes from the timezone.
select is(public.create_detailer_profile('london-shine', 'London Shine', 'London', 'Europe/London',
  '[{"name":"Valet","durationMin":90,"priceCents":{"sedan":6000,"suv":7000,"truck":8000}}]', '[]', '[{"weekday":1,"time":"09:00"}]') ->> 'ok',
  'true', 'a UK detailer can onboard');
select is((select country from public.detailers where handle = 'london-shine'), 'GB', 'onboarding fills the country from the timezone');
select is(public.get_booking_page('london-shine') ->> 'currency', 'GBP', 'the booking page is in pounds');

-- A detailer can correct their own country, only to a supported one.
update public.detailers set country = 'AU' where id = 'c0c0c0c0-0000-4000-8000-000000000001';
select is((select country from public.detailers where handle = 'london-shine'), 'AU', 'a detailer can change their country');
select throws_ok($$ update public.detailers set country = 'FR' where id = 'c0c0c0c0-0000-4000-8000-000000000001' $$,
  '23514', null, 'unsupported countries are refused');

-- ...and never anyone else's.
select set_config('request.jwt.claims', '{"sub":"c0c0c0c0-0000-4000-8000-000000000002","role":"authenticated"}', true);
update public.detailers set country = 'US' where handle = 'london-shine';
reset role;
select is((select country from public.detailers where handle = 'london-shine'), 'AU', 'another detailer cannot change it');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"c0c0c0c0-0000-4000-8000-000000000003","role":"authenticated"}', true);
select is(public.create_detailer_profile('toronto-gloss', 'Toronto Gloss', 'Toronto', 'America/Toronto',
  '[{"name":"Full detail","durationMin":180,"priceCents":{"sedan":20000,"suv":23000,"truck":25000}}]', '[]', '[{"weekday":2,"time":"10:00"}]')
  -> 'ok', 'true'::jsonb, 'a Canadian detailer can onboard');
select is(public.get_booking_page('toronto-gloss') ->> 'currency', 'CAD', 'Canadian prices are in Canadian dollars');

select * from finish();
rollback;
