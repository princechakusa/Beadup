-- Directory (owner request 2026-11-12): beadup.app/find lists published
-- businesses by trade and place, so clients can discover them. Businesses can
-- leave it (detailers.listed). Only what the booking page already shows
-- publicly: name, trade, area, rating, photo, lowest price.

alter table public.detailers add column listed boolean not null default true;
grant update (listed) on public.detailers to authenticated;

create function public.get_directory(p_trade text default null, p_country text default null, p_query text default null, p_limit integer default 60)
returns jsonb language sql stable security definer set search_path = '' as $$
  with q as (
    select nullif(trim(regexp_replace(coalesce(p_query, ''), '[%_\\]', '', 'g')), '') as text
  )
  select coalesce(jsonb_agg(y.x order by y.rank_rating desc nulls last, y.rank_reviews desc, y.created_at), '[]'::jsonb)
  from (
    select jsonb_build_object(
             'handle', d.handle,
             'businessName', d.business_name,
             'trade', d.trade,
             'serviceArea', d.service_area,
             'tagline', d.tagline,
             'country', d.country,
             'currency', upper(public.country_currency(d.country)),
             'rating', r.rating,
             'reviewCount', coalesce(r.n, 0),
             'photo', case when d.photo_path is null then null else left(md5(d.photo_path), 10) end,
             'fromCents', (select min(least(s.price_sedan_cents, s.price_suv_cents, s.price_truck_cents))
                             from public.services s where s.detailer_id = d.id and s.active)) as x_json,
           r.rating as rank_rating, coalesce(r.n, 0) as rank_reviews, d.created_at
    from public.detailers d
    cross join q
    left join lateral (
      select round(avg(rv.rating)::numeric, 1)::float8 as rating, count(*)::int as n
      from public.reviews rv where rv.detailer_id = d.id and not rv.hidden
    ) r on true
    where d.is_published and d.listed
      and exists (select 1 from public.services s where s.detailer_id = d.id and s.active)
      and (p_trade is null or d.trade = p_trade)
      and (p_country is null or d.country = upper(p_country))
      and (q.text is null
           or d.business_name ilike '%' || q.text || '%'
           or d.service_area ilike '%' || q.text || '%'
           or d.tagline ilike '%' || q.text || '%')
    order by r.rating desc nulls last, coalesce(r.n, 0) desc, d.created_at
    limit least(greatest(coalesce(p_limit, 60), 1), 100)
  ) y(x, rank_rating, rank_reviews, created_at);
$$;
revoke all on function public.get_directory(text, text, text, integer) from public;
grant execute on function public.get_directory(text, text, text, integer) to anon, authenticated, service_role;

-- /find is a website page.
alter table public.detailers drop constraint detailers_handle_reserved;
alter table public.detailers add constraint detailers_handle_reserved
  check (handle not in ('api', 'app', 'admin', 'login', 'signup', 'settings', 'pricing', 'privacy', 'terms',
                        'support', 'help', 'delete-account', 'about', 'blog', 'pro', 'book', 'auth', 'webhooks',
                        'www', 'beadup', 'stripe', 'connect', 'billing', 'account', 'dashboard', 'legal', 'for', 'r', 'b', 'm',
                        'refund-policy', 'find'))
  not valid;

create or replace function public.handle_available(p_handle text)
returns boolean language sql stable security definer set search_path = '' as $$
  select lower(p_handle) ~ '^[a-z0-9][a-z0-9-]{1,39}$'
     and lower(p_handle) not in ('api', 'app', 'admin', 'login', 'signup', 'settings', 'pricing', 'privacy', 'terms',
                                 'support', 'help', 'delete-account', 'about', 'blog', 'pro', 'book', 'auth', 'webhooks',
                                 'www', 'beadup', 'stripe', 'connect', 'billing', 'account', 'dashboard', 'legal', 'for',
                                 'refund-policy', 'find')
     and not exists (select 1 from public.detailers where handle = lower(p_handle));
$$;
