-- Push token isolation. Run: npx supabase test db
begin;
create extension if not exists pgtap with schema extensions;
select plan(6);

insert into auth.users (instance_id, id, aud, role, email, encrypted_password, created_at, updated_at) values
  ('00000000-0000-0000-0000-000000000000', '12121212-0000-4000-8000-000000000000', 'authenticated', 'authenticated', 'p1@test.local', '', now(), now()),
  ('00000000-0000-0000-0000-000000000000', '34343434-0000-4000-8000-000000000000', 'authenticated', 'authenticated', 'p2@test.local', '', now(), now());
insert into public.detailers (id, handle, business_name) values
  ('12121212-0000-4000-8000-000000000000', 'push-a', 'Push A'),
  ('34343434-0000-4000-8000-000000000000', 'push-b', 'Push B');
insert into public.push_tokens (token, detailer_id, platform) values
  ('ExponentPushToken[bbbbbbbbbbbbbbbbbbbbbb]', '34343434-0000-4000-8000-000000000000', 'ios');

set local role anon;
select throws_ok($$ select * from public.push_tokens $$, '42501', null, 'anon cannot read push tokens');
reset role;

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"12121212-0000-4000-8000-000000000000","role":"authenticated"}', true);
select lives_ok(
  $$ insert into public.push_tokens (token, detailer_id, platform) values ('ExponentPushToken[aaaaaaaaaaaaaaaaaaaaaa]', '12121212-0000-4000-8000-000000000000', 'android') $$,
  'a detailer registers their own device');
select results_eq($$ select token from public.push_tokens $$, $$ values ('ExponentPushToken[aaaaaaaaaaaaaaaaaaaaaa]') $$,
  'a detailer sees only their own tokens');
select throws_ok(
  $$ insert into public.push_tokens (token, detailer_id, platform) values ('ExponentPushToken[cccccccccccccccccccccc]', '34343434-0000-4000-8000-000000000000', 'ios') $$,
  '42501', null, 'cannot register a token for another detailer');
select throws_ok(
  $$ insert into public.push_tokens (token, detailer_id, platform) values ('not-a-token', '12121212-0000-4000-8000-000000000000', 'ios') $$,
  '23514', null, 'malformed tokens are rejected');
select is_empty(
  $$ delete from public.push_tokens where token = 'ExponentPushToken[bbbbbbbbbbbbbbbbbbbbbb]' returning token $$,
  'cannot remove another detailer''s token');

select * from finish();
rollback;
