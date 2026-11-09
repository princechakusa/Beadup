-- Countries: every App Store country Beadup is available in (US, Canada, UK,
-- Australia) works end to end. A detailer's country sets the currency their
-- prices are shown in and how their clients' local phone numbers are read.
-- Money stays integer minor units (cents/pence), so all pricing math is
-- unchanged.

-- Best guess from the IANA timezone the app already sends at onboarding, so
-- app builds that don't send a country still get the right one.
create function public.country_from_timezone(p_timezone text)
returns text language sql immutable set search_path = '' as $$
  select case
    when p_timezone like 'Australia/%' then 'AU'
    when p_timezone in ('Europe/London', 'Europe/Belfast', 'Europe/Guernsey', 'Europe/Isle_of_Man', 'Europe/Jersey', 'GB', 'GB-Eire')
      then 'GB'
    when p_timezone like 'Canada/%'
      or p_timezone in ('America/Toronto', 'America/Vancouver', 'America/Edmonton', 'America/Winnipeg', 'America/Halifax',
                        'America/St_Johns', 'America/Regina', 'America/Moncton', 'America/Glace_Bay', 'America/Goose_Bay',
                        'America/Whitehorse', 'America/Dawson', 'America/Dawson_Creek', 'America/Fort_Nelson',
                        'America/Creston', 'America/Yellowknife', 'America/Inuvik', 'America/Cambridge_Bay',
                        'America/Iqaluit', 'America/Rankin_Inlet', 'America/Resolute', 'America/Swift_Current',
                        'America/Atikokan', 'America/Blanc-Sablon', 'America/Nipigon', 'America/Thunder_Bay',
                        'America/Rainy_River', 'America/Pangnirtung', 'America/Montreal')
      then 'CA'
    else 'US'
  end;
$$;

-- ISO 4217 currency for a supported country (lowercase, like Stripe).
create function public.country_currency(p_country text)
returns text language sql immutable set search_path = '' as $$
  select case p_country when 'CA' then 'cad' when 'GB' then 'gbp' when 'AU' then 'aud' else 'usd' end;
$$;

alter table public.detailers add column country text;
update public.detailers set country = public.country_from_timezone(timezone);
alter table public.detailers
  alter column country set not null,
  add constraint detailers_country_supported check (country in ('US', 'CA', 'GB', 'AU'));

-- Fill the country on insert when the caller didn't send one (runs before
-- the NOT NULL check).
create function public.detailers_default_country()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.country := coalesce(new.country, public.country_from_timezone(new.timezone));
  return new;
end $$;

create trigger detailers_default_country
  before insert on public.detailers
  for each row execute function public.detailers_default_country();

-- Detailers can change their own country in Settings (RLS limits the row).
grant update (country) on public.detailers to authenticated;

revoke execute on function public.country_from_timezone(text) from public, anon;
revoke execute on function public.country_currency(text) from public, anon;
revoke execute on function public.detailers_default_country() from public, anon, authenticated;
grant execute on function public.country_from_timezone(text) to authenticated, service_role;
grant execute on function public.country_currency(text) to authenticated, service_role;

-- The public booking page now says which country and currency it's in.
create or replace function public.get_booking_page(p_handle text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'handle',       d.handle,
    'businessName', d.business_name,
    'tagline',      d.tagline,
    'serviceArea',  d.service_area,
    'timezone',     d.timezone,
    'country',      d.country,
    'currency',     upper(public.country_currency(d.country)),
    'rating',       r.rating,
    'reviewCount',  coalesce(r.review_count, 0),
    'payments',     public.payments_mode(),
    'paymentLink',  d.payment_link,
    'paymentNote',  d.payment_note,
    'services', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', s.id,
               'name', s.name,
               'description', s.description,
               'durationMin', s.duration_min,
               'priceCents', jsonb_build_object(
                 'sedan', s.price_sedan_cents,
                 'suv',   s.price_suv_cents,
                 'truck', s.price_truck_cents))
             order by s.sort_order, s.name)
      from public.services s
      where s.detailer_id = d.id and s.active), '[]'::jsonb),
    'addOns', coalesce((
      select jsonb_agg(jsonb_build_object('id', a.id, 'name', a.name, 'priceCents', a.price_cents)
             order by a.sort_order, a.name)
      from public.add_ons a
      where a.detailer_id = d.id and a.active), '[]'::jsonb),
    'weeklySlots', coalesce((
      select jsonb_object_agg(w.weekday::text, w.times)
      from (
        select v.weekday, jsonb_agg(to_char(v.start_time, 'HH24:MI') order by v.start_time) as times
        from public.availability_slots v
        where v.detailer_id = d.id
        group by v.weekday
      ) w), '{}'::jsonb),
    'taken', coalesce((
      select jsonb_agg(to_char(b.starts_at at time zone d.timezone, 'YYYY-MM-DD HH24:MI') order by b.starts_at)
      from public.bookings b
      where b.detailer_id = d.id
        and b.starts_at between now() and now() + interval '22 days'
        and (b.status = 'confirmed'
             or (b.status = 'pending_payment' and b.created_at >= now() - interval '30 minutes'))), '[]'::jsonb)
  )
  from public.detailers d
  left join lateral (
    select round(avg(rv.rating)::numeric, 1)::float8 as rating, count(*)::int as review_count
    from public.reviews rv
    where rv.detailer_id = d.id and not rv.hidden
  ) r on true
  where d.handle = lower(p_handle) and d.is_published;
$$;
