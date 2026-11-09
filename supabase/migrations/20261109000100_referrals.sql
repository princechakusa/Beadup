-- Referrals: "Invite a detailer, you both get a month of Pro."
-- * The invite code is the referrer's handle.
-- * A new detailer claims a code once, within 30 days of signing up, never
--   their own.
-- * The reward is granted when the referred detailer completes their first
--   job, so empty sign-ups can't farm free months. Both get one month of
--   bonus Pro, stacked on top of any time they already have. A referrer
--   earns at most 12 months this way.
-- Bonus Pro is Beadup's own grant, separate from store subscriptions (which
-- stay webhook-only): detailer_is_pro() honours either.

alter table public.detailer_accounts add column bonus_pro_until timestamptz;

create table public.referrals (
  referred_id uuid primary key references public.detailers (id) on delete cascade,
  referrer_id uuid not null references public.detailers (id) on delete cascade,
  created_at  timestamptz not null default now(),
  rewarded_at timestamptz,
  check (referrer_id <> referred_id)
);
create index referrals_referrer_idx on public.referrals (referrer_id);

alter table public.referrals enable row level security;
-- Either side can see their own referral rows (counts in the app). Writes go
-- through the functions below only.
create policy referrals_party_select on public.referrals for select to authenticated
  using (referrer_id = (select auth.uid()) or referred_id = (select auth.uid()));
revoke all on public.referrals from public, anon, authenticated;
grant select on public.referrals to authenticated;
grant all on public.referrals to service_role;

create or replace function public.detailer_is_pro(p_detailer_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.detailer_accounts
    where detailer_id = p_detailer_id
      and ((plan = 'pro' and (plan_renews_at is null or plan_renews_at > now()))
           or bonus_pro_until > now())
  );
$$;

-- One month of bonus Pro, starting from whichever is later: now, the end of
-- any bonus already granted, or the end of the current paid period.
create function public.grant_bonus_month(p_detailer_id uuid, p_reason text)
returns void language plpgsql volatile security definer set search_path = '' as $$
begin
  insert into public.detailer_accounts (detailer_id) values (p_detailer_id) on conflict (detailer_id) do nothing;
  update public.detailer_accounts
     set bonus_pro_until = greatest(now(), coalesce(bonus_pro_until, now()),
                                    case when plan = 'pro' then coalesce(plan_renews_at, now()) else now() end)
                           + interval '1 month'
   where detailer_id = p_detailer_id;
  insert into public.audit_log (detailer_id, actor, event, data)
  values (p_detailer_id, 'beadup', 'plan.bonus_month', jsonb_build_object('reason', p_reason));
end $$;

-- The signed-in detailer enters who referred them (a handle, or a booking
-- link that ends in one).
create function public.claim_referral(p_code text)
returns jsonb language plpgsql volatile security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_handle text := lower(regexp_replace(trim(coalesce(p_code, '')), '^.*/', ''));
  v_referrer uuid;
  v_joined timestamptz;
begin
  if v_uid is null then raise exception 'not signed in' using errcode = '42501'; end if;
  select created_at into v_joined from public.detailers where id = v_uid;
  if not found then return jsonb_build_object('ok', false, 'error', 'no_profile'); end if;
  if exists (select 1 from public.referrals where referred_id = v_uid) then
    return jsonb_build_object('ok', false, 'error', 'already_claimed');
  end if;
  if v_joined < now() - interval '30 days' then return jsonb_build_object('ok', false, 'error', 'too_late'); end if;
  select id into v_referrer from public.detailers where handle = v_handle;
  if v_referrer is null then return jsonb_build_object('ok', false, 'error', 'not_found'); end if;
  if v_referrer = v_uid then return jsonb_build_object('ok', false, 'error', 'self'); end if;

  insert into public.referrals (referred_id, referrer_id) values (v_uid, v_referrer);
  insert into public.audit_log (detailer_id, actor, event, data)
  values (v_uid, v_uid::text, 'referral.claimed', jsonb_build_object('referrer', v_referrer));
  -- Already finished a job before claiming: reward straight away.
  perform public.reward_referral(v_uid);
  return jsonb_build_object('ok', true);
end $$;

-- Grants both months once the referred detailer has a completed job.
create function public.reward_referral(p_referred_id uuid)
returns void language plpgsql volatile security definer set search_path = '' as $$
declare r public.referrals%rowtype;
begin
  select * into r from public.referrals where referred_id = p_referred_id and rewarded_at is null for update;
  if not found then return; end if;
  if not exists (select 1 from public.bookings where detailer_id = p_referred_id and status = 'completed') then return; end if;

  update public.referrals set rewarded_at = now() where referred_id = p_referred_id;
  perform public.grant_bonus_month(p_referred_id, 'referred');
  if (select count(*) from public.referrals where referrer_id = r.referrer_id and rewarded_at is not null) <= 12 then
    perform public.grant_bonus_month(r.referrer_id, 'referral');
  end if;
end $$;

create function public.bookings_reward_referral()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  perform public.reward_referral(new.detailer_id);
  return null;
end $$;

create trigger bookings_reward_referral
  after update of status on public.bookings
  for each row when (new.status = 'completed' and old.status is distinct from 'completed')
  execute function public.bookings_reward_referral();

-- What the app shows on the Invite screen.
create function public.referral_status()
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'code', d.handle,
    'invited', (select count(*) from public.referrals where referrer_id = d.id),
    'rewarded', (select count(*) from public.referrals where referrer_id = d.id and rewarded_at is not null),
    'bonusProUntil', (select bonus_pro_until from public.detailer_accounts where detailer_id = d.id),
    'referredBy', (select x.handle from public.referrals r join public.detailers x on x.id = r.referrer_id where r.referred_id = d.id),
    'canClaim', not exists (select 1 from public.referrals where referred_id = d.id) and d.created_at >= now() - interval '30 days')
  from public.detailers d where d.id = auth.uid();
$$;

revoke execute on function public.grant_bonus_month(uuid, text), public.claim_referral(text), public.reward_referral(uuid),
  public.bookings_reward_referral(), public.referral_status() from public, anon, authenticated;
grant execute on function public.claim_referral(text), public.referral_status() to authenticated;
grant execute on function public.grant_bonus_month(uuid, text), public.reward_referral(uuid) to service_role;
