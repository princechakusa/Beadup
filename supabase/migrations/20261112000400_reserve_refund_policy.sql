-- /refund-policy is a website page (needed for Paddle), so it can't be a booking handle.
-- NOT VALID: existing rows aren't re-checked; every new or changed handle is.
alter table public.detailers drop constraint detailers_handle_reserved;
alter table public.detailers add constraint detailers_handle_reserved
  check (handle not in ('api', 'app', 'admin', 'login', 'signup', 'settings', 'pricing', 'privacy', 'terms',
                        'support', 'help', 'delete-account', 'about', 'blog', 'pro', 'book', 'auth', 'webhooks',
                        'www', 'beadup', 'stripe', 'connect', 'billing', 'account', 'dashboard', 'legal', 'for', 'r', 'b', 'm', 'refund-policy'))
  not valid;

create or replace function public.handle_available(p_handle text)
returns boolean language sql stable security definer set search_path = '' as $$
  select lower(p_handle) ~ '^[a-z0-9][a-z0-9-]{1,39}$'
     and lower(p_handle) not in ('api', 'app', 'admin', 'login', 'signup', 'settings', 'pricing', 'privacy', 'terms',
                                 'support', 'help', 'delete-account', 'about', 'blog', 'pro', 'book', 'auth', 'webhooks',
                                 'www', 'beadup', 'stripe', 'connect', 'billing', 'account', 'dashboard', 'legal', 'for', 'refund-policy')
     and not exists (select 1 from public.detailers where handle = lower(p_handle));
$$;
