-- AI consent is per provider. Run: npx supabase test db
begin;
create extension if not exists pgtap with schema extensions;
select plan(5);

insert into auth.users (instance_id, id, aud, role, email, encrypted_password, created_at, updated_at) values
  ('00000000-0000-0000-0000-000000000000', '5e5e5e5e-0000-4000-8000-000000000000', 'authenticated', 'authenticated', 'p@test.local', '', now(), now());
insert into public.detailers (id, handle, business_name) values ('5e5e5e5e-0000-4000-8000-000000000000', 'prov-test', 'Prov');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"5e5e5e5e-0000-4000-8000-000000000000","role":"authenticated"}', true);
select is(public.ai_consent_status() ->> 'consented', 'false', 'no consent at first');
select public.record_ai_consent();
select is(public.ai_consent_status(), '{"provider": "openai", "consented": true}'::jsonb, 'consent is for the current provider');
reset role;

update public.plan_config set value = '"anthropic"' where key = 'ai_provider';
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"5e5e5e5e-0000-4000-8000-000000000000","role":"authenticated"}', true);
select is(public.ai_consent_status(), '{"provider": "anthropic", "consented": false}'::jsonb, 'switching provider requires new consent');
select public.revoke_ai_consent();
reset role;
select ok((select ai_consent_at is null and ai_consent_provider is null from public.detailers where id = '5e5e5e5e-0000-4000-8000-000000000000'), 'revoking clears consent');
select throws_ok($$ set local role anon; select public.ai_consent_status(); $$, '42501', null, 'anon cannot read consent status');

select * from finish();
rollback;
