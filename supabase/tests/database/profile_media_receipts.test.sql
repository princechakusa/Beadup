-- Detailer photo, portfolio, receipts and the client link for the detailer.
begin;
create extension if not exists pgtap with schema extensions;
select plan(24);

insert into auth.users (instance_id, id, aud, role, email, encrypted_password, created_at, updated_at) values
  ('00000000-0000-0000-0000-000000000000', 'c8c8c8c8-0000-4000-8000-000000000000', 'authenticated', 'authenticated', 'c8@test.local', '', now(), now()),
  ('00000000-0000-0000-0000-000000000000', 'd8d8d8d8-0000-4000-8000-000000000000', 'authenticated', 'authenticated', 'd8@test.local', '', now(), now());
insert into public.detailers (id, handle, business_name, timezone, is_published, contact_phone) values
  ('c8c8c8c8-0000-4000-8000-000000000000', 'test-c8', 'C8 Detail', 'Africa/Johannesburg', true, '+27821234567'),
  ('d8d8d8d8-0000-4000-8000-000000000000', 'test-d8', 'D8 Detail', 'UTC', false, null);
insert into public.clients (id, detailer_id, name, phone) values
  ('c8c8c8c8-0000-4000-8000-0000000000c1', 'c8c8c8c8-0000-4000-8000-000000000000', 'Thandi Mokoena', '+27821234500');
insert into public.bookings (id, detailer_id, client_id, service_name, vehicle_size, add_ons, starts_at, duration_min, address,
                             subtotal_cents, deposit_cents, status, review_token, client_token) values
  ('c8c8c8c8-0000-4000-8000-0000000000b1', 'c8c8c8c8-0000-4000-8000-000000000000', 'c8c8c8c8-0000-4000-8000-0000000000c1',
   'Full detail', 'suv', '[{"name":"Pet hair","priceCents":35000}]', now() - interval '1 day', 180, '9 Private Rd',
   150000, 45000, 'completed', repeat('e', 48), repeat('f', 48));

-- Country from the timezone: South Africa, rands.
select is((select country from public.detailers where handle = 'test-c8'), 'ZA', 'Johannesburg timezone -> ZA');
select is(public.country_currency('ZA'), 'zar', 'ZA -> rand');

-- ---------------------------------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"c8c8c8c8-0000-4000-8000-000000000000","role":"authenticated"}', true);

select lives_ok($$ update public.detailers set photo_path = 'c8c8c8c8-0000-4000-8000-000000000000/abcdefabcdef12.jpg' $$, 'own photo path accepted');
select throws_ok($$ update public.detailers set photo_path = 'd8d8d8d8-0000-4000-8000-000000000000/abcdefabcdef12.jpg' $$,
  '23514', null, 'photo path in someone else''s folder refused');
select throws_ok($$ update public.detailers set photo_path = 'c8c8c8c8-0000-4000-8000-000000000000/../x.jpg' $$,
  '23514', null, 'path tricks refused');

select lives_ok($$ insert into public.portfolio_items (detailer_id, path, caption)
  select 'c8c8c8c8-0000-4000-8000-000000000000', 'c8c8c8c8-0000-4000-8000-000000000000/work' || lpad(g::text, 8, '0') || '.jpg', 'Job ' || g
  from generate_series(1, 12) g $$, 'twelve portfolio photos');
select throws_ok($$ insert into public.portfolio_items (detailer_id, path) values
  ('c8c8c8c8-0000-4000-8000-000000000000', 'c8c8c8c8-0000-4000-8000-000000000000/work00000013.jpg') $$,
  'P0001', null, 'a thirteenth is refused');
select throws_ok($$ insert into public.portfolio_items (detailer_id, path) values
  ('d8d8d8d8-0000-4000-8000-000000000000', 'd8d8d8d8-0000-4000-8000-000000000000/work00000001.jpg') $$,
  '42501', null, 'cannot add to another detailer''s portfolio');
select lives_ok($$ update public.portfolio_items set caption = 'Ceramic, black Hilux' where caption = 'Job 1' $$, 'edit own caption');
select throws_ok($$ update public.portfolio_items set path = 'c8c8c8c8-0000-4000-8000-000000000000/other0000001.jpg' $$,
  '42501', null, 'path cannot be swapped after upload');
select is(public.client_link_token('c8c8c8c8-0000-4000-8000-0000000000b1'), repeat('f', 48), 'owner gets the client link token');

-- Storage: own folder only.
select lives_ok($$ insert into storage.objects (bucket_id, name, owner_id) values
  ('profile-media', 'c8c8c8c8-0000-4000-8000-000000000000/abcdefabcdef12.jpg', 'c8c8c8c8-0000-4000-8000-000000000000') $$, 'upload to own folder');
select throws_ok($$ insert into storage.objects (bucket_id, name, owner_id) values
  ('profile-media', 'd8d8d8d8-0000-4000-8000-000000000000/planted00001.jpg', 'c8c8c8c8-0000-4000-8000-000000000000') $$,
  '42501', null, 'cannot upload into another detailer''s folder');

-- The other detailer.
select set_config('request.jwt.claims', '{"sub":"d8d8d8d8-0000-4000-8000-000000000000","role":"authenticated"}', true);
select is_empty('select id from public.portfolio_items', 'D8 sees no one else''s portfolio');
select is(public.client_link_token('c8c8c8c8-0000-4000-8000-0000000000b1'), null, 'D8 cannot get C8''s client link');
select is_empty($$ select name from storage.objects where bucket_id = 'profile-media' $$, 'D8 cannot list C8''s files');

-- ---------------------------------------------------------------------------
reset role;
set local role anon;
select is(public.get_booking_page('test-c8') ->> 'photo', left(md5('c8c8c8c8-0000-4000-8000-000000000000/abcdefabcdef12.jpg'), 10),
          'page has a photo version, not the path');
select is(jsonb_array_length(public.get_booking_page('test-c8') -> 'portfolio'), 12, 'page lists the portfolio');
select ok(public.get_booking_page('test-c8')::text !~ 'c8c8c8c8-0000-4000-8000-000000000000/', 'no storage paths or user id on the page');
select throws_ok($$ select public.media_path('test-c8') $$, '42501', null, 'anon cannot resolve media paths directly');
select throws_ok($$ select public.receipt_context(repeat('e', 48)) $$, '42501', null, 'anon cannot read receipts directly');

reset role;
set local role service_role;
select is(public.media_path('test-d8'), null, 'unpublished detailer: no media');
select is(public.receipt_context(repeat('e', 48)) ->> 'firstName', 'Thandi', 'receipt: first name only');
select ok(public.receipt_context(repeat('e', 48))::text !~ 'Private Rd|\+27821234500|Mokoena', 'receipt: no address, phone or surname');
reset role;

select * from finish();
rollback;
