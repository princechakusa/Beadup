import { en, type MessageKey } from './en';
import { es } from './es';
import { fr } from './fr';
import { pt } from './pt';

export type { MessageKey };
export const LOCALES = ['en', 'es', 'fr', 'pt'] as const;
export type Locale = (typeof LOCALES)[number];

const CATALOGS: Record<Locale, Partial<Record<MessageKey, string>>> = { en, es, fr, pt };
const DATE_LOCALES: Record<Locale, string> = { en: 'en-US', es: 'es', fr: 'fr', pt: 'pt-BR' };

/** Best supported language from a list of BCP 47 tags ("fr-CA", "pt-BR"): English when none match. */
export function pickLocale(tags: readonly string[]): Locale {
  for (const tag of tags) {
    const lang = tag.toLowerCase().split(/[-_]/)[0];
    if ((LOCALES as readonly string[]).includes(lang)) return lang as Locale;
  }
  return 'en';
}

/** The phone's language. Uses Intl (built into the JS engine), so no native module is needed. */
function deviceLocale(): Locale {
  try {
    return pickLocale([Intl.DateTimeFormat().resolvedOptions().locale ?? 'en']);
  } catch {
    return 'en';
  }
}

// The language the person chose in Settings (kept on the device), else the phone's.
export type LanguagePreference = 'auto' | Locale;
const PREF_KEY = 'beadup.language';
type KeyValueStore = { getItem(key: string): string | null; setItem(key: string, value: string): void };
function store(): KeyValueStore | null {
  try {
    // Loaded lazily so tests and the web preview never need the native module.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('expo-secure-store') as KeyValueStore;
  } catch {
    return null;
  }
}
export function getLanguagePreference(): LanguagePreference {
  try {
    const v = store()?.getItem(PREF_KEY);
    return v && (LOCALES as readonly string[]).includes(v) ? (v as Locale) : 'auto';
  } catch {
    return 'auto';
  }
}
export function saveLanguagePreference(pref: LanguagePreference): void {
  try {
    store()?.setItem(PREF_KEY, pref);
  } catch {
    // keep going: the choice then lasts until the app closes
  }
  current = pref === 'auto' ? deviceLocale() : pref;
}

let current: Locale = (() => {
  const pref = getLanguagePreference();
  return pref === 'auto' ? deviceLocale() : pref;
})();
export const setLocale = (l: Locale) => {
  current = l;
};
export const getLocale = (): Locale => current;
/** Language tag for dates and numbers. */
export const dateLocale = (): string => DATE_LOCALES[current];

/** Fills `{name}` placeholders; unknown ones stay visible so a typo shows up in testing. */
export function fmt(template: string, vars?: Record<string, string | number>): string {
  return vars ? template.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m)) : template;
}

/** Text for a key in the phone's language, falling back to English per key. */
export function t(key: MessageKey, vars?: Record<string, string | number>): string {
  return fmt(CATALOGS[current][key] ?? en[key], vars);
}
