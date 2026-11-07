-- AI photo quotes: third-party AI consent, server-saved suggestions, and a
-- private bucket for vehicle photos (rules.md sections 3, 5 and 7).

-- Explicit consent before any photo goes to the AI provider (Apple 5.1.2(i)).
alter table public.detailers add column ai_consent_at timestamptz;

create function public.record_ai_consent()
returns void language sql volatile security definer set search_path = '' as $$
  update public.detailers set ai_consent_at = coalesce(ai_consent_at, now()) where id = auth.uid();
  insert into public.audit_log (detailer_id, actor, event)
  select auth.uid(), auth.uid()::text, 'ai.consent_given' where auth.uid() is not null;
$$;

create function public.revoke_ai_consent()
returns void language sql volatile security definer set search_path = '' as $$
  update public.detailers set ai_consent_at = null where id = auth.uid();
  insert into public.audit_log (detailer_id, actor, event)
  select auth.uid(), auth.uid()::text, 'ai.consent_revoked' where auth.uid() is not null;
$$;

revoke execute on function public.record_ai_consent(), public.revoke_ai_consent() from public, anon;
grant execute on function public.record_ai_consent(), public.revoke_ai_consent() to authenticated;

-- The server saves the AI suggestion as a draft quote (ai_suggestion and
-- photo_paths are not client-writable); the detailer then edits the numbers.
create function public.create_ai_draft_quote(p_detailer_id uuid, p_vehicle_size public.vehicle_size,
                                             p_vehicle_desc text, p_suggestion jsonb, p_photo_paths text[])
returns uuid language sql volatile security definer set search_path = '' as $$
  insert into public.quotes (detailer_id, vehicle_size, vehicle_desc, ai_suggestion, photo_paths, status)
  values (p_detailer_id, p_vehicle_size, left(coalesce(p_vehicle_desc, ''), 120), p_suggestion, p_photo_paths, 'draft')
  returning id;
$$;
revoke execute on function public.create_ai_draft_quote(uuid, public.vehicle_size, text, jsonb, text[]) from public, anon, authenticated;
grant execute on function public.create_ai_draft_quote(uuid, public.vehicle_size, text, jsonb, text[]) to service_role;

-- ---------------------------------------------------------------------------
-- Private storage for vehicle photos. Paths are "<detailer id>/<file>.jpg".
-- JPEG only (the app re-encodes, which strips EXIF/GPS), 5 MB max.
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('quote-photos', 'quote-photos', false, 5242880, array['image/jpeg'])
on conflict (id) do update set public = false, file_size_limit = 5242880, allowed_mime_types = array['image/jpeg'];

create policy quote_photos_owner_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'quote-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy quote_photos_owner_select on storage.objects for select to authenticated
  using (bucket_id = 'quote-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy quote_photos_owner_delete on storage.objects for delete to authenticated
  using (bucket_id = 'quote-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);
