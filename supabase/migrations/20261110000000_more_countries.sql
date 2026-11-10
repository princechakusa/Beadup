-- More countries (owner decision 2026-11-10): New Zealand, United Arab
-- Emirates, South Africa and Singapore, alongside US, CA, GB and AU.
-- Ireland is deferred (EU trader status). Same rules as the first four:
-- country sets the currency and how clients' phone numbers are read; money
-- stays integer minor units, so pricing math is unchanged. RLS and grants
-- are untouched.

alter table public.detailers drop constraint detailers_country_supported;
alter table public.detailers
  add constraint detailers_country_supported check (country in ('US', 'CA', 'GB', 'AU', 'NZ', 'AE', 'ZA', 'SG'));

create or replace function public.country_from_timezone(p_timezone text)
returns text language sql immutable set search_path = '' as $$
  select case
    when p_timezone like 'Australia/%' then 'AU'
    when p_timezone in ('Pacific/Auckland', 'Pacific/Chatham', 'NZ', 'NZ-CHAT') then 'NZ'
    when p_timezone = 'Asia/Dubai' then 'AE'
    when p_timezone = 'Africa/Johannesburg' then 'ZA'
    when p_timezone in ('Asia/Singapore', 'Singapore') then 'SG'
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

create or replace function public.country_currency(p_country text)
returns text language sql immutable set search_path = '' as $$
  select case p_country
    when 'CA' then 'cad' when 'GB' then 'gbp' when 'AU' then 'aud'
    when 'NZ' then 'nzd' when 'AE' then 'aed' when 'ZA' then 'zar' when 'SG' then 'sgd'
    else 'usd'
  end;
$$;
