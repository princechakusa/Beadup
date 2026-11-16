"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";
import { en } from "./en";
import { fmt, type Locale, type MessageKey, type Messages, type Phrases } from "./index";

type Ctx = {
  locale: Locale;
  /** BCP 47 tag for Intl (dates). */
  dateLocale: string;
  t: (key: MessageKey, vars?: Record<string, string | number>) => string;
  /** Trade wording that lives in lib/trades.ts: translated when a phrase exists, else as written. */
  phrase: (english: string) => string;
};

// Without a provider (pages not translated yet) everything reads as English.
const ENGLISH: Ctx = { locale: "en", dateLocale: "en-US", t: (key, vars) => fmt(en[key], vars), phrase: (x) => x };
const I18nContext = createContext<Ctx>(ENGLISH);

export function I18nProvider({ locale, dateLocale, messages, phrases, children }: { locale: Locale; dateLocale: string; messages: Messages; phrases: Phrases; children: ReactNode }) {
  const value = useMemo<Ctx>(
    () => ({
      locale,
      dateLocale,
      t: (key, vars) => fmt(messages[key], vars),
      phrase: (english) => phrases[english] ?? english,
    }),
    [locale, dateLocale, messages, phrases],
  );
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

/** Translation helpers for client components under an I18nProvider. */
export function useI18n(): Ctx {
  return useContext(I18nContext);
}
