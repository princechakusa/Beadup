// Formatting helpers. Money is integer cents; times are shown in the
// detailer's own timezone (their business), not the phone's.

export function usd(cents: number, opts: { cents?: boolean } = {}): string {
  const showCents = opts.cents ?? cents % 100 !== 0;
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: showCents ? 2 : 0,
    maximumFractionDigits: showCents ? 2 : 0,
  }).format(cents / 100);
}

/** "$1,840" and ".00" separately, for the big money numbers in the design. */
export function usdParts(cents: number): { whole: string; fraction: string } {
  const whole = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(
    Math.floor(cents / 100),
  );
  return { whole, fraction: `.${String(Math.abs(cents) % 100).padStart(2, '0')}` };
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
