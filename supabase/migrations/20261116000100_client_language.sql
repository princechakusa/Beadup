-- The language a client booked in (their browser's), so emails to them are written in it.
-- Private to the server: the detailer app has column-level grants on bookings and this
-- column is not one of them. Set by the booking server action with the service role.
alter table public.bookings
  add column client_lang text not null default 'en' check (client_lang in ('en', 'es', 'fr', 'pt'));

-- Same context as before, plus the language.
create or replace function public.email_context(p_email_id uuid)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'id', e.id, 'kind', e.kind, 'status', e.status, 'attempts', e.attempts,
    'to', c.email, 'firstName', split_part(c.name, ' ', 1),
    'businessName', d.business_name, 'handle', d.handle, 'contactPhone', d.contact_phone,
    'country', d.country, 'timezone', d.timezone, 'trade', d.trade, 'visitMode', d.visit_mode,
    'serviceArea', d.service_area, 'paymentLink', d.payment_link, 'paymentNote', d.payment_note,
    'payments', public.payments_mode(),
    'serviceName', b.service_name, 'staffName', (select m.name from public.staff_members m where m.id = b.staff_id), 'vehicleSize', b.vehicle_size, 'startsAt', b.starts_at,
    'durationMin', b.duration_min, 'address', b.address, 'subtotalCents', b.subtotal_cents,
    'depositCents', b.deposit_cents, 'depositReceived', b.deposit_received_at is not null,
    'clientToken', b.client_token, 'reviewToken', b.review_token,
    'ref', upper(left(replace(b.id::text, '-', ''), 8)),
    'lang', b.client_lang)
  from public.client_emails e
  join public.bookings b on b.id = e.booking_id
  join public.detailers d on d.id = b.detailer_id
  join public.clients c on c.id = b.client_id
  where e.id = p_email_id;
$$;
revoke all on function public.email_context(uuid) from public, anon, authenticated;
grant execute on function public.email_context(uuid) to service_role;
