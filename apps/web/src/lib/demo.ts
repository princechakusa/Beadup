// Demo data until the database (Supabase) is connected.

export type VehicleSize = "sedan" | "suv" | "truck";

export type Service = {
  id: string;
  name: string;
  description: string;
  durationMin: number;
  priceCents: Record<VehicleSize, number>;
};

export type AddOn = { id: string; name: string; priceCents: number };

export type Detailer = {
  handle: string;
  businessName: string;
  initials: string;
  tagline: string;
  rating: number;
  reviewCount: number;
  serviceArea: string;
  services: Service[];
  addOns: AddOn[];
  /** Open slots per day offset from today, 24h "HH:MM". */
  slots: string[];
};

const DETAILERS: Record<string, Detailer> = {
  marcus: {
    handle: "marcus",
    businessName: "Marcus Shine Co.",
    initials: "MS",
    tagline: "Mobile detailing · we come to you",
    rating: 4.9,
    reviewCount: 212,
    serviceArea: "Austin, TX · 25 mi",
    services: [
      {
        id: "express",
        name: "Express wash",
        description: "Hand wash, wheels, tires, glass",
        durationMin: 60,
        priceCents: { sedan: 6000, suv: 7000, truck: 8000 },
      },
      {
        id: "full",
        name: "Full detail",
        description: "Inside and out, hand wax, interior deep clean",
        durationMin: 180,
        priceCents: { sedan: 18000, suv: 21000, truck: 23000 },
      },
      {
        id: "ceramic",
        name: "Ceramic coating",
        description: "Paint correction + 2-year ceramic protection",
        durationMin: 360,
        priceCents: { sedan: 65000, suv: 75000, truck: 80000 },
      },
    ],
    addOns: [
      { id: "pet", name: "Pet hair removal", priceCents: 4000 },
      { id: "odor", name: "Odor treatment", priceCents: 3500 },
      { id: "engine", name: "Engine bay clean", priceCents: 3000 },
    ],
    slots: ["08:00", "09:30", "12:00", "14:30", "16:00"],
  },
};

export function getDetailer(handle: string): Detailer | null {
  const key = handle.toLowerCase();
  return Object.hasOwn(DETAILERS, key) ? DETAILERS[key] : null;
}

export function demoHandles(): string[] {
  return Object.keys(DETAILERS);
}
