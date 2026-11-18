-- 2026-11-18 owner feedback:
-- 1. /find showed tester accounts. The directory is now curated: a business
--    appears only when the owner approves it (directory_approved, service role
--    only) AND the business has not opted out (listed). Existing rows start
--    unapproved.
-- 2. Payment links: stricter shape so a link cannot hide its real host
--    (user:pass@ tricks, punycode look-alikes, raw IPs, URL shorteners), and
--    every change to the link or note is written to audit_log.

alter table public.detailers add column directory_approved boolean not null default false;
-- No grant to authenticated: only server code with the service role can set it.

create or replace function public.get_directory(p_trade text default null, p_country text default null, p_query text default null, p_limit integer default 60)
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
    where d.is_published and d.listed and d.directory_approved
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

-- Payment link shape. NOT VALID: old rows are left alone, every new write is checked.
alter table public.detailers drop constraint detailers_payment_link_check;
alter table public.detailers add constraint detailers_payment_link_check check (
  payment_link is null or (
    char_length(payment_link) <= 300
    -- https, then a plain DNS host (letters, digits, dots, hyphens: no "@", no IP, ends in a letter TLD)
    and payment_link ~* '^https://[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)*\.[a-z]{2,24}(/[^\s<>"\\]*)?$'
    -- punycode look-alike hosts
    and payment_link !~* '^https://[^/]*xn--'
    -- link shorteners hide where the money goes
    and payment_link !~* '^https://(www\.)?(bit\.ly|tinyurl\.com|t\.co|goo\.gl|is\.gd|ow\.ly|cutt\.ly|rb\.gy|shorturl\.at|tiny\.cc|buff\.ly|lnkd\.in|t\.ly|rebrand\.ly|s\.id)(/|$)'
  )
) not valid;

-- Audit trail for the one setting that moves money. Hosts only, never the full link.
create or replace function public.audit_payment_details_change()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.payment_link is distinct from old.payment_link or new.payment_note is distinct from old.payment_note then
    insert into public.audit_log (detailer_id, actor, event, data)
    values (new.id, coalesce(auth.uid()::text, 'system'), 'payment_details.changed', jsonb_build_object(
      'oldHost', substring(old.payment_link from '^https://([^/]+)'),
      'newHost', substring(new.payment_link from '^https://([^/]+)'),
      'noteChanged', new.payment_note is distinct from old.payment_note));
  end if;
  return new;
end;
$$;
revoke all on function public.audit_payment_details_change() from public, anon, authenticated;

create trigger detailers_audit_payment_details
  after update of payment_link, payment_note on public.detailers
  for each row execute function public.audit_payment_details_change();
