-- AI quote consent, drafts and private photo storage. Run: npx supabase test db
begin;
create extension if not exists pgtap with schema extensions;
select plan(10);

insert into auth.users (instance_id, id, aud, role, email, encrypted_password, created_at, updated_at) values
  ('00000000-0000-0000-0000-000000000000', '9a9a9a9a-0000-4000-8000-000000000000', 'authenticated', 'authenticated', 'ai1@test.local', '', now(), now()),
  ('00000000-0000-0000-0000-000000000000', '9b9b9b9b-0000-4000-8000-000000000000', 'authenticated', 'authenticated', 'ai2@test.local', '', now(), now());
insert into public.detailers (id, handle, business_name) values
  ('9a9a9a9a-0000-4000-8000-000000000000', 'ai-one', 'AI One'),
  ('9b9b9b9b-0000-4000-8000-000000000000', 'ai-two', 'AI Two');
insert into storage.objects (bucket_id, name, owner_id) values
  ('quote-photos', '9b9b9b9b-0000-4000-8000-000000000000/theirphoto0001.jpg', '9b9b9b9b-0000-4000-8000-000000000000');

set local role anon;
select throws_ok($$ select public.record_ai_consent() $$, '42501', null, 'anon cannot record consent');
reset role;

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"9a9a9a9a-0000-4000-8000-000000000000","role":"authenticated"}', true);
select lives_ok($$ select public.record_ai_consent() $$, 'a detailer records their own consent');
select throws_ok($$ select public.create_ai_draft_quote('9a9a9a9a-0000-4000-8000-000000000000', 'suv', 'x', '{}', '{}') $$,
  '42501', null, 'clients cannot create AI drafts');
select lives_ok(
  $$ insert into storage.objects (bucket_id, name, owner_id) values ('quote-photos', '9a9a9a9a-0000-4000-8000-000000000000/myphoto00001.jpg', '9a9a9a9a-0000-4000-8000-000000000000') $$,
  'a detailer can upload into their own folder');
select throws_ok(
  $$ insert into storage.objects (bucket_id, name, owner_id) values ('quote-photos', '9b9b9b9b-0000-4000-8000-000000000000/planted00001.jpg', '9a9a9a9a-0000-4000-8000-000000000000') $$,
  '42501', null, 'cannot upload into another detailer''s folder');
select results_eq($$ select name from storage.objects where bucket_id = 'quote-photos' $$,
  $$ values ('9a9a9a9a-0000-4000-8000-000000000000/myphoto00001.jpg') $$, 'a detailer sees only their own photos');
reset role;

select ok((select ai_consent_at is not null from public.detailers where id = '9a9a9a9a-0000-4000-8000-000000000000'), 'consent stored with a time');
select ok((select ai_consent_at is null from public.detailers where id = '9b9b9b9b-0000-4000-8000-000000000000'), 'other detailers are untouched');

set local role service_role;
select isnt(public.create_ai_draft_quote('9a9a9a9a-0000-4000-8000-000000000000', 'suv', 'White SUV', '{"note":"x"}', array['9a9a9a9a-0000-4000-8000-000000000000/myphoto00001.jpg']),
  null, 'server creates the AI draft');
reset role;

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"9a9a9a9a-0000-4000-8000-000000000000","role":"authenticated"}', true);
select throws_ok($$ update public.quotes set ai_suggestion = '{"tampered":true}' $$, '42501', null, 'the AI suggestion cannot be edited by the client');

select * from finish();
rollback;
