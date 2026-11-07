-- M7: Pro subscription (in-app purchase via RevenueCat) and the free-plan
-- monthly booking limit. The plan is written only by the RevenueCat webhook;
-- the limit comes from plan_config.

alter table public.processed_events drop constraint processed_events_source_check;
alter table public.processed_events add constraint processed_events_source_check
  check (source in ('stripe', 'twilio', 'revenuecat'));

alter table public.detailer_accounts add column plan_event_at timestamptz;

create function public.detailer_is_pro(p_detailer_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.detailer_accounts
    where detailer_id = p_detailer_id and plan = 'pro' and (plan_renews_at is null or plan_renews_at > now())
  );
$$;

create function public.free_booking_limit()
returns integer language sql stable security definer set search_path = '' as $$
  select coalesce((select (value #>> '{}')::int from public.plan_config where key = 'free_bookings_per_month'), 5);
$$;

-- RevenueCat webhook effect. Idempotent per event id; events older than the
-- last applied one are ignored so out-of-order delivery can't flip the plan.
create function public.apply_subscription_event(p_event_id text, p_detailer_id uuid, p_active boolean,
                                                p_expires_at timestamptz, p_event_at timestamptz, p_type text)
returns text language plpgsql volatile security definer set search_path = '' as $$
declare v_inserted integer;
begin
  insert into public.processed_events (id, source) values (p_event_id, 'revenuecat') on conflict do nothing;
  get diagnostics v_inserted = row_count;
  if v_inserted = 0 then return 'duplicate'; end if;
  if not exists (select 1 from public.detailers where id = p_detailer_id) then return 'ignored'; end if;

  insert into public.detailer_accounts (detailer_id) values (p_detailer_id) on conflict (detailer_id) do nothing;
  update public.detailer_accounts set
    plan = case when p_active then 'pro'::public.plan_tier else 'free'::public.plan_tier end,
    plan_renews_at = case when p_active then p_expires_at else null end,
    plan_event_at = p_event_at
  where detailer_id = p_detailer_id and (plan_event_at is null or plan_event_at <= p_event_at);
  if not found then return 'stale'; end if;

  insert into public.audit_log (detailer_id, actor, event, data)
  values (p_detailer_id, 'revenuecat', 'plan.' || case when p_active then 'pro' else 'free' end,
          jsonb_build_object('type', left(p_type, 40), 'expires_at', p_expires_at));
  return 'applied';
end $$;

-- What the app shows: plan, bookings used this month, the free limit.
create function public.plan_usage()
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'plan', case when public.detailer_is_pro(d.id) then 'pro' else 'free' end,
    'limit', public.free_booking_limit(),
    'used', (select count(*) from public.bookings b
              where b.detailer_id = d.id
                and (b.created_at at time zone d.timezone) >= date_trunc('month', now() at time zone d.timezone)
                and b.status in ('confirmed', 'completed', 'no_show')))
  from public.detailers d where d.id = auth.uid();
$$;

revoke execute on function public.detailer_is_pro(uuid), public.free_booking_limit(),
  public.apply_subscription_event(text, uuid, boolean, timestamptz, timestamptz, text), public.plan_usage()
  from public, anon, authenticated;
grant execute on function public.apply_subscription_event(text, uuid, boolean, timestamptz, timestamptz, text) to service_role;
grant execute on function public.plan_usage() to authenticated;

-- Booking creation now enforces the free-plan limit (same body as before plus
-- the plan_limit check).

