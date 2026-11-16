import type { Country } from './format';
import { t } from './i18n';
import { phrase } from './i18n/phrases';

/**
 * Ways a business can take its deposit without Beadup touching the money.
 * A method is either a web link (PayPal.me, Yoco...), a short note built from
 * one detail (a ShapID, a bank account), or fixed text (pay on the day).
 * The picker lists the methods that exist in the business's country, so
 * nobody needs a "payment link" they don't have.
 */
export type PaymentMethod = {
  id: string;
  label: string;
  hint: string;
  kind: 'link' | 'note' | 'fixed';
  /** What to ask for (note and link methods). */
  detailLabel?: string;
  placeholder?: string;
  /** Builds the text clients see from the typed detail (note methods). */
  note?: (detail: string) => string;
  /** Fixed text (pay on the day). */
  fixed?: string;
};

const link = (id: string, label: string, hint: string, placeholder: string): PaymentMethod => ({
  id,
  label,
  hint,
  kind: 'link',
  detailLabel: `${label} link`,
  placeholder,
});
const note = (id: string, label: string, hint: string, detailLabel: string, placeholder: string, text: (d: string) => string): PaymentMethod => ({
  id,
  label,
  hint,
  kind: 'note',
  detailLabel,
  placeholder,
  note: text,
});

const PAY_ON_DAY: PaymentMethod = {
  id: 'day',
  label: t('pm_day'),
  hint: t('pm_day_d'),
  kind: 'fixed',
  fixed: 'No deposit needed online. Pay on the day by cash, card or transfer.',
};
const CUSTOM: PaymentMethod = { id: 'custom', label: t('pm_custom'), hint: t('pm_custom_d'), kind: 'fixed' };
const PAYPAL = link('paypal', 'PayPal', 'A paypal.me link', 'paypal.me/yourname');

const BY_COUNTRY: Record<Country, PaymentMethod[]> = {
  US: [
    note('zelle', 'Zelle', 'Free bank transfer by phone or email', 'Zelle phone or email', '(512) 555-0101', (d) => `Zelle: ${d}`),
    note('venmo', 'Venmo', 'By @username', 'Venmo username', '@yourname', (d) => `Venmo: ${d.startsWith('@') ? d : `@${d}`}`),
    note('cashapp', 'Cash App', 'By $cashtag', 'Cash App $cashtag', '$yourname', (d) => `Cash App: ${d.startsWith('$') ? d : `$${d}`}`),
    PAYPAL,
    link('square', 'Square', 'A square.link payment link', 'square.link/u/yourname'),
  ],
  CA: [
    note('etransfer', 'Interac e-Transfer', 'By email or phone', 'e-Transfer email or phone', 'you@example.com', (d) => `Interac e-Transfer to: ${d}`),
    PAYPAL,
    link('square', 'Square', 'A square.link payment link', 'square.link/u/yourname'),
  ],
  GB: [
    note('bank', 'Bank transfer', 'Sort code and account number', 'Account name, sort code, number', 'J Smith 12-34-56 12345678', (d) => `Bank transfer: ${d}`),
    link('monzo', 'Monzo', 'A monzo.me link', 'monzo.me/yourname'),
    link('revolut', 'Revolut', 'A revolut.me link', 'revolut.me/yourname'),
    PAYPAL,
  ],
  AU: [
    note('payid', 'PayID', 'Instant payment to your phone or email', 'PayID (phone or email)', '0412 345 678', (d) => `PayID: ${d}`),
    note('bank', 'Bank transfer', 'BSB and account number', 'Account name, BSB, number', 'J Smith 123-456 12345678', (d) => `Bank transfer: ${d}`),
    PAYPAL,
  ],
  NZ: [
    note('bank', 'Bank transfer', 'Account number', 'Account name and number', 'J Smith 12-3456-7890123-00', (d) => `Bank transfer: ${d}`),
    PAYPAL,
  ],
  AE: [
    note('bank', 'Bank transfer', 'IBAN', 'Account name and IBAN', 'J Smith AE07 0331 2345 6789 0123 456', (d) => `Bank transfer: ${d}`),
    PAYPAL,
  ],
  SG: [
    note('paynow', 'PayNow', 'By mobile number or UEN', 'PayNow mobile or UEN', '9123 4567', (d) => `PayNow: ${d}`),
    note('bank', 'Bank transfer', 'Account number', 'Bank and account number', 'DBS 123-456-789', (d) => `Bank transfer: ${d}`),
    PAYPAL,
  ],
  ZA: [
    note('payshap', 'PayShap / Capitec Pay', 'Instant, from any major bank, to your cell number', 'Cell number or ShapID', '082 123 4567', (d) => `PayShap / Capitec Pay to: ${d}`),
    link('yoco', 'Yoco', 'A Yoco payment link (free to set up)', 'pay.yoco.com/yourname'),
    link('payfast', 'PayFast', 'A PayFast payment link', 'payf.st/yourlink'),
    link('snapscan', 'SnapScan', 'Your SnapScan pay link', 'pay.snapscan.io/qr/yourcode'),
    note('eft', 'EFT (bank transfer)', 'Bank, account and branch code', 'Account name, bank, number, branch code', 'J Dlamini, FNB, 62123456789, 250655', (d) => `EFT: ${d}`),
  ],
};

/** The methods for a country, then pay-on-the-day and a free-form option. */
/** The methods are written in English here; the picker shows them in the phone's language (brand names stay as they are). */
const localized = (m: PaymentMethod): PaymentMethod => ({
  ...m,
  label: phrase(m.label),
  hint: phrase(m.hint),
  detailLabel: m.detailLabel?.endsWith(' link') && m.kind === 'link' ? phrase('{m} link').replace('{m}', m.label) : m.detailLabel && phrase(m.detailLabel),
});
export const methodsFor = (country: Country): PaymentMethod[] => [...(BY_COUNTRY[country] ?? []).map(localized), PAY_ON_DAY, CUSTOM];

/** Which method a saved link/note most likely came from, so the form opens on it. */
export function guessMethod(country: Country, linkValue: string | null, noteValue: string | null): PaymentMethod {
  const all = methodsFor(country);
  if (!linkValue && !noteValue) return all[0];
  if (noteValue === PAY_ON_DAY.fixed) return PAY_ON_DAY;
  for (const m of all) {
    if (m.kind === 'note' && noteValue && m.note && noteValue.startsWith(m.note('').trim().replace(/:?\s*$/, ''))) return m;
  }
  return CUSTOM;
}

/** The detail typed for a note method, recovered from the saved note. */
export function detailFromNote(m: PaymentMethod, noteValue: string | null): string {
  if (!noteValue || m.kind !== 'note' || !m.note) return '';
  const prefix = m.note('');
  return noteValue.startsWith(prefix) ? noteValue.slice(prefix.length) : '';
}
