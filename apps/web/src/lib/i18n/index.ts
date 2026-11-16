import { en, type MessageKey, type Messages, type Phrases } from "./en";
import { es, esPhrases } from "./es";
import { fr, frPhrases } from "./fr";
import { pt, ptPhrases } from "./pt";

export const LOCALES = ["en", "es", "fr", "pt"] as const;
export type Locale = (typeof LOCALES)[number];

const CATALOGS: Record<Locale, { messages: Messages; phrases: Phrases }> = {
  en: { messages: en, phrases: {} },
  es: { messages: es, phrases: esPhrases },
  fr: { messages: fr, phrases: frPhrases },
  pt: { messages: pt, phrases: ptPhrases },
};

/** BCP 47 tag used for dates and `lang`. */
export const DATE_LOCALE: Record<Locale, string> = { en: "en-US", es: "es", fr: "fr", pt: "pt-BR" };

export const isLocale = (v: unknown): v is Locale => typeof v === "string" && (LOCALES as readonly string[]).includes(v);

/**
 * Picks the best supported language from an Accept-Language header
 * ("fr-CA,fr;q=0.9,en;q=0.8"). English when nothing matches.
 */
export function negotiate(acceptLanguage: string | null | undefined): Locale {
  const wanted = (acceptLanguage ?? "")
    .split(",")
    .map((part) => {
      const [tag, q] = part.trim().split(";q=");
      return { lang: (tag ?? "").toLowerCase().split("-")[0] ?? "", q: q ? Number(q) : 1 };
    })
    .filter((x) => x.lang && Number.isFinite(x.q) && x.q > 0)
    .sort((a, b) => b.q - a.q);
  for (const { lang } of wanted) if (isLocale(lang)) return lang;
  return "en";
}

export const messagesFor = (locale: Locale): Messages => CATALOGS[locale].messages;
export const phrasesFor = (locale: Locale): Phrases => CATALOGS[locale].phrases;

/** Fills `{name}` placeholders. Unknown placeholders are left visible so a typo shows up in testing. */
export function fmt(template: string, vars?: Record<string, string | number>): string {
  return vars ? template.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m)) : template;
}

export type { MessageKey, Messages, Phrases };
