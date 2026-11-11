// Phone numbers, read and written the way people do in the detailer's country.
// Same rules as apps/web/src/lib/countries.ts (toE164, formatPhone); phone.test.ts
// pins the two together, so change both.
import type { Country } from './format';

const DIAL: Record<Country, string> = { US: '1', CA: '1', GB: '44', AU: '61', NZ: '64', AE: '971', ZA: '27', SG: '65' };

/**
 * A phone number in E.164 ('+447700900123'). A number typed with a leading
 * '+' is taken as international. Returns null when it can't be a real number.
 */
export function toE164(raw: string, country: Country): string | null {
  const trimmed = raw.trim();
  const digits = trimmed.replace(/\D/g, '');
  if (trimmed.startsWith('+') || trimmed.startsWith('00')) {
    const intl = trimmed.startsWith('00') ? digits.slice(2) : digits;
    return /^[1-9]\d{7,14}$/.test(intl) ? `+${intl}` : null;
  }
  switch (country) {
    case 'US':
    case 'CA':
      if (/^[2-9]\d{9}$/.test(digits)) return `+1${digits}`;
      if (/^1[2-9]\d{9}$/.test(digits)) return `+${digits}`;
      return null;
    case 'GB':
      // 07700 900123 / 020 7946 0018 (0 + 10 digits), or 44... written without '+'.
      if (/^0[1-9]\d{9}$/.test(digits)) return `+44${digits.slice(1)}`;
      if (/^44[1-9]\d{9}$/.test(digits)) return `+${digits}`;
      return null;
    case 'AU':
      // 0412 345 678 / 02 9374 4000 (0 + 9 digits), or 61... written without '+'.
      if (/^0[2-9]\d{8}$/.test(digits)) return `+61${digits.slice(1)}`;
      if (/^61[2-9]\d{8}$/.test(digits)) return `+${digits}`;
      return null;
    case 'NZ':
      // 021 123 4567 / 027 123456 (mobiles 02x) / 03 123 4567: 0 + 8 to 10 digits.
      if (/^0[2-9]\d{7,9}$/.test(digits)) return `+64${digits.slice(1)}`;
      if (/^64[2-9]\d{7,9}$/.test(digits)) return `+${digits}`;
      return null;
    case 'AE':
      // 050 123 4567 (mobiles 05x, 0 + 9 digits) / 04 123 4567 (0 + 8 digits).
      if (/^0[2-9]\d{7,8}$/.test(digits)) return `+971${digits.slice(1)}`;
      if (/^971[2-9]\d{7,8}$/.test(digits)) return `+${digits}`;
      return null;
    case 'ZA':
      // 082 123 4567 / 011 123 4567: 0 + 9 digits.
      if (/^0[1-8]\d{8}$/.test(digits)) return `+27${digits.slice(1)}`;
      if (/^27[1-8]\d{8}$/.test(digits)) return `+${digits}`;
      return null;
    case 'SG':
      // 9123 4567 / 6123 4567: 8 digits starting 3, 6, 8 or 9 (no trunk 0).
      if (/^[3689]\d{7}$/.test(digits)) return `+65${digits}`;
      if (/^65[3689]\d{7}$/.test(digits)) return `+${digits}`;
      return null;
  }
}

/**
 * An E.164 number the way people in `country` write it. Numbers from another
 * country stay in international form.
 */
export function formatPhone(e164: string, country: Country): string {
  const dial = DIAL[country];
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
    return out.join(' ');
  };
  switch (country) {
    case 'US':
    case 'CA':
      return n.length === 10 ? `(${n.slice(0, 3)}) ${n.slice(3, 6)}-${n.slice(6)}` : e164;
    case 'SG':
      return group(n, [4, 4]);
    case 'GB':
      return group(`0${n}`, [5, 6]);
    case 'AU':
      return group(`0${n}`, [4, 3, 3]);
    default: // NZ, AE, ZA
      return group(`0${n}`, [3, 3, 4]);
  }
}
