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

// The signed-in detailer's country, set when their profile loads. Every money
// amount in the app is in their own currency.
let current: Country = 'US';
export function setMoneyCountry(c: string | null | undefined) {
  current = isCountry(c) ? c : 'US';
}
export const moneyCountry = () => current;

/** "$180", "£60.50", in the detailer's currency. */
export function money(cents: number, opts: { cents?: boolean } = {}): string {
  const showCents = opts.cents ?? cents % 100 !== 0;
  const c = COUNTRIES[current];
  return new Intl.NumberFormat(c.locale, {
    style: 'currency',
    currency: c.currency,
    minimumFractionDigits: showCents ? 2 : 0,
    maximumFractionDigits: showCents ? 2 : 0,
  }).format(cents / 100);
}

/** "$1,840" and ".00" separately, for the big money numbers in the design. */
export function moneyParts(cents: number): { whole: string; fraction: string } {
  const c = COUNTRIES[current];
  const whole = new Intl.NumberFormat(c.locale, { style: 'currency', currency: c.currency, maximumFractionDigits: 0 }).format(
    Math.floor(cents / 100),
  );
  // The local decimal mark ("," in South Africa, "." elsewhere).
  const mark = new Intl.NumberFormat(c.locale).formatToParts(1.5).find((p) => p.type === 'decimal')?.value ?? '.';
  return { whole, fraction: `${mark}${String(Math.abs(cents) % 100).padStart(2, '0')}` };
}

/** The currency symbol on its own ("$", "£"), for price inputs. */
export function currencySymbol(): string {
  const c = COUNTRIES[current];
  return (
    new Intl.NumberFormat(c.locale, { style: 'currency', currency: c.currency }).formatToParts(0).find((p) => p.type === 'currency')?.value ??
    '$'
  );
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
