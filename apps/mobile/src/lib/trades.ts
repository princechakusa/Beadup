/**
 * The trades Beadup works for, and how each one books. A business picks its
 * trade at sign-up; everything a client sees follows from it: the words, how
 * prices work, whether the client comes to the business or the business comes
 * to them, and whether services lead with a photo.
 *
 * Same as apps/web/src/lib/trades.ts (trades.test.ts compares them) and the
 * detailers_trade_check constraint in the database.
 *
 * Prices are stored in three tier columns (price_sedan/suv/truck_cents, named
 * for the first trade). Tiered trades label them per trade (Sedan/SUV/Truck,
 * Small/Medium/Large dog...). Single-price trades store the same price in all
 * three and never show a size step.
 */
export const TRADE_IDS = [
  'detailing',
  'boat_rv',
  'pressure_washing',
  'window_cleaning',
  'house_cleaning',
  'pet_grooming',
  'hair_salon',
  'barber',
  'nails_beauty',
  'makeup',
  'mechanic',
  'handyman',
  'other',
] as const;
export type TradeId = (typeof TRADE_IDS)[number];
export type Tier = 'sedan' | 'suv' | 'truck';

export type Trade = {
  name: string;
  /** What the client calls the provider: 'detailer', 'stylist'. */
  provider: string;
  /** Step 1 title on the booking page. */
  pickTitle: string;
  /** 'tiers': price depends on a size the client picks; 'single': one price. */
  pricing: 'tiers' | 'single';
  /** Labels for the three price tiers (tiered trades). */
  tiers: Record<Tier, string>;
  /** Title of the size step (tiered trades). */
  tierTitle: string;
  /** Default for new businesses: they go to the client, or the client comes to them. */
  visit: 'mobile' | 'studio';
  /** Services lead with a photo (a hairstyle, a nail set). */
  photoFirst: boolean;
  /** schema.org type for the booking page's structured data. */
  schemaType: string;
};

const SIZE = { sedan: 'Small', suv: 'Medium', truck: 'Large' };

export const TRADES: Record<TradeId, Trade> = {
  detailing: { name: 'Car detailing', provider: 'detailer', pickTitle: 'Pick your detail', pricing: 'tiers', tiers: { sedan: 'Sedan', suv: 'SUV', truck: 'Truck' }, tierTitle: 'Your vehicle', visit: 'mobile', photoFirst: false, schemaType: 'AutoWash' },
  boat_rv: { name: 'Boat & RV detailing', provider: 'detailer', pickTitle: 'Pick your detail', pricing: 'tiers', tiers: { sedan: 'Up to 20 ft', suv: '20 to 30 ft', truck: 'Over 30 ft' }, tierTitle: 'Your boat or RV', visit: 'mobile', photoFirst: false, schemaType: 'AutoWash' },
  pressure_washing: { name: 'Pressure washing', provider: 'pro', pickTitle: 'Pick a service', pricing: 'tiers', tiers: SIZE, tierTitle: 'Size of the job', visit: 'mobile', photoFirst: false, schemaType: 'HomeAndConstructionBusiness' },
  window_cleaning: { name: 'Window cleaning', provider: 'cleaner', pickTitle: 'Pick a service', pricing: 'tiers', tiers: { sedan: '1 to 2 bedrooms', suv: '3 bedrooms', truck: '4+ bedrooms' }, tierTitle: 'Your home', visit: 'mobile', photoFirst: false, schemaType: 'HomeAndConstructionBusiness' },
  house_cleaning: { name: 'Home cleaning', provider: 'cleaner', pickTitle: 'Pick a clean', pricing: 'tiers', tiers: { sedan: '1 to 2 bedrooms', suv: '3 bedrooms', truck: '4+ bedrooms' }, tierTitle: 'Your home', visit: 'mobile', photoFirst: false, schemaType: 'LocalBusiness' },
  pet_grooming: { name: 'Pet grooming', provider: 'groomer', pickTitle: 'Pick a groom', pricing: 'tiers', tiers: { sedan: 'Small dog', suv: 'Medium dog', truck: 'Large dog' }, tierTitle: 'Your dog', visit: 'mobile', photoFirst: true, schemaType: 'LocalBusiness' },
  hair_salon: { name: 'Hair salon', provider: 'stylist', pickTitle: 'Choose your style', pricing: 'single', tiers: SIZE, tierTitle: '', visit: 'studio', photoFirst: true, schemaType: 'HairSalon' },
  barber: { name: 'Barber', provider: 'barber', pickTitle: 'Choose your cut', pricing: 'single', tiers: SIZE, tierTitle: '', visit: 'studio', photoFirst: true, schemaType: 'BarberShop' },
  nails_beauty: { name: 'Nails & beauty', provider: 'technician', pickTitle: 'Choose your look', pricing: 'single', tiers: SIZE, tierTitle: '', visit: 'studio', photoFirst: true, schemaType: 'NailSalon' },
  makeup: { name: 'Makeup artist', provider: 'artist', pickTitle: 'Choose your look', pricing: 'single', tiers: SIZE, tierTitle: '', visit: 'mobile', photoFirst: true, schemaType: 'BeautySalon' },
  mechanic: { name: 'Mechanic', provider: 'mechanic', pickTitle: 'Pick a service', pricing: 'single', tiers: SIZE, tierTitle: '', visit: 'mobile', photoFirst: false, schemaType: 'AutoRepair' },
  handyman: { name: 'Handyman & repairs', provider: 'pro', pickTitle: 'Pick a service', pricing: 'single', tiers: SIZE, tierTitle: '', visit: 'mobile', photoFirst: false, schemaType: 'HomeAndConstructionBusiness' },
  other: { name: 'Other service', provider: 'pro', pickTitle: 'Pick a service', pricing: 'single', tiers: SIZE, tierTitle: '', visit: 'mobile', photoFirst: false, schemaType: 'LocalBusiness' },
};

