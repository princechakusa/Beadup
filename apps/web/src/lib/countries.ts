/**
 * Countries Beadup works in (every App Store country it's available in).
 * The detailer's country sets the currency on their booking page and how
 * their clients' local phone numbers are read. Keep in step with
 * `detailers_country_supported` and `country_currency()` in the database.
 */
export const COUNTRIES = {
  US: { name: "United States", currency: "USD", locale: "en-US", dial: "1", phoneExample: "(512) 555-0101" },
  CA: { name: "Canada", currency: "CAD", locale: "en-CA", dial: "1", phoneExample: "(416) 555-0101" },
  GB: { name: "United Kingdom", currency: "GBP", locale: "en-GB", dial: "44", phoneExample: "07700 900123" },
  AU: { name: "Australia", currency: "AUD", locale: "en-AU", dial: "61", phoneExample: "0412 345 678" },
} as const;

export type Country = keyof typeof COUNTRIES;
export const COUNTRY_CODES = Object.keys(COUNTRIES) as Country[];

/**
 * A client's phone number in E.164 ("+447700900123"), read the way people
 * write numbers in the detailer's country. A number typed with a leading "+"
 * is taken as international, so visitors from abroad can still book.
 * Returns null when it can't be a real number.
 */
export function toE164(raw: string, country: Country): string | null {
  const trimmed = raw.trim();
  const digits = trimmed.replace(/\D/g, "");
  if (trimmed.startsWith("+") || trimmed.startsWith("00")) {
    const intl = trimmed.startsWith("00") ? digits.slice(2) : digits;
    return /^[1-9]\d{7,14}$/.test(intl) ? `+${intl}` : null;
  }
  switch (country) {
    case "US":
    case "CA":
      if (/^[2-9]\d{9}$/.test(digits)) return `+1${digits}`;
      if (/^1[2-9]\d{9}$/.test(digits)) return `+${digits}`;
      return null;
    case "GB":
      // 07700 900123 / 020 7946 0018 (0 + 10 digits), or 44... written without "+".
      if (/^0[1-9]\d{9}$/.test(digits)) return `+44${digits.slice(1)}`;
      if (/^44[1-9]\d{9}$/.test(digits)) return `+${digits}`;
      return null;
    case "AU":
      // 0412 345 678 / 02 9374 4000 (0 + 9 digits), or 61... written without "+".
      if (/^0[2-9]\d{8}$/.test(digits)) return `+61${digits.slice(1)}`;
      if (/^61[2-9]\d{8}$/.test(digits)) return `+${digits}`;
      return null;
  }
}

/** Money in minor units (cents/pence) in the detailer's currency: "$180", "£60", "$75.50". */
export function formatMoney(cents: number, country: Country = "US"): string {
  const c = COUNTRIES[country] ?? COUNTRIES.US;
  return new Intl.NumberFormat(c.locale, {
    style: "currency",
    currency: c.currency,
    minimumFractionDigits: cents % 100 === 0 ? 0 : 2,
  }).format(cents / 100);
}
