-- Owner decision 2026-11-07: launch without text messages (no Twilio spend).
-- Clients get Stripe email receipts and detailers get push alerts. Set to
-- true once Twilio and 10DLC are in place: the booking page then shows the
-- optional SMS consent box again and the outbox starts sending.
insert into public.plan_config (key, value) values ('sms_enabled', 'false')
on conflict (key) do nothing;
