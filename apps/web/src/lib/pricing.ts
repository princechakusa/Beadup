// All money is handled in integer cents to avoid floating point errors.

/** Card processing estimate for US cards: 2.9% + 30¢. */
// Rate 2.9% is encoded as the 971/1000 factor in bookingFeeCents.
const PROCESSOR_FIXED_CENTS = 30;

export const DEPOSIT_RATE = 0.3;

// Integer math only, mirrored exactly by public.deposit_cents() and
// public.booking_fee_cents() in Postgres, so the estimate shown here always
// equals what the server charges.
export function depositCents(totalCents: number): number {
  return Math.floor((totalCents * 3 + 5) / 10); // 30%, half up
}

/**
 * Booking fee paid by the client so the detailer receives the full deposit.
 * Solves: (deposit + fee) * (1 - rate) - fixed = deposit
 */
export function bookingFeeCents(chargeCents: number): number {
  if (chargeCents <= 0) return 0;
  // ceil((charge + 30) / 0.971) without floating point.
  const gross = Math.floor(((chargeCents + PROCESSOR_FIXED_CENTS) * 1000 + 970) / 971);
  return gross - chargeCents;
}

export function formatUsd(cents: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: cents % 100 === 0 ? 0 : 2,
  }).format(cents / 100);
}
