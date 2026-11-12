// Formatting helpers. Money is integer cents; times are shown in the
// detailer's own timezone (their business), not the phone's.

/** Countries Beadup works in; keep in step with apps/web/src/lib/countries.ts and the database. */
export const COUNTRIES = {
  US: { name: 'United States', currency: 'USD', locale: 'en-US' },
  CA: { name: 'Canada', currency: 'CAD', locale: 'en-CA' },
  GB: { name: 'United Kingdom', currency: 'GBP', locale: 'en-GB' },
  AU: { name: 'Australia', currency: 'AUD', locale: 'en-AU' },
  NZ: { name: 'New Zealand', currency: 'NZD', locale: 'en-NZ' },
  AE: { name: 'United Arab Emirates', currency: 'AED', locale: 'en-AE' },
  ZA: { name: 'South Africa', currency: 'ZAR', locale: 'en-ZA' },
  SG: { name: 'Singapore', currency: 'SGD', locale: 'en-SG' },
} as const;
export type Country = keyof typeof COUNTRIES;
export const isCountry = (c: unknown): c is Country => typeof c === 'string' && c in COUNTRIES;

const CANADA_ZONES = new Set([
  'America/Toronto', 'America/Vancouver', 'America/Edmonton', 'America/Winnipeg', 'America/Halifax', 'America/St_Johns',
  'America/Regina', 'America/Moncton', 'America/Glace_Bay', 'America/Goose_Bay', 'America/Whitehorse', 'America/Dawson',
  'America/Dawson_Creek', 'America/Fort_Nelson', 'America/Creston', 'America/Yellowknife', 'America/Inuvik',
  'America/Cambridge_Bay', 'America/Iqaluit', 'America/Rankin_Inlet', 'America/Resolute', 'America/Swift_Current',
  'America/Atikokan', 'America/Blanc-Sablon', 'America/Nipigon', 'America/Thunder_Bay', 'America/Rainy_River',
  'America/Pangnirtung', 'America/Montreal',
]);
const UK_ZONES = new Set(['Europe/London', 'Europe/Belfast', 'Europe/Guernsey', 'Europe/Isle_of_Man', 'Europe/Jersey', 'GB', 'GB-Eire']);

/** Same rule as the database's country_from_timezone(), or null outside Beadup's countries. */
export function countryFromTimezone(tz: string): Country | null {
  if (tz.startsWith('Australia/')) return 'AU';
  if (['Pacific/Auckland', 'Pacific/Chatham', 'NZ', 'NZ-CHAT'].includes(tz)) return 'NZ';
  if (tz === 'Asia/Dubai') return 'AE';
  if (tz === 'Africa/Johannesburg') return 'ZA';
  if (tz === 'Asia/Singapore' || tz === 'Singapore') return 'SG';
  if (UK_ZONES.has(tz)) return 'GB';
  if (tz.startsWith('Canada/') || CANADA_ZONES.has(tz)) return 'CA';
  if (tz.startsWith('America/') || tz.startsWith('US/') || tz === 'Pacific/Honolulu') return 'US';
  return null;
}

/**
 * Where this phone is: its timezone, else its region setting, else the US.
 * Used until the detailer's own country loads, and as the default in onboarding,
 * so nobody outside the US starts in dollars.
 */
export function deviceCountry(): Country {
  try {
    const opts = Intl.DateTimeFormat().resolvedOptions();
    const byZone = countryFromTimezone(opts.timeZone ?? '');
    if (byZone) return byZone;
    const region = (opts.locale ?? '').split(/[-_]/).pop()?.toUpperCase();
    return isCountry(region) ? region : 'US';
  } catch {
    return 'US';
  }
}

// The signed-in detailer's country, set when their profile loads (and the
// phone's own country until then). Every money amount is in their currency.
let current: Country = deviceCountry();
export function setMoneyCountry(c: string | null | undefined) {
  current = isCountry(c) ? c : 'US';
}
export const moneyCountry = () => current;

/** "$180", "£60.50", in the detailer's currency. */
export function money(cents: number, opts: { cents?: boolean } = {}): string {
  const showCents = opts.cents ?? cents % 100 !== 0;
  return safeFormat(cents / 100, COUNTRIES[current], showCents ? 2 : 0);
}

/** "$1,840" and ".00" separately, for the big money numbers in the design. */
export function moneyParts(cents: number): { whole: string; fraction: string } {
  const c = COUNTRIES[current];
  const whole = safeFormat(Math.floor(cents / 100), c, 0);
  // The local decimal mark ("," in South Africa, "." elsewhere). Read from a
  // plain format() call: NumberFormat.formatToParts isn't reliable in Hermes
  // on iOS and crashed the app on launch (2026-11-10).
  const mark = DECIMAL_COMMA.has(current) ? ',' : '.';
  return { whole, fraction: `${mark}${String(Math.abs(cents) % 100).padStart(2, '0')}` };
}

