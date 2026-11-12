-- Trust and follow-through for clients (owner request 2026-11-12):
--   1. A photo of the detailer and a portfolio of their work on the booking page,
--      so a new client knows who is coming and what they get.
--   2. A receipt the client can open, print or save, on the same page as the
--      rating (/r/<review_token>), sent by the detailer when the job is done.
--   3. The client's private booking link for the detailer to resend (WhatsApp or
--      Messages), without exposing tokens in table reads.
--
-- Images live in a PRIVATE bucket and are served by the web app's own
-- /api/media route (CSP allows images from 'self' only). Public URLs use the
-- handle and the item id, never the detailer's user id or the storage path.

-- ---------------------------------------------------------------------------
-- Storage: "<detailer id>/<random>.jpg", JPEG only (the app re-encodes, which
-- strips EXIF/GPS), 3 MB max. The owner manages their own folder.
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('profile-media', 'profile-media', false, 3145728, array['image/jpeg'])
on conflict (id) do update set public = false, file_size_limit = 3145728, allowed_mime_types = array['image/jpeg'];

create policy profile_media_owner_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'profile-media' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy profile_media_owner_select on storage.objects for select to authenticated
  using (bucket_id = 'profile-media' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy profile_media_owner_delete on storage.objects for delete to authenticated
  using (bucket_id = 'profile-media' and (storage.foldername(name))[1] = (select auth.uid())::text);

-- A path inside the owner's own folder in profile-media.
create function public.is_own_media_path(p_detailer_id uuid, p_path text)
returns boolean language sql immutable set search_path = '' as $$
  select p_path ~ ('^' || p_detailer_id::text || '/[a-z0-9]{12,40}\.jpg$');
$$;

alter table public.detailers add column photo_path text;
alter table public.detailers add constraint detailers_photo_path_own
  check (photo_path is null or public.is_own_media_path(id, photo_path));
grant update (photo_path) on public.detailers to authenticated;

create table public.portfolio_items (
  id          uuid primary key default gen_random_uuid(),
  detailer_id uuid not null references public.detailers (id) on delete cascade,
  path        text not null,
  caption     text not null default '' check (char_length(caption) <= 80),
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now(),
  check (public.is_own_media_path(detailer_id, path))
);
create index portfolio_items_detailer_idx on public.portfolio_items (detailer_id, sort_order);
alter table public.portfolio_items enable row level security;
revoke all on public.portfolio_items from anon, authenticated;
grant select, insert, delete on public.portfolio_items to authenticated;
grant update (caption, sort_order) on public.portfolio_items to authenticated;
create policy portfolio_items_owner on public.portfolio_items for all to authenticated
  using (detailer_id = (select auth.uid())) with check (detailer_id = (select auth.uid()));

-- At most 12 photos each, so the page stays fast.
create function public.portfolio_items_limit() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform pg_advisory_xact_lock(hashtextextended('portfolio:' || new.detailer_id::text, 0));
  if (select count(*) from public.portfolio_items where detailer_id = new.detailer_id) >= 12 then
    raise exception 'portfolio is full (12 photos)' using errcode = 'P0001';
  end if;
  return new;
end $$;
create trigger portfolio_items_limit before insert on public.portfolio_items
  for each row execute function public.portfolio_items_limit();

-- Storage path behind a public media URL. Published detailers only.
create function public.media_path(p_handle text, p_item_id uuid default null)
returns text language sql stable security definer set search_path = '' as $$
  select case when p_item_id is null then d.photo_path
              else (select p.path from public.portfolio_items p where p.id = p_item_id and p.detailer_id = d.id) end
  from public.detailers d
  where d.handle = lower(p_handle) and d.is_published;
$$;

-- ---------------------------------------------------------------------------
-- Receipt for the client, by the review token the detailer already shares.
-- First name only; no phone, no address.
-- ---------------------------------------------------------------------------
create function public.receipt_context(p_token text)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'ref',           upper(left(replace(b.id::text, '-', ''), 8)),
    'handle',        d.handle,
    'businessName',  d.business_name,
    'contactPhone',  d.contact_phone,
    'country',       d.country,
    'timezone',      d.timezone,
    'firstName',     split_part(c.name, ' ', 1),
    'serviceName',   b.service_name,
    'vehicleSize',   b.vehicle_size,
    'addOns',        b.add_ons,
    'startsAt',      b.starts_at,
    'completedAt',   b.completed_at,
    'status',        b.status,
    'subtotalCents', b.subtotal_cents,
    'depositCents',  b.deposit_cents,
    'depositPaid',   b.deposit_received_at is not null
                     or exists (select 1 from public.payments p where p.booking_id = b.id and p.kind = 'deposit' and p.status = 'succeeded'))
  from public.bookings b
  join public.detailers d on d.id = b.detailer_id
  join public.clients c on c.id = b.client_id
  where p_token ~ '^[0-9a-f]{48}$' and b.review_token = p_token;
