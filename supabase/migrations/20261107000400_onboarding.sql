-- Detailer onboarding: handle availability and one atomic profile setup.

-- Other detailers' rows are hidden by RLS, so the app asks this instead.
-- Reveals only whether a handle is free (the same thing visiting
-- beadup.app/<handle> reveals).
create function public.handle_available(p_handle text)
returns boolean language sql stable security definer set search_path = '' as $$
  select lower(p_handle) ~ '^[a-z0-9][a-z0-9-]{1,39}$'
     and lower(p_handle) not in ('api', 'app', 'admin', 'login', 'signup', 'settings', 'pricing', 'privacy', 'terms',
                                 'support', 'help', 'delete-account', 'about', 'blog', 'pro', 'book', 'auth', 'webhooks',
                                 'www', 'beadup', 'stripe', 'connect', 'billing', 'account', 'dashboard', 'legal')
     and not exists (select 1 from public.detailers where handle = lower(p_handle));
$$;

/*
 * Creates the signed-in user's business in one transaction: profile,
 * services, add-ons and weekly start times, then publishes the booking page.
 * Table constraints validate every value. Fails if a profile already exists.
 *
 * p_services:  [{"name","description","durationMin","priceCents":{"sedan","suv","truck"}}]
 * p_add_ons:   [{"name","priceCents"}]
 * p_slots:     [{"weekday":0-6,"time":"HH:MM"}]
 */
create function public.create_detailer_profile(
  p_handle text, p_business_name text, p_service_area text, p_timezone text,
  p_services jsonb, p_add_ons jsonb, p_slots jsonb
) returns jsonb language plpgsql volatile security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'not signed in' using errcode = '42501'; end if;
  if exists (select 1 from public.detailers where id = v_uid) then
    return jsonb_build_object('ok', false, 'error', 'exists');
  end if;
  if not public.handle_available(p_handle) then
    return jsonb_build_object('ok', false, 'error', 'handle_taken');
  end if;
  if not exists (select 1 from pg_timezone_names where name = p_timezone) then
    return jsonb_build_object('ok', false, 'error', 'timezone');
  end if;
  if jsonb_typeof(p_services) <> 'array' or jsonb_array_length(p_services) not between 1 and 20
     or jsonb_typeof(p_add_ons) <> 'array' or jsonb_array_length(p_add_ons) > 20
     or jsonb_typeof(p_slots) <> 'array' or jsonb_array_length(p_slots) > 200 then
    return jsonb_build_object('ok', false, 'error', 'invalid');
  end if;

  insert into public.detailers (id, handle, business_name, service_area, timezone, tagline, is_published)
  values (v_uid, lower(p_handle), trim(p_business_name), trim(coalesce(p_service_area, '')), p_timezone,
          'Mobile detailing · we come to you', false);

  insert into public.services (detailer_id, name, description, duration_min,
                               price_sedan_cents, price_suv_cents, price_truck_cents, sort_order)
  select v_uid, trim(s ->> 'name'), trim(coalesce(s ->> 'description', '')), (s ->> 'durationMin')::int,
         (s -> 'priceCents' ->> 'sedan')::int, (s -> 'priceCents' ->> 'suv')::int, (s -> 'priceCents' ->> 'truck')::int,
         ord::int
  from jsonb_array_elements(p_services) with ordinality as t(s, ord);

  insert into public.add_ons (detailer_id, name, price_cents, sort_order)
  select v_uid, trim(a ->> 'name'), (a ->> 'priceCents')::int, ord::int
  from jsonb_array_elements(p_add_ons) with ordinality as t(a, ord);

  insert into public.availability_slots (detailer_id, weekday, start_time)
  select distinct v_uid, (x ->> 'weekday')::smallint, (x ->> 'time')::time
  from jsonb_array_elements(p_slots) as t(x);

  update public.detailers set is_published = true where id = v_uid;
  insert into public.audit_log (detailer_id, actor, event, data)
  values (v_uid, v_uid::text, 'account.onboarded', jsonb_build_object('handle', lower(p_handle)));
  return jsonb_build_object('ok', true, 'handle', lower(p_handle));
exception
  -- A constraint (lengths, prices, reserved handle) or a race on the handle.
  when check_violation or unique_violation or invalid_text_representation or not_null_violation or numeric_value_out_of_range then
    return jsonb_build_object('ok', false, 'error', 'invalid');
end $$;

revoke execute on function public.handle_available(text) from public, anon;
revoke execute on function public.create_detailer_profile(text, text, text, text, jsonb, jsonb, jsonb) from public, anon;
grant execute on function public.handle_available(text) to authenticated;
grant execute on function public.create_detailer_profile(text, text, text, text, jsonb, jsonb, jsonb) to authenticated;
