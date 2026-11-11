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
  NZ: { name: "New Zealand", currency: "NZD", locale: "en-NZ", dial: "64", phoneExample: "021 123 4567" },
  AE: { name: "United Arab Emirates", currency: "AED", locale: "en-AE", dial: "971", phoneExample: "050 123 4567" },
  ZA: { name: "South Africa", currency: "ZAR", locale: "en-ZA", dial: "27", phoneExample: "082 123 4567" },
  SG: { name: "Singapore", currency: "SGD", locale: "en-SG", dial: "65", phoneExample: "9123 4567" },
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
    case "NZ":
      // 021 123 4567 / 027 123456 (mobiles 02x) / 03 123 4567: 0 + 8 to 10 digits.
      if (/^0[2-9]\d{7,9}$/.test(digits)) return `+64${digits.slice(1)}`;
      if (/^64[2-9]\d{7,9}$/.test(digits)) return `+${digits}`;
      return null;
    case "AE":
      // 050 123 4567 (mobiles 05x, 0 + 9 digits) / 04 123 4567 (0 + 8 digits).
      if (/^0[2-9]\d{7,8}$/.test(digits)) return `+971${digits.slice(1)}`;
      if (/^971[2-9]\d{7,8}$/.test(digits)) return `+${digits}`;
      return null;
    case "ZA":
      // 082 123 4567 / 011 123 4567: 0 + 9 digits.
      if (/^0[1-8]\d{8}$/.test(digits)) return `+27${digits.slice(1)}`;
      if (/^27[1-8]\d{8}$/.test(digits)) return `+${digits}`;
      return null;
    case "SG":
      // 9123 4567 / 6123 4567: 8 digits starting 3, 6, 8 or 9 (no trunk 0).
      if (/^[3689]\d{7}$/.test(digits)) return `+65${digits}`;
      if (/^65[3689]\d{7}$/.test(digits)) return `+${digits}`;
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

/**
 * An E.164 number the way people in `country` write it ("+15125550101" ->
 * "(512) 555-0101", "+447700900123" -> "07700 900123"). Numbers from another
 * country stay in international form.
 */
export function formatPhone(e164: string, country: Country): string {
  const dial = COUNTRIES[country].dial;
  if (!e164.startsWith(`+${dial}`)) return e164;
  const n = e164.slice(1 + dial.length);
  const group = (s: string, sizes: number[]) => {
    const out: string[] = [];
    let i = 0;
    for (const size of sizes) {
      if (i >= s.length) break;
      out.push(s.slice(i, i + size));
      i += size;
    }
    if (i < s.length) out[out.length - 1] += s.slice(i);
    return out.join(" ");
  };
  switch (country) {
    case "US":
    case "CA":
      return n.length === 10 ? `(${n.slice(0, 3)}) ${n.slice(3, 6)}-${n.slice(6)}` : e164;
    case "SG":
      return group(n, [4, 4]);
    case "GB":
      return group(`0${n}`, [5, 6]);
    case "AU":
      return group(`0${n}`, [4, 3, 3]);
    default: // NZ, AE, ZA
      return group(`0${n}`, [3, 3, 4]);
  }
}
