-- Local development seed. Never run against production.
-- Marcus is the demo detailer at /marcus (also the App Review demo account).

insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
                        raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('00000000-0000-0000-0000-000000000000', '11111111-1111-4111-8111-111111111111', 'authenticated',
   'authenticated', 'marcus@demo.beadup.app', '', now(),
   '{"provider":"email","providers":["email"]}', '{}', now(), now());

insert into public.detailers (id, handle, business_name, tagline, service_area, timezone, is_published)
values ('11111111-1111-4111-8111-111111111111', 'marcus', 'Marcus Shine Co.',
        'Mobile detailing · we come to you', 'Austin, TX · 25 mi', 'America/Chicago', true);

insert into public.detailer_accounts (detailer_id) values ('11111111-1111-4111-8111-111111111111');

insert into public.services (id, detailer_id, name, description, duration_min,
                             price_sedan_cents, price_suv_cents, price_truck_cents, sort_order)
values
  ('a0000000-0000-4000-8000-000000000001', '11111111-1111-4111-8111-111111111111', 'Express wash',
   'Hand wash, wheels, tires, glass', 60, 6000, 7000, 8000, 1),
  ('a0000000-0000-4000-8000-000000000002', '11111111-1111-4111-8111-111111111111', 'Full detail',
   'Inside and out, hand wax, interior deep clean', 180, 18000, 21000, 23000, 2),
  ('a0000000-0000-4000-8000-000000000003', '11111111-1111-4111-8111-111111111111', 'Ceramic coating',
   'Paint correction + 2-year ceramic protection', 360, 65000, 75000, 80000, 3);

insert into public.add_ons (detailer_id, name, price_cents, sort_order)
values
  ('11111111-1111-4111-8111-111111111111', 'Pet hair removal (seats and carpets)', 4000, 1),
  ('11111111-1111-4111-8111-111111111111', 'Odor treatment', 3500, 2),
  ('11111111-1111-4111-8111-111111111111', 'Engine bay clean', 3000, 3);

-- Mon to Sat, five starts a day. Sunday off.
insert into public.availability_slots (detailer_id, weekday, start_time)
select '11111111-1111-4111-8111-111111111111', wd, t::time
from generate_series(1, 6) wd
cross join unnest(array['08:00', '09:30', '12:00', '14:30', '16:00']) t;

-- Three completed jobs with reviews.
insert into public.clients (id, detailer_id, name, phone, sms_consent, sms_consent_at, sms_consent_text)
values
  ('c0000000-0000-4000-8000-000000000001', '11111111-1111-4111-8111-111111111111', 'Dana R.', '+15125550101',
   true, now() - interval '30 days', 'Text me booking confirmations and reminders. Reply STOP to opt out.'),
  ('c0000000-0000-4000-8000-000000000002', '11111111-1111-4111-8111-111111111111', 'Luis M.', '+15125550102',
   false, null, null),
  ('c0000000-0000-4000-8000-000000000003', '11111111-1111-4111-8111-111111111111', 'Priya K.', '+15125550103',
   false, null, null);

insert into public.bookings (id, detailer_id, client_id, service_id, service_name, vehicle_size, starts_at,
                             duration_min, address, subtotal_cents, deposit_cents, booking_fee_cents, status)
values
  ('b0000000-0000-4000-8000-000000000001', '11111111-1111-4111-8111-111111111111', 'c0000000-0000-4000-8000-000000000001',
   'a0000000-0000-4000-8000-000000000002', 'Full detail', 'suv', now() - interval '21 days', 180,
   '1200 Barton Springs Rd, Austin, TX', 21000, 6300, 222, 'completed'),
  ('b0000000-0000-4000-8000-000000000002', '11111111-1111-4111-8111-111111111111', 'c0000000-0000-4000-8000-000000000002',
   'a0000000-0000-4000-8000-000000000001', 'Express wash', 'sedan', now() - interval '14 days', 60,
   '500 E 6th St, Austin, TX', 6000, 1800, 85, 'completed'),
  ('b0000000-0000-4000-8000-000000000003', '11111111-1111-4111-8111-111111111111', 'c0000000-0000-4000-8000-000000000003',
   'a0000000-0000-4000-8000-000000000003', 'Ceramic coating', 'truck', now() - interval '7 days', 360,
   '2100 S Lamar Blvd, Austin, TX', 80000, 24000, 751, 'completed');

insert into public.reviews (detailer_id, booking_id, rating, body)
values
  ('11111111-1111-4111-8111-111111111111', 'b0000000-0000-4000-8000-000000000001', 5, 'Looks brand new inside.'),
  ('11111111-1111-4111-8111-111111111111', 'b0000000-0000-4000-8000-000000000002', 5, 'On time and quick.'),
  ('11111111-1111-4111-8111-111111111111', 'b0000000-0000-4000-8000-000000000003', 4, 'Great finish.');
