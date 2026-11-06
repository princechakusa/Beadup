// Fallback data for running the web app without Supabase (env vars unset).
// Mirrors supabase/seed.sql.
import type { Detailer } from "./booking-types";

const WEEKDAY_SLOTS = ["08:00", "09:30", "12:00", "14:30", "16:00"];

const DETAILERS: Record<string, Detailer> = {
  marcus: {
    handle: "marcus",
    businessName: "Marcus Shine Co.",
    tagline: "Mobile detailing · we come to you",
    serviceArea: "Austin, TX · 25 mi",
    timezone: "America/Chicago",
    rating: 4.7,
    reviewCount: 3,
    services: [
      {
        id: "a0000000-0000-4000-8000-000000000001",
        name: "Express wash",
        description: "Hand wash, wheels, tires, glass",
        durationMin: 60,
        priceCents: { sedan: 6000, suv: 7000, truck: 8000 },
      },
      {
        id: "a0000000-0000-4000-8000-000000000002",
        name: "Full detail",
        description: "Inside and out, hand wax, interior deep clean",
        durationMin: 180,
        priceCents: { sedan: 18000, suv: 21000, truck: 23000 },
      },
      {
        id: "a0000000-0000-4000-8000-000000000003",
        name: "Ceramic coating",
        description: "Paint correction + 2-year ceramic protection",
        durationMin: 360,
        priceCents: { sedan: 65000, suv: 75000, truck: 80000 },
      },
    ],
    addOns: [
      { id: "d0000000-0000-4000-8000-000000000001", name: "Pet hair removal (seats and carpets)", priceCents: 4000 },
      { id: "d0000000-0000-4000-8000-000000000002", name: "Odor treatment", priceCents: 3500 },
      { id: "d0000000-0000-4000-8000-000000000003", name: "Engine bay clean", priceCents: 3000 },
    ],
    taken: [],
    weeklySlots: { "1": WEEKDAY_SLOTS, "2": WEEKDAY_SLOTS, "3": WEEKDAY_SLOTS, "4": WEEKDAY_SLOTS, "5": WEEKDAY_SLOTS, "6": WEEKDAY_SLOTS },
  },
};

export function getDemoDetailer(handle: string): Detailer | null {
  const key = handle.toLowerCase();
  return Object.hasOwn(DETAILERS, key) ? DETAILERS[key] : null;
}
