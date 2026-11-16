import { describe, expect, it } from 'vitest';

import { en } from './en';
import { es } from './es';
import { fmt, getLocale, pickLocale, setLocale, t } from './index';
import { fr } from './fr';
import { pt } from './pt';

const placeholders = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();

describe('mobile i18n', () => {
  it('picks the best supported language', () => {
    expect(pickLocale(['fr-CA'])).toBe('fr');
    expect(pickLocale(['de-DE', 'pt-BR'])).toBe('pt');
    expect(pickLocale(['ar-AE'])).toBe('en');
    expect(pickLocale([])).toBe('en');
  });

  it('fills placeholders', () => {
    expect(fmt('Hi {name}, {n}', { name: 'Sam', n: 2 })).toBe('Hi Sam, 2');
    expect(fmt('Hi {who}', { name: 'Sam' })).toBe('Hi {who}');
  });

  it('falls back to English for a missing key and translates a present one', () => {
    setLocale('es');
    expect(t('tab_today')).toBe('Hoy');
    setLocale('en');
    expect(t('tab_today')).toBe('Today');
    expect(getLocale()).toBe('en');
  });

  it.each([
    ['es', es],
    ['fr', fr],
    ['pt', pt],
  ] as const)('%s only uses real keys, keeps the same placeholders and never leaves blanks', (_name, catalog) => {
    for (const [key, text] of Object.entries(catalog)) {
      expect(key in en, `unknown key ${key}`).toBe(true);
      expect(text.trim(), key).not.toBe('');
      expect(placeholders(text), key).toEqual(placeholders(en[key as keyof typeof en]));
    }
  });

  it.each([
    ['es', es],
    ['fr', fr],
    ['pt', pt],
  ] as const)('%s translates every English key', (_name, catalog) => {
    const missing = Object.keys(en).filter((k) => !(k in catalog));
    expect(missing).toEqual([]);
  });

  it('week letters give seven days in every language', () => {
    for (const c of [en, es, fr, pt]) expect(((c as Record<string, string>).week_letters ?? en.week_letters).split(',')).toHaveLength(7);
  });
});
