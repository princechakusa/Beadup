-- Referrals. Run: npx supabase test db
begin;
create extension if not exists pgtap with schema extensions;
select plan(16);

insert into auth.users (instance_id, id, aud, role, email, encrypted_password, created_at, updated_at) values
  ('00000000-0000-0000-0000-000000000000', 'a1a1a1a1-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'ref1@test.local', '', now(), now()),
  ('00000000-0000-0000-0000-000000000000', 'a1a1a1a1-0000-4000-8000-000000000002', 'authenticated', 'authenticated', 'ref2@test.local', '', now(), now()),
  ('00000000-0000-0000-0000-000000000000', 'a1a1a1a1-0000-4000-8000-000000000003', 'authenticated', 'authenticated', 'ref3@test.local', '', now(), now());

insert into public.detailers (id, handle, business_name, timezone, is_published) values
  ('a1a1a1a1-0000-4000-8000-000000000001', 'referrer-co', 'Referrer Co', 'America/Chicago', true),
  ('a1a1a1a1-0000-4000-8000-000000000002', 'new-shine', 'New Shine', 'America/Chicago', true),
  ('a1a1a1a1-0000-4000-8000-000000000003', 'old-gloss', 'Old Gloss', 'America/Chicago', true);
update public.detailers set created_at = now() - interval '40 days' where handle = 'old-gloss';

set local role anon;
select throws_ok($$ select public.claim_referral('referrer-co') $$, '42501', null, 'anon cannot claim referrals');
reset role;

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"a1a1a1a1-0000-4000-8000-000000000002","role":"authenticated"}', true);
select is(public.claim_referral('new-shine') ->> 'error', 'self', 'you cannot refer yourself');
select is(public.claim_referral('nobody-here') ->> 'error', 'not_found', 'unknown codes are refused');
select is(public.claim_referral('https://beadup.app/Referrer-Co') ->> 'ok', 'true', 'a pasted booking link works as the code');
select is(public.claim_referral('referrer-co') ->> 'error', 'already_claimed', 'one referral per account');
select is((public.referral_status() ->> 'referredBy'), 'referrer-co', 'the referred detailer sees who referred them');
select is((public.plan_usage() ->> 'plan'), 'free', 'no reward before a completed job');
select throws_ok($$ insert into public.referrals (referred_id, referrer_id) values ('a1a1a1a1-0000-4000-8000-000000000003', 'a1a1a1a1-0000-4000-8000-000000000001') $$,
  '42501', null, 'detailers cannot write referral rows directly');
select throws_ok($$ select public.grant_bonus_month('a1a1a1a1-0000-4000-8000-000000000002', 'cheat') $$,
  '42501', null, 'detailers cannot grant themselves Pro');
reset role;

-- The referred detailer completes their first job.
insert into public.clients (id, detailer_id, name, phone) values
  ('c1c1c1c1-0000-4000-8000-000000000001', 'a1a1a1a1-0000-4000-8000-000000000002', 'Pat Client', '+15125550199');
insert into public.bookings (id, detailer_id, client_id, service_name, vehicle_size, starts_at, duration_min, subtotal_cents, deposit_cents, booking_fee_cents, status, address)
values ('b1b1b1b1-0000-4000-8000-000000000001', 'a1a1a1a1-0000-4000-8000-000000000002', 'c1c1c1c1-0000-4000-8000-000000000001',
        'Full detail', 'sedan', now() - interval '3 hours', 120, 18000, 5400, 0, 'confirmed', '12 Oak St, Austin');
update public.bookings set status = 'completed' where id = 'b1b1b1b1-0000-4000-8000-000000000001';

select ok(public.detailer_is_pro('a1a1a1a1-0000-4000-8000-000000000002'), 'the new detailer gets a month of Pro');
select ok(public.detailer_is_pro('a1a1a1a1-0000-4000-8000-000000000001'), 'the referrer gets a month of Pro');
select ok((select bonus_pro_until from public.detailer_accounts where detailer_id = 'a1a1a1a1-0000-4000-8000-000000000001')
          between now() + interval '27 days' and now() + interval '32 days', 'the bonus is one month');
select isnt((select rewarded_at from public.referrals where referred_id = 'a1a1a1a1-0000-4000-8000-000000000002'), null, 'the referral is marked rewarded');

-- A second completed job doesn't pay again.
update public.bookings set status = 'confirmed' where id = 'b1b1b1b1-0000-4000-8000-000000000001';
update public.bookings set status = 'completed' where id = 'b1b1b1b1-0000-4000-8000-000000000001';
select is((select count(*)::int from public.audit_log where event = 'plan.bonus_month'), 2, 'each side is rewarded once');

-- Old accounts can't claim.
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"a1a1a1a1-0000-4000-8000-000000000003","role":"authenticated"}', true);
select is(public.claim_referral('referrer-co') ->> 'error', 'too_late', 'codes must be claimed within 30 days of signing up');
select set_config('request.jwt.claims', '{"sub":"a1a1a1a1-0000-4000-8000-000000000001","role":"authenticated"}', true);
select is((public.referral_status() ->> 'rewarded')::int, 1, 'the referrer sees one rewarded invite');
reset role;

select * from finish();
rollback;
