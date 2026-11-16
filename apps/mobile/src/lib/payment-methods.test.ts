import { describe, expect, it } from 'vitest';

import { COUNTRIES, type Country } from './format';
import { detailFromNote, guessMethod, methodsFor } from './payment-methods';

describe('payment methods', () => {
  it('every country offers methods plus pay-on-the-day and a free-form option', () => {
    for (const c of Object.keys(COUNTRIES) as Country[]) {
      const ids = methodsFor(c).map((m) => m.id);
      expect(ids.length).toBeGreaterThan(3 - 1);
      expect(ids).toContain('day');
      expect(ids).toContain('custom');
      expect(new Set(ids).size).toBe(ids.length);
    }
  });

  it('South Africa gets PayShap, Yoco, PayFast, SnapScan and EFT', () => {
    const ids = methodsFor('ZA').map((m) => m.id);
    for (const id of ['payshap', 'yoco', 'payfast', 'snapscan', 'eft']) expect(ids).toContain(id);
  });

  it('a saved note opens on the method that wrote it and gives the detail back', () => {
    const payshap = methodsFor('ZA').find((m) => m.id === 'payshap')!;
    const saved = payshap.note!('082 123 4567');
    const guessed = guessMethod('ZA', null, saved);
    expect(guessed.id).toBe('payshap');
    expect(detailFromNote(guessed, saved)).toBe('082 123 4567');
  });

  it('pay on the day and free-form notes are recognised', () => {
    const day = methodsFor('ZA').find((m) => m.id === 'day')!;
    expect(guessMethod('ZA', null, day.fixed!).id).toBe('day');
    expect(guessMethod('ZA', null, 'Cash only please').id).toBe('custom');
    expect(guessMethod('US', 'https://paypal.me/x', null).id).toBe('custom');
  });
});