$$;

-- The client's private booking link token, for the detailer to resend.
create function public.client_link_token(p_booking_id uuid)
returns text language sql stable security definer set search_path = '' as $$
  select client_token from public.bookings where id = p_booking_id and detailer_id = auth.uid();
$$;

revoke all on function public.is_own_media_path(uuid, text) from public, anon, authenticated;
revoke all on function public.portfolio_items_limit() from public, anon, authenticated;
revoke all on function public.media_path(text, uuid) from public, anon, authenticated;
revoke all on function public.receipt_context(text) from public, anon, authenticated;
revoke all on function public.client_link_token(uuid) from public, anon;
grant execute on function public.is_own_media_path(uuid, text) to authenticated, service_role;
grant execute on function public.media_path(text, uuid) to service_role;
grant execute on function public.receipt_context(text) to service_role;
grant execute on function public.client_link_token(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Booking page: photo flag (with a version for caching) and portfolio ids.
-- ---------------------------------------------------------------------------
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
    'contactPhone', d.contact_phone,
    'bufferMin',    d.buffer_min,
    -- Changes whenever the photo changes, so browsers fetch the new one.
    'photo',        case when d.photo_path is null then null else left(md5(d.photo_path), 10) end,
    'portfolio', coalesce((
      select jsonb_agg(jsonb_build_object('id', p.id, 'caption', p.caption) order by p.sort_order, p.created_at)
      from public.portfolio_items p
      where p.detailer_id = d.id), '[]'::jsonb),
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
    'daysOff', coalesce((
      select jsonb_agg(to_char(o.day, 'YYYY-MM-DD') order by o.day)
      from public.days_off o
      where o.detailer_id = d.id
        and o.day between (now() at time zone d.timezone)::date and (now() at time zone d.timezone)::date + 22), '[]'::jsonb),
    'taken', coalesce((
      select jsonb_agg(to_char(b.starts_at at time zone d.timezone, 'YYYY-MM-DD HH24:MI') order by b.starts_at)
      from public.bookings b
      where b.detailer_id = d.id
        and b.starts_at between now() and now() + interval '22 days'
        and public.booking_is_live(b.status, b.created_at)), '[]'::jsonb),
    'busy', coalesce((
      select jsonb_agg(jsonb_build_object(
               'start', to_char(b.starts_at at time zone d.timezone, 'YYYY-MM-DD HH24:MI'),
               'minutes', b.duration_min) order by b.starts_at)
      from public.bookings b
      where b.detailer_id = d.id
        and b.starts_at between now() - interval '13 hours' and now() + interval '22 days'
        and public.booking_is_live(b.status, b.created_at)), '[]'::jsonb)
  )
  from public.detailers d
  left join lateral (
    select round(avg(rv.rating)::numeric, 1)::float8 as rating, count(*)::int as review_count
    from public.reviews rv
    where rv.detailer_id = d.id and not rv.hidden
  ) r on true
  where d.handle = lower(p_handle) and d.is_published;
$$;

-- ---------------------------------------------------------------------------
-- Pro price per country for the website, e.g. {"ZA": "R349", "AE": "AED 69"}.
-- The real price is set per country in App Store Connect / Play Console; copy
-- the display strings here. Countries without an entry see no amount (never a
-- US dollar price outside the US).
-- ---------------------------------------------------------------------------
insert into public.plan_config (key, value) values ('pro_price_by_country', '{}'::jsonb)
on conflict (key) do nothing;