/** Countries that write decimals with a comma. */
const DECIMAL_COMMA = new Set<Country>(['ZA']);

/**
 * Intl currency formatting that can never throw: an unsupported locale or
 * currency on the device falls back to en-US with a currency code prefix.
 */
function safeFormat(value: number, c: (typeof COUNTRIES)[Country], fractionDigits: number): string {
  try {
    return new Intl.NumberFormat(c.locale, {
      style: 'currency',
      currency: c.currency,
      minimumFractionDigits: fractionDigits,
      maximumFractionDigits: fractionDigits,
    }).format(value);
  } catch {
    return `${c.currency} ${value.toFixed(fractionDigits)}`;
  }
}

/** The currency symbol on its own ("$", "£", "R"), for price inputs. */
export function currencySymbol(): string {
  const c = COUNTRIES[current];
  // Format zero and strip the digits, spaces and separators (no formatToParts: see above).
  const symbol = safeFormat(0, c, 0).replace(/[\d\s.,  ]/g, '');
  return symbol || '$';
}

export function timeOf(iso: string, timeZone: string): string {
  return new Date(iso).toLocaleTimeString('en-US', { timeZone, hour: 'numeric', minute: '2-digit' });
}

export function dayLabel(iso: string, timeZone: string): string {
  const d = new Date(iso);
  const key = (x: Date) => x.toLocaleDateString('en-CA', { timeZone });
  const today = new Date();
  const tomorrow = new Date(Date.now() + 86_400_000);
  const yesterday = new Date(Date.now() - 86_400_000);
  if (key(d) === key(today)) return 'Today';
  if (key(d) === key(tomorrow)) return 'Tomorrow';
  if (key(d) === key(yesterday)) return 'Yesterday';
  return d.toLocaleDateString('en-US', { timeZone, weekday: 'short', month: 'short', day: 'numeric' });
}

/** YYYY-MM-DD of an instant in a timezone. */
export function dateKey(d: Date, timeZone: string): string {
  return d.toLocaleDateString('en-CA', { timeZone });
}

/** Minutes since local midnight of an instant in a timezone. */
export function minutesOfDay(iso: string, timeZone: string): number {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone, hour: 'numeric', minute: 'numeric', hourCycle: 'h23' }).formatToParts(
    new Date(iso),
  );
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? 0);
  return get('hour') * 60 + get('minute');
}

export function initials(name: string): string {
  return (
    name
      .replace(/[^\p{L}\p{N}\s]/gu, '')
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0]!.toUpperCase())
      .join('') || '?'
  );
}

export function greeting(timeZone: string): string {
  const h = Number(new Date().toLocaleString('en-US', { timeZone, hour: 'numeric', hourCycle: 'h23' }));
  return h < 12 ? 'Morning' : h < 18 ? 'Afternoon' : 'Evening';
}

/** Offset of a timezone from UTC at an instant, in minutes (e.g. -360 for CST). */
function tzOffsetMinutes(at: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric',
    hourCycle: 'h23',
  }).formatToParts(at);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? 0);
  const asUtc = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second'));
  return Math.round((asUtc - at.getTime()) / 60_000);
}

/** The instant of local midnight on a YYYY-MM-DD date in a timezone. */
export function startOfDay(key: string, timeZone: string): Date {
  const [y, m, d] = key.split('-').map(Number);
  const guess = new Date(Date.UTC(y, m - 1, d));
  const first = new Date(guess.getTime() - tzOffsetMinutes(guess, timeZone) * 60_000);
  // Re-check once in case midnight sits on the other side of a DST change.
  return new Date(guess.getTime() - tzOffsetMinutes(first, timeZone) * 60_000);
}

/** The instant of a local wall time ("YYYY-MM-DD" + "HH:MM") in a timezone, DST-aware. */
export function localTime(key: string, hhmm: string, timeZone: string): Date {
  const [y, m, d] = key.split('-').map(Number);
  const [h, min] = hhmm.split(':').map(Number);
  const guess = new Date(Date.UTC(y, m - 1, d, h, min));
  const first = new Date(guess.getTime() - tzOffsetMinutes(guess, timeZone) * 60_000);
  return new Date(guess.getTime() - tzOffsetMinutes(first, timeZone) * 60_000);
}

export function addDaysKey(key: string, days: number): string {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

/** Monday-first weekday index (0 = Monday) of a YYYY-MM-DD date. */
export function weekdayIndex(key: string): number {
  const [y, m, d] = key.split('-').map(Number);
  return (new Date(Date.UTC(y, m - 1, d)).getUTCDay() + 6) % 7;
}

/** The Monday of the week containing `key`. */
export function mondayOf(key: string): string {
  return addDaysKey(key, -weekdayIndex(key));
}
