import { describe, expect, it } from "vitest";
import { en } from "./en";
import { fmt, LOCALES, messagesFor, negotiate, phrasesFor } from "./index";

const placeholders = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();

describe("i18n", () => {
  it("negotiates the best supported language from Accept-Language", () => {
    expect(negotiate("fr-CA,fr;q=0.9,en;q=0.8")).toBe("fr");
    expect(negotiate("de-DE,de;q=0.9,pt-BR;q=0.8")).toBe("pt");
    expect(negotiate("es")).toBe("es");
    expect(negotiate("ar,he;q=0.9")).toBe("en");
    expect(negotiate("")).toBe("en");
    expect(negotiate(null)).toBe("en");
    expect(negotiate("en;q=0.1,es;q=0.9")).toBe("es");
  });

  it("fills placeholders and leaves unknown ones visible", () => {
    expect(fmt("Hi {name}, {n} left", { name: "Sam", n: 3 })).toBe("Hi Sam, 3 left");
    expect(fmt("Hi {name}")).toBe("Hi {name}");
    expect(fmt("Hi {who}", { name: "Sam" })).toBe("Hi {who}");
  });

  it.each(LOCALES)("%s has every key, with the same placeholders as English and no empty text", (locale) => {
    const m = messagesFor(locale) as Record<string, string>;
    for (const [key, english] of Object.entries(en)) {
      expect(m[key], `${locale}.${key} missing`).toBeTruthy();
      expect(placeholders(m[key]!), `${locale}.${key} placeholders`).toEqual(placeholders(english));
    }
    expect(Object.keys(m).sort()).toEqual(Object.keys(en).sort());
  });

  it.each(["es", "fr", "pt"] as const)("%s translates the trade phrases and keeps the number of entries equal", (locale) => {
    const phrases = phrasesFor(locale);
    expect(Object.keys(phrases).length).toBe(Object.keys(phrasesFor("es")).length);
    for (const v of Object.values(phrases)) expect(v.trim()).not.toBe("");
  });
});
