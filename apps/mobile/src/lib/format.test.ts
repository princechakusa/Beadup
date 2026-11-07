import { describe, expect, it } from 'vitest';
import { dateKey, initials, mondayOf, minutesOfDay, startOfDay, usd, usdParts, weekdayIndex } from './format';

// Reference instants below were confirmed with the browser/Node Intl engine
// for the 2026 DST transitions in America/Chicago:
//   * Spring forward: Sun Mar 8 2026, 2:00 AM CST -> 3:00 AM CDT (UTC-6 -> -5)
//   * Fall back:      Sun Nov 1 2026,  2:00 AM CDT -> 1:00 AM CST (UTC-5 -> -6)
// Asia/Dubai has no DST (always UTC+4).

describe('startOfDay (local midnight as a UTC instant)', () => {
  it('is 06:00Z the day before Chicago springs forward', () => {
    expect(startOfDay('2026-03-07', 'America/Chicago').toISOString()).toBe('2026-03-07T06:00:00.000Z');
  });
  it('midnight on the spring-forward day is still CST (06:00Z)', () => {
    expect(startOfDay('2026-03-08', 'America/Chicago').toISOString()).toBe('2026-03-08T06:00:00.000Z');
  });
  it('the day after is CDT (05:00Z)', () => {
    expect(startOfDay('2026-03-09', 'America/Chicago').toISOString()).toBe('2026-03-09T05:00:00.000Z');
  });
  it('midnight on the fall-back day is still CDT (05:00Z)', () => {
    expect(startOfDay('2026-11-01', 'America/Chicago').toISOString()).toBe('2026-11-01T05:00:00.000Z');
  });
  it('the day after fall-back is CST (06:00Z)', () => {
    expect(startOfDay('2026-11-02', 'America/Chicago').toISOString()).toBe('2026-11-02T06:00:00.000Z');
  });
  it('Dubai midnight is the previous 20:00Z (UTC+4, no DST)', () => {
    expect(startOfDay('2026-07-15', 'Asia/Dubai').toISOString()).toBe('2026-07-14T20:00:00.000Z');
  });
});

describe('minutesOfDay', () => {
  it('is 210 for 03:30 CDT on the spring-forward day (02:00-03:00 does not exist)', () => {
    expect(minutesOfDay('2026-03-08T08:30:00.000Z', 'America/Chicago')).toBe(210);
  });
  it('is 135 for 02:15 CST on the fall-back day', () => {
    expect(minutesOfDay('2026-11-01T08:15:00.000Z', 'America/Chicago')).toBe(135);
  });
  it('is 240 for 04:00 in Dubai', () => {
    expect(minutesOfDay('2026-07-15T00:00:00.000Z', 'Asia/Dubai')).toBe(240);
  });
});

describe('dateKey', () => {
  it('uses the local calendar date across the spring-forward', () => {
    expect(dateKey(new Date('2026-03-08T06:00:00.000Z'), 'America/Chicago')).toBe('2026-03-08');
    expect(dateKey(new Date('2026-03-08T08:00:00.000Z'), 'America/Chicago')).toBe('2026-03-08');
  });
  it('is 2026-10-31 for a still-CDT early instant on fall-back day', () => {
    // 04:30Z on Nov 1 is 23:30 on Oct 31 (CDT, UTC-5).
    expect(dateKey(new Date('2026-11-01T04:30:00.000Z'), 'America/Chicago')).toBe('2026-10-31');
    expect(dateKey(new Date('2026-11-02T06:00:00.000Z'), 'America/Chicago')).toBe('2026-11-02');
  });
});

describe('weekdayIndex / mondayOf', () => {
  it('indexes Monday as 0', () => {
    expect(weekdayIndex('2026-03-09')).toBe(0); // Monday
    expect(weekdayIndex('2026-03-08')).toBe(6); // Sunday
    expect(weekdayIndex('2026-01-05')).toBe(0); // Monday
  });
  it('finds the Monday of the containing week', () => {
    expect(mondayOf('2026-03-08')).toBe('2026-03-02');
    expect(mondayOf('2026-03-09')).toBe('2026-03-09');
    expect(mondayOf('2026-03-10')).toBe('2026-03-09');
    expect(mondayOf('2026-11-01')).toBe('2026-10-26');
    expect(mondayOf('2026-11-02')).toBe('2026-11-02');
  });
});

describe('usd', () => {
  it('hides cents on whole dollars', () => {
    expect(usd(6000)).toBe('$60');
    expect(usd(21000)).toBe('$210');
  });
  it('shows cents otherwise', () => {
    expect(usd(999999)).toBe('$9,999.99');
    expect(usd(1234)).toBe('$12.34');
    expect(usd(6300)).toBe('$63');
  });
  it('honours opts.cents', () => {
    expect(usd(6000, { cents: true })).toBe('$60.00');
    expect(usd(6000, { cents: false })).toBe('$60');
  });
});

describe('usdParts', () => {
  it('splits whole dollars and a fraction', () => {
    expect(usdParts(184000)).toEqual({ whole: '$1,840', fraction: '.00' });
    expect(usdParts(184034)).toEqual({ whole: '$1,840', fraction: '.34' });
    expect(usdParts(999)).toEqual({ whole: '$9', fraction: '.99' });
  });
});

describe('initials', () => {
  it('takes the first letters of the first two words', () => {
    expect(initials('Marcus Shine Co.')).toBe('MS');
    expect(initials('dana r.')).toBe('DR');
    expect(initials('Ana')).toBe('A');
  });
  it('falls back for empty input', () => {
    expect(initials('   ')).toBe('?');
  });
});