import { describe, expect, it } from 'vitest';

import * as web from '../../../web/src/lib/countries';
import { formatPhone, toE164 } from './phone';

const samples = [
  ['(512) 555-0101', 'US'], ['416 555 0101', 'CA'], ['07700 900123', 'GB'], ['0412 345 678', 'AU'],
  ['021 123 4567', 'NZ'], ['050 123 4567', 'AE'], ['082 123 4567', 'ZA'], ['9123 4567', 'SG'],
  ['+44 7700 900123', 'US'], ['12', 'US'], ['0000', 'GB'],
] as const;

describe('phone (mobile copy of the web rules)', () => {
  it('reads numbers exactly like the web booking page', () => {
    for (const [raw, c] of samples) expect(toE164(raw, c)).toBe(web.toE164(raw, c));
  });
  it('writes numbers exactly like the web booking page', () => {
    for (const [raw, c] of samples) {
      const e164 = toE164(raw, c);
      if (e164) expect(formatPhone(e164, c)).toBe(web.formatPhone(e164, c));
    }
  });
  it('round-trips a local number', () => {
    expect(formatPhone(toE164('(512) 555-0101', 'US')!, 'US')).toBe('(512) 555-0101');
  });
});