export const isTradeId = (t: unknown): t is TradeId => typeof t === 'string' && (TRADE_IDS as readonly string[]).includes(t);
export const tradeOf = (t: unknown): Trade => TRADES[isTradeId(t) ? t : 'detailing'];

/** The size label for a booking, or '' for single-price trades. */
export function tierLabel(trade: unknown, tier: Tier): string {
  const t = tradeOf(trade);
  return t.pricing === 'tiers' ? t.tiers[tier] : '';
}

// ---------------------------------------------------------------------------
// App only: the signed-in business's trade (set when the profile loads), and
// starter services for onboarding. Starter prices are US dollars; onboarding
// scales them to the business's country.

let current: TradeId = 'detailing';
export function setCurrentTrade(t: unknown) {
  current = isTradeId(t) ? t : 'detailing';
}
export const currentTrade = (): Trade => TRADES[current];
export const currentTradeId = (): TradeId => current;

/** The size label for a booking of the signed-in business ('SUV', 'Large dog'), or ''. */
export const sizeLabel = (tier: Tier): string => tierLabel(current, tier);

export type Starter = { name: string; description: string; durationMin: number; sedan: string; suv: string; truck: string; on: boolean };
export type StarterAddOn = { name: string; price: string; on: boolean };

const one = (name: string, description: string, durationMin: number, price: number, on = true): Starter => ({
  name, description, durationMin, sedan: String(price), suv: String(price), truck: String(price), on,
});
const sized = (name: string, description: string, durationMin: number, p: [number, number, number], on = true): Starter => ({
  name, description, durationMin, sedan: String(p[0]), suv: String(p[1]), truck: String(p[2]), on,
});
const extra = (name: string, price: number, on = false): StarterAddOn => ({ name, price: String(price), on });

