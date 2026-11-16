/**
 * Trades that have a hero photo at /hero/trades/<slug>.webp (1280 x 731).
 * A trade without one shows a clean dark-glass banner instead. To add a
 * photo: save it in public/hero/trades/, add the slug here (the unit test
 * checks the list matches the files), nothing else changes.
 * Generate them with scripts/trade-hero-gen.py (free Hugging Face space).
 */
export const TRADE_HERO_SLUGS: ReadonlySet<string> = new Set(["barbers", "boat-rv-detailers", "car-detailers", "pressure-washing", "window-cleaners"]);

export const tradeHeroSrc = (slug: string): string | null => (TRADE_HERO_SLUGS.has(slug) ? `/hero/trades/${slug}.webp` : null);
