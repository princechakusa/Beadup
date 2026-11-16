import type { Country } from './format';
import { STARTERS, type TradeId } from './trades';

/**
 * Starter prices (lib/trades.ts STARTERS) are written in US dollars; this
 * scales them to what the service typically costs locally, rounded, so a South
 * African starts at R900, not R60. Only starting values: the business sets
 * its own prices.
 */
const PRICE_SCALE: Record<Country, { factor: number; round: number }> = {
  US: { factor: 1, round: 5 },
  CA: { factor: 1.3, round: 5 },
  AU: { factor: 1.4, round: 5 },
  NZ: { factor: 1.4, round: 5 },
  SG: { factor: 1.2, round: 5 },
  GB: { factor: 0.8, round: 5 },
  AE: { factor: 3.5, round: 10 },
  ZA: { factor: 15, round: 50 },
};
const scalePrice = (usd: string, c: Country) => {
  const { factor, round } = PRICE_SCALE[c];
  return String(Math.max(round, Math.round((Number(usd) * factor) / round) * round));
};
export const startersFor = (t: TradeId, c: Country) => ({
  services: STARTERS[t].services.map((x) => ({ ...x, sedan: scalePrice(x.sedan, c), suv: scalePrice(x.suv, c), truck: scalePrice(x.truck, c) })),
  addOns: STARTERS[t].addOns.map((a) => ({ ...a, price: scalePrice(a.price, c) })),
});
