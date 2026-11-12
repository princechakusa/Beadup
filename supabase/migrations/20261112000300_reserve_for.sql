-- The website now has /for and /for/<trade> pages (one per trade), so "for"
-- can no longer be a booking handle. NOT VALID: existing rows aren't re-checked
-- (no business has it; the constraint still applies to every new or changed row).
alter table public.detailers drop constraint detailers_handle_reserved;
alter table public.detailers add constraint detailers_handle_reserved
  check (handle not in ('api', 'app', 'admin', 'login', 'signup', 'settings', 'pricing', 'privacy', 'terms',
                        'support', 'help', 'delete-account', 'about', 'blog', 'pro', 'book', 'auth', 'webhooks',
                        'www', 'beadup', 'stripe', 'connect', 'billing', 'account', 'dashboard', 'legal', 'for', 'r', 'b', 'm'))
  not valid;

create or replace function public.handle_available(p_handle text)
returns boolean language sql stable security definer set search_path = '' as $$
  select lower(p_handle) ~ '^[a-z0-9][a-z0-9-]{1,39}$'
     and lower(p_handle) not in ('api', 'app', 'admin', 'login', 'signup', 'settings', 'pricing', 'privacy', 'terms',
                                 'support', 'help', 'delete-account', 'about', 'blog', 'pro', 'book', 'auth', 'webhooks',
                                 'www', 'beadup', 'stripe', 'connect', 'billing', 'account', 'dashboard', 'legal', 'for')
     and not exists (select 1 from public.detailers where handle = lower(p_handle));
$$;
