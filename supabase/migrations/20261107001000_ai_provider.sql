-- Owner decision 2026-11-07: AI photo quotes use OpenAI (the owner's key).
-- The provider is config, read by the server (which model to call), the app
-- (consent screen wording) and the privacy policy. Consent is recorded per
-- provider: switching provider asks the detailer again (Apple 5.1.2(i)).

insert into public.plan_config (key, value) values ('ai_provider', '"openai"')
on conflict (key) do update set value = excluded.value, updated_at = now();

alter table public.detailers add column ai_consent_provider text;
update public.detailers set ai_consent_provider = 'anthropic' where ai_consent_at is not null;

create or replace function public.current_ai_provider()
returns text language sql stable security definer set search_path = '' as $$
  select coalesce((select value #>> '{}' from public.plan_config where key = 'ai_provider'), 'openai');
$$;

create or replace function public.record_ai_consent()
returns void language sql volatile security definer set search_path = '' as $$
  update public.detailers
     set ai_consent_at = now(), ai_consent_provider = public.current_ai_provider()
   where id = auth.uid();
  insert into public.audit_log (detailer_id, actor, event, data)
  select auth.uid(), auth.uid()::text, 'ai.consent_given', jsonb_build_object('provider', public.current_ai_provider())
  where auth.uid() is not null;
$$;

create or replace function public.revoke_ai_consent()
returns void language sql volatile security definer set search_path = '' as $$
  update public.detailers set ai_consent_at = null, ai_consent_provider = null where id = auth.uid();
  insert into public.audit_log (detailer_id, actor, event)
  select auth.uid(), auth.uid()::text, 'ai.consent_revoked' where auth.uid() is not null;
$$;

-- For the app: which provider photos go to, and whether this detailer has
-- consented to that provider.
create function public.ai_consent_status()
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'provider', public.current_ai_provider(),
    'consented', d.ai_consent_at is not null and d.ai_consent_provider = public.current_ai_provider())
  from public.detailers d where d.id = auth.uid();
$$;

revoke execute on function public.current_ai_provider(), public.ai_consent_status() from public, anon;
grant execute on function public.ai_consent_status() to authenticated;
grant execute on function public.current_ai_provider() to service_role;
