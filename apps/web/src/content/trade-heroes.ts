/**
 * Trades that have a hero photo at /hero/trades/<slug>.webp (1280 x 731).
 * A trade without one shows a clean dark-glass banner instead. To add a
 * photo: save it in public/hero/trades/, add the slug here (the unit test
 * checks the list matches the files), nothing else changes.
 * Made with Google Stitch (prompts in docs/marketing/trade-hero-prompts.md); scripts/trade-hero-gen.py is a free fallback.
 */
export const TRADE_HERO_SLUGS: ReadonlySet<string> = new Set(["barbers", "boat-rv-detailers", "car-detailers", "hair-salon", "handymen", "house-cleaners", "makeup-artists", "mobile-mechanics", "nail-technicians", "pet-groomers", "pressure-washing", "window-cleaners"]);

export const tradeHeroSrc = (slug: string): string | null => (TRADE_HERO_SLUGS.has(slug) ? `/hero/trades/${slug}.webp` : null);
