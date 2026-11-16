import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { composeEmail } from "../email";
import { emailCatalog, emailEn, type EmailKey } from "./email";
import { LOCALES } from "./index";

const placeholders = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();

const base = {
  id: "11111111-1111-4111-8111-111111111111",
  status: "queued",
  to: "ann@example.com",
  firstName: "Ann",
  businessName: "Marcus Shine Co.",
  handle: "marcus",
  contactPhone: "+15125550101",
  country: "US" as const,
  timezone: "America/Chicago",
  trade: "detailing",
  visitMode: "mobile",
  serviceArea: "Austin",
  paymentLink: null,
  paymentNote: "Zelle: (512) 555-0101",
  payments: "external",
  serviceName: "Full detail",
  staffName: null,
  vehicleSize: "suv" as const,
  startsAt: "2026-11-20T15:00:00Z",
  durationMin: 120,
  address: "1 Main St",
  subtotalCents: 20000,
  depositCents: 6000,
  depositReceived: false,
  clientToken: "a".repeat(48),
  reviewToken: "b".repeat(48),
  ref: "ABCD1234",
};

describe("client emails in the client's language", () => {
  it.each(LOCALES)("%s has every email key with the same placeholders as English", (lang) => {
    const c = emailCatalog(lang);
    for (const key of Object.keys(emailEn) as EmailKey[]) {
      expect(c[key], `${lang}.${key}`).toBeTruthy();
      expect(placeholders(c[key]), `${lang}.${key}`).toEqual(placeholders(emailEn[key]));
    }
  });

  it.each(LOCALES)("%s: every kind composes with no placeholder left over", (lang) => {
    for (const kind of ["confirmation", "reminder", "rescheduled", "cancelled", "receipt"] as const) {
      const m = composeEmail({ ...base, kind, lang });
      for (const part of [m.subject, m.text, m.html]) expect(part, `${lang} ${kind}`).not.toMatch(/\{[a-z]+\}/);
      expect(m.html).toContain(`lang="${lang}"`);
    }
  });

  it("French confirmation is written in French, English stays English, unknown falls back", () => {
    expect(composeEmail({ ...base, kind: "confirmation", lang: "fr" }).subject).toBe("Votre réservation chez Marcus Shine Co. est confirmée");
    expect(composeEmail({ ...base, kind: "confirmation", lang: "en" }).subject).toBe("You're booked with Marcus Shine Co.");
    expect(composeEmail({ ...base, kind: "confirmation", lang: "xx" }).subject).toBe("You're booked with Marcus Shine Co.");
  });

  it("the size label and the deposit line are translated", () => {
    const m = composeEmail({ ...base, kind: "confirmation", lang: "es" });
    expect(m.text).toContain("SUV");
    expect(m.text).toContain("Paga tu depósito");
  });
});