export const STARTERS: Record<TradeId, { services: Starter[]; addOns: StarterAddOn[] }> = {
  detailing: {
    services: [
      sized('Express wash', 'Hand wash, wheels, tires, glass', 60, [60, 70, 80]),
      sized('Full detail', 'Inside and out, hand wax, interior deep clean', 180, [180, 210, 230]),
      sized('Interior refresh', 'Vacuum, wipe-down, glass, mats', 120, [120, 140, 150], false),
    ],
    addOns: [extra('Pet hair removal (seats and carpets)', 40, true), extra('Odor treatment', 35), extra('Engine bay clean', 30)],
  },
  boat_rv: {
    services: [
      sized('Exterior wash', 'Hull, deck and windows', 120, [120, 180, 260]),
      sized('Wash and wax', 'Wash, oxidation polish and wax', 240, [250, 380, 520]),
      sized('Interior clean', 'Cabin vacuum, wipe-down and glass', 180, [150, 200, 300], false),
    ],
    addOns: [extra('Oxidation removal', 150), extra('Teak cleaning', 80)],
  },
  pressure_washing: {
    services: [
      sized('Driveway', 'Driveway and walkway', 120, [120, 180, 250]),
      sized('House wash', 'Soft wash of the outside walls', 180, [250, 350, 450]),
      sized('Deck or patio', 'Deck, patio or pool area', 150, [150, 220, 300], false),
    ],
    addOns: [extra('Gutter flush', 80), extra('Sealant', 120)],
  },
  window_cleaning: {
    services: [
      sized('Outside windows', 'All outside windows, frames wiped', 120, [120, 160, 220]),
      sized('Inside and out', 'Every window, both sides', 180, [200, 260, 340]),
    ],
    addOns: [extra('Screens', 30), extra('Tracks and sills', 40)],
  },
  house_cleaning: {
    services: [
      sized('Standard clean', 'Kitchen, bathrooms, floors, dusting', 180, [120, 160, 220]),
      sized('Deep clean', 'Top to bottom, inside cupboards and appliances', 300, [220, 300, 400]),
      sized('Move-out clean', 'Empty home, ready for the next tenant', 360, [300, 400, 520], false),
    ],
    addOns: [extra('Inside the fridge', 30), extra('Inside the oven', 35), extra('Laundry', 25)],
  },
  pet_grooming: {
    services: [
      sized('Full groom', 'Bath, cut, nails and ears', 120, [70, 90, 120]),
      sized('Bath and tidy', 'Bath, brush and a light trim', 75, [50, 65, 85]),
      sized('Nail trim', 'Nails clipped and filed', 15, [20, 20, 25], false),
    ],
    addOns: [extra('Teeth brushing', 15), extra('De-shedding', 25)],
  },
  hair_salon: {
    services: [
      one('Knotless braids', 'Medium size, mid-back length', 300, 180),
      one('Silk press', 'Wash, blow-dry and press', 90, 80),
      one('Wash and style', 'Wash, treatment and styling', 60, 50),
    ],
    addOns: [extra('Hair included', 40), extra('Deep conditioning', 20)],
  },
  barber: {
    services: [
      one('Haircut', 'Cut, line-up and style', 45, 30),
      one('Cut and beard', 'Haircut plus beard trim and shape', 60, 40),
      one('Kids cut', 'Under 12', 30, 20),
    ],
    addOns: [extra('Hot towel', 10), extra('Hair design', 10)],
  },
  nails_beauty: {
    services: [
      one('Gel manicure', 'Shape, cuticles and gel colour', 60, 40),
      one('Acrylic full set', 'Full set with your choice of shape', 90, 60),
      one('Pedicure', 'Soak, scrub, shape and polish', 60, 45),
    ],
    addOns: [extra('Nail art', 15), extra('Removal', 10)],
  },
  makeup: {
    services: [
      one('Event makeup', 'Full face for a night out or event', 60, 90),
      one('Bridal makeup', 'Long-wear bridal look', 120, 250),
      one('Trial session', 'Try your look before the day', 60, 70, false),
    ],
    addOns: [extra('Lashes', 20), extra('Travel outside my area', 30)],
  },
  mechanic: {
    services: [
      one('Oil and filter change', 'Oil, filter and a quick check', 60, 80),
      one('Diagnostics', 'Fault codes read and explained', 60, 60),
      one('Brake pads (per axle)', 'Pads fitted and checked', 120, 150),
    ],
    addOns: [],
  },
  handyman: {
    services: [
      one('Small job (1 hour)', 'Repairs, fitting, odd jobs', 60, 60),
      one('Half day', 'Up to 4 hours of work', 240, 220),
      one('TV mounting', 'Wall mount fitted and cables tidied', 90, 90),
    ],
    addOns: [extra('Materials pickup', 25)],
  },
  other: {
    services: [one('Standard service', 'Describe what you do', 60, 60), one('Extended service', 'A longer appointment', 120, 110)],
    addOns: [],
  },
};
