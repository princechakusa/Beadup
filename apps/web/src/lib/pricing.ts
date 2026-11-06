// All money is handled in integer cents to avoid floating point errors.

/** Card processing estimate for US cards: 2.9% + 30¢. */
const PROCESSOR_RATE = 0.029;
const PROCESSOR_FIXED_CENTS = 30;

export const DEPOSIT_RATE = 0.3;

export function depositCents(totalCents: number): number {
  return Math.round(totalCents * DEPOSIT_RATE);
}

/**
 * Booking fee paid by the client so the detailer receives the full deposit.
 * Solves: (deposit + fee) * (1 - rate) - fixed = deposit
 */
export function bookingFeeCents(chargeCents: number): number {
  if (chargeCents <= 0) return 0;
  const gross = Math.ceil((chargeCents + PROCESSOR_FIXED_CENTS) / (1 - PROCESSOR_RATE));
  return gross - chargeCents;
}

export function formatUsd(cents: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: cents % 100 === 0 ? 0 : 2,
  }).format(cents / 100);
}
