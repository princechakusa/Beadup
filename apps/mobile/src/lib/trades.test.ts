import { describe, expect, it } from 'vitest';

import * as web from '../../../web/src/lib/trades';
import { STARTERS, TRADE_IDS, TRADES } from './trades';

describe('trades (mobile copy of the web config)', () => {
  it('matches the website exactly', () => {
    expect(TRADE_IDS).toEqual(web.TRADE_IDS);
    expect(TRADES).toEqual(web.TRADES);
  });
  it('has starter services for every trade, within the database limits', () => {
    for (const id of TRADE_IDS) {
      const s = STARTERS[id];
      expect(s.services.length).toBeGreaterThan(0);
      for (const v of s.services) {
        expect(v.durationMin).toBeGreaterThanOrEqual(15);
        expect(v.durationMin).toBeLessThanOrEqual(720);
        if (TRADES[id].pricing === 'single') expect(new Set([v.sedan, v.suv, v.truck]).size).toBe(1);
      }
    }
  });
});
