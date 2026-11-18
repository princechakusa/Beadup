-- Directory: published, listed businesses with an active service; public fields only.
begin;
create extension if not exists pgtap with schema extensions;
select plan(17);

insert into auth.users (instance_id, id, aud, role, email, encrypted_password, created_at, updated_at) values
  ('00000000-0000-0000-0000-000000000000', 'f9f9f9f9-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'f91@test.local', '', now(), now()),
  ('00000000-0000-0000-0000-000000000000', 'f9f9f9f9-0000-4000-8000-000000000002', 'authenticated', 'authenticated', 'f92@test.local', '', now(), now()),
  ('00000000-0000-0000-0000-000000000000', 'f9f9f9f9-0000-4000-8000-000000000003', 'authenticated', 'authenticated', 'f93@test.local', '', now(), now());
insert into public.detailers (id, handle, business_name, timezone, is_published, trade, service_area, contact_phone, listed, directory_approved) values
  ('f9f9f9f9-0000-4000-8000-000000000001', 'dir-barber', 'Zed Cuts', 'Africa/Johannesburg', true, 'barber', 'Soweto, Johannesburg', '+27821234567', true, true),
  ('f9f9f9f9-0000-4000-8000-000000000002', 'dir-hidden', 'Hidden Cuts', 'Africa/Johannesburg', true, 'barber', 'Soweto', null, false, true),
  ('f9f9f9f9-0000-4000-8000-000000000003', 'dir-salon', 'Amara Hair 100%', 'Asia/Dubai', true, 'hair_salon', 'Dubai Marina', null, true, true);
insert into public.services (detailer_id, name, duration_min, price_sedan_cents, price_suv_cents, price_truck_cents) values
  ('f9f9f9f9-0000-4000-8000-000000000001', 'Cut', 45, 12000, 12000, 12000),
  ('f9f9f9f9-0000-4000-8000-000000000001', 'Beard', 30, 8000, 8000, 8000),
  ('f9f9f9f9-0000-4000-8000-000000000002', 'Cut', 45, 10000, 10000, 10000),
  ('f9f9f9f9-0000-4000-8000-000000000003', 'Braids', 240, 60000, 60000, 60000);

set local role anon;
select ok(public.get_directory() @> '[{"handle":"dir-barber"}]', 'listed business appears');
select ok(not (public.get_directory() @> '[{"handle":"dir-hidden"}]'), 'unlisted business does not');
select ok(not exists (select 1 from jsonb_array_elements(public.get_directory('barber', 'ZA', null)) e
                      where e ->> 'trade' <> 'barber' or e ->> 'country' <> 'ZA')
          and public.get_directory('barber', 'ZA', null) @> '[{"handle":"dir-barber"}]', 'trade + country filter');
select is((select e ->> 'fromCents' from jsonb_array_elements(public.get_directory('barber', 'ZA', 'soweto')) e where e ->> 'handle' = 'dir-barber'), '8000', 'lowest price shown');
select is(jsonb_array_length(public.get_directory(null, null, 'Marina')), 1, 'search by area');
select is(jsonb_array_length(public.get_directory(null, null, '%')), jsonb_array_length(public.get_directory()), 'wildcards are ignored in search');
select ok(public.get_directory()::text !~ '\+27821234567', 'no phone numbers in the directory');
reset role;
select is(public.handle_available('find'), false, '"find" is reserved');
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"f9f9f9f9-0000-4000-8000-000000000001","role":"authenticated"}', true);
select lives_ok($$ update public.detailers set listed = false $$, 'a business can leave the directory');
reset role;

-- Curated directory: approval is required (owner, service role only).
update public.detailers set listed = true where id = 'f9f9f9f9-0000-4000-8000-000000000001';
update public.detailers set directory_approved = false where id = 'f9f9f9f9-0000-4000-8000-000000000003';
select ok(not (public.get_directory() @> '[{"handle":"dir-salon"}]'), 'an unapproved business is not listed');

-- Payment links: no host tricks, and every change is audited.
select lives_ok($$ update public.detailers set payment_link = 'https://paypal.me/zedcuts' where id = 'f9f9f9f9-0000-4000-8000-000000000001' $$, 'a plain payment link is accepted');
select lives_ok($$ update public.detailers set payment_link = 'https://cash.app/$zedcuts' where id = 'f9f9f9f9-0000-4000-8000-000000000001' $$, 'cash.app/$tag is accepted');
select throws_ok($$ update public.detailers set payment_link = 'https://paypal.me@evil.example/pay' where id = 'f9f9f9f9-0000-4000-8000-000000000001' $$, '23514', null, 'user@host trick is refused');
select throws_ok($$ update public.detailers set payment_link = 'https://xn--pypal-4ve.com/pay' where id = 'f9f9f9f9-0000-4000-8000-000000000001' $$, '23514', null, 'punycode look-alike is refused');
select throws_ok($$ update public.detailers set payment_link = 'https://bit.ly/3abcde' where id = 'f9f9f9f9-0000-4000-8000-000000000001' $$, '23514', null, 'link shorteners are refused');
select throws_ok($$ update public.detailers set payment_link = 'https://192.168.0.1/pay' where id = 'f9f9f9f9-0000-4000-8000-000000000001' $$, '23514', null, 'raw IP addresses are refused');
select is((select count(*)::int from public.audit_log where detailer_id = 'f9f9f9f9-0000-4000-8000-000000000001' and event = 'payment_details.changed'), 2, 'payment changes are audited');

select * from finish();
rollback;
