/**
 * The trades Beadup works for, and how each one books. A business picks its
 * trade at sign-up; everything a client sees follows from it: the words, how
 * prices work, whether the client comes to the business or the business comes
 * to them, and whether services lead with a photo.
 *
 * Keep in step with apps/mobile/src/lib/trades.ts (trades.test.ts compares
 * them) and the detailers_trade_check constraint in the database.
 *
 * Prices are stored in three tier columns (price_sedan/suv/truck_cents, named
 * for the first trade). Tiered trades label them per trade (Sedan/SUV/Truck,
 * Small/Medium/Large dog...). Single-price trades store the same price in all
 * three and never show a size step.
 */
export const TRADE_IDS = [
  "detailing",
  "boat_rv",
  "pressure_washing",
  "window_cleaning",
  "house_cleaning",
  "pet_grooming",
  "hair_salon",
  "barber",
  "nails_beauty",
  "makeup",
  "mechanic",
  "handyman",
  "other",
] as const;
export type TradeId = (typeof TRADE_IDS)[number];
export type Tier = "sedan" | "suv" | "truck";

export type Trade = {
  name: string;
  /** What the client calls the provider: "detailer", "stylist". */
  provider: string;
  /** Step 1 title on the booking page. */
  pickTitle: string;
  /** "tiers": price depends on a size the client picks; "single": one price. */
  pricing: "tiers" | "single";
  /** Labels for the three price tiers (tiered trades). */
  tiers: Record<Tier, string>;
  /** Title of the size step (tiered trades). */
  tierTitle: string;
  /** Default for new businesses: they go to the client, or the client comes to them. */
  visit: "mobile" | "studio";
  /** Services lead with a photo (a hairstyle, a nail set). */
  photoFirst: boolean;
  /** schema.org type for the booking page's structured data. */
  schemaType: string;
};

const SIZE = { sedan: "Small", suv: "Medium", truck: "Large" };

export const TRADES: Record<TradeId, Trade> = {
  detailing: { name: "Car detailing", provider: "detailer", pickTitle: "Pick your detail", pricing: "tiers", tiers: { sedan: "Sedan", suv: "SUV", truck: "Truck" }, tierTitle: "Your vehicle", visit: "mobile", photoFirst: false, schemaType: "AutoWash" },
  boat_rv: { name: "Boat & RV detailing", provider: "detailer", pickTitle: "Pick your detail", pricing: "tiers", tiers: { sedan: "Up to 20 ft", suv: "20 to 30 ft", truck: "Over 30 ft" }, tierTitle: "Your boat or RV", visit: "mobile", photoFirst: false, schemaType: "AutoWash" },
  pressure_washing: { name: "Pressure washing", provider: "pro", pickTitle: "Pick a service", pricing: "tiers", tiers: SIZE, tierTitle: "Size of the job", visit: "mobile", photoFirst: false, schemaType: "HomeAndConstructionBusiness" },
  window_cleaning: { name: "Window cleaning", provider: "cleaner", pickTitle: "Pick a service", pricing: "tiers", tiers: { sedan: "1 to 2 bedrooms", suv: "3 bedrooms", truck: "4+ bedrooms" }, tierTitle: "Your home", visit: "mobile", photoFirst: false, schemaType: "HomeAndConstructionBusiness" },
  house_cleaning: { name: "Home cleaning", provider: "cleaner", pickTitle: "Pick a clean", pricing: "tiers", tiers: { sedan: "1 to 2 bedrooms", suv: "3 bedrooms", truck: "4+ bedrooms" }, tierTitle: "Your home", visit: "mobile", photoFirst: false, schemaType: "LocalBusiness" },
  pet_grooming: { name: "Pet grooming", provider: "groomer", pickTitle: "Pick a groom", pricing: "tiers", tiers: { sedan: "Small dog", suv: "Medium dog", truck: "Large dog" }, tierTitle: "Your dog", visit: "mobile", photoFirst: true, schemaType: "LocalBusiness" },
  hair_salon: { name: "Hair salon", provider: "stylist", pickTitle: "Choose your style", pricing: "single", tiers: SIZE, tierTitle: "", visit: "studio", photoFirst: true, schemaType: "HairSalon" },
  barber: { name: "Barber", provider: "barber", pickTitle: "Choose your cut", pricing: "single", tiers: SIZE, tierTitle: "", visit: "studio", photoFirst: true, schemaType: "BarberShop" },
  nails_beauty: { name: "Nails & beauty", provider: "technician", pickTitle: "Choose your look", pricing: "single", tiers: SIZE, tierTitle: "", visit: "studio", photoFirst: true, schemaType: "NailSalon" },
  makeup: { name: "Makeup artist", provider: "artist", pickTitle: "Choose your look", pricing: "single", tiers: SIZE, tierTitle: "", visit: "mobile", photoFirst: true, schemaType: "BeautySalon" },
  mechanic: { name: "Mechanic", provider: "mechanic", pickTitle: "Pick a service", pricing: "single", tiers: SIZE, tierTitle: "", visit: "mobile", photoFirst: false, schemaType: "AutoRepair" },
  handyman: { name: "Handyman & repairs", provider: "pro", pickTitle: "Pick a service", pricing: "single", tiers: SIZE, tierTitle: "", visit: "mobile", photoFirst: false, schemaType: "HomeAndConstructionBusiness" },
  other: { name: "Other service", provider: "pro", pickTitle: "Pick a service", pricing: "single", tiers: SIZE, tierTitle: "", visit: "mobile", photoFirst: false, schemaType: "LocalBusiness" },
};

export const isTradeId = (t: unknown): t is TradeId => typeof t === "string" && (TRADE_IDS as readonly string[]).includes(t);
export const tradeOf = (t: unknown): Trade => TRADES[isTradeId(t) ? t : "detailing"];

/** The size label for a booking, or "" for single-price trades. */
export function tierLabel(trade: unknown, tier: Tier): string {
  const t = tradeOf(trade);
  return t.pricing === "tiers" ? t.tiers[tier] : "";
}
