import type { Balance, Booking, CatalogAddOn, CatalogService, ClientSummary, Payment, Profile } from './data';

// Sample data for development builds with no backend configured
// (EXPO_PUBLIC_SUPABASE_* unset). Never used when Supabase is configured.

const day = 86_400_000;
const at = (offsetDays: number, h: number, m = 0) => {
  const d = new Date();
  d.setHours(h, m, 0, 0);
  return new Date(d.getTime() + offsetDays * day).toISOString();
};

const people = [
  { id: 'c1', name: 'Jenna Rivera', phone: '+15125550101' },
  { id: 'c2', name: 'Dev Patel', phone: '+15125550102' },
  { id: 'c3', name: 'Ana Martinez', phone: '+15125550103' },
  { id: 'c4', name: 'Kevin Lee', phone: '+15125550104' },
];

const allBookings: Booking[] = [
  { id: 'b1', startsAt: at(0, 9, 30), durationMin: 180, serviceName: 'Full detail', vehicleSize: 'suv', status: 'confirmed', subtotalCents: 24000, depositCents: 7200, address: '1200 Barton Springs Rd, Austin', addOns: [{ name: 'Pet hair removal (seats and carpets)' }], client: people[0] },
  { id: 'b2', startsAt: at(0, 13), durationMin: 90, serviceName: 'Interior refresh', vehicleSize: 'truck', status: 'confirmed', subtotalCents: 14000, depositCents: 4200, address: '500 E 6th St, Austin', addOns: [], client: people[1] },
  { id: 'b3', startsAt: at(0, 16), durationMin: 360, serviceName: 'Ceramic coating', vehicleSize: 'suv', status: 'confirmed', subtotalCents: 75000, depositCents: 22500, address: '2100 S Lamar Blvd, Austin', addOns: [], client: people[2] },
  { id: 'b4', startsAt: at(1, 8), durationMin: 60, serviceName: 'Express wash', vehicleSize: 'sedan', status: 'confirmed', subtotalCents: 6000, depositCents: 1800, address: '88 Rainey St, Austin', addOns: [], client: people[3] },
  { id: 'b5', startsAt: at(-1, 10), durationMin: 180, serviceName: 'Full detail', vehicleSize: 'sedan', status: 'completed', subtotalCents: 18000, depositCents: 5400, address: '12 Congress Ave, Austin', addOns: [], client: people[0] },
  { id: 'b6', startsAt: at(-2, 9, 30), durationMin: 60, serviceName: 'Express wash', vehicleSize: 'suv', status: 'completed', subtotalCents: 7000, depositCents: 2100, address: '700 W 5th St, Austin', addOns: [], client: people[3] },
  { id: 'b7', startsAt: at(-3, 14, 30), durationMin: 180, serviceName: 'Full detail', vehicleSize: 'truck', status: 'completed', subtotalCents: 23000, depositCents: 6900, address: '4 Lady Bird Ln, Austin', addOns: [], client: people[2] },
];

const catalog: { services: CatalogService[]; addOns: CatalogAddOn[] } = {
  services: [
    { id: 's1', name: 'Express wash', description: 'Hand wash, wheels, tires, glass', durationMin: 60, priceCents: { sedan: 6000, suv: 7000, truck: 8000 }, active: true, sortOrder: 1 },
    { id: 's2', name: 'Full detail', description: 'Inside and out, hand wax, interior deep clean', durationMin: 180, priceCents: { sedan: 18000, suv: 21000, truck: 23000 }, active: true, sortOrder: 2 },
    { id: 's3', name: 'Ceramic coating', description: 'Paint correction + 2-year ceramic protection', durationMin: 360, priceCents: { sedan: 65000, suv: 75000, truck: 80000 }, active: true, sortOrder: 3 },
  ],
  addOns: [
    { id: 'a1', name: 'Pet hair removal (seats and carpets)', priceCents: 4000, active: true, sortOrder: 1 },
    { id: 'a2', name: 'Odor treatment', priceCents: 3500, active: true, sortOrder: 2 },
    { id: 'a3', name: 'Engine bay clean', priceCents: 3000, active: true, sortOrder: 3 },
  ],
};

export const fixtures = {
  catalog,
  profile: { id: 'preview', handle: 'marcus', businessName: 'Marcus Shine Co.', timezone: 'America/Chicago' } satisfies Profile,
  bookings: (from: Date, to: Date) =>
    allBookings.filter((b) => Date.parse(b.startsAt) >= from.getTime() && Date.parse(b.startsAt) < to.getTime()),
  payments: [
    { id: 'p1', bookingId: 'b5', kind: 'balance', status: 'succeeded', amountCents: 16800, createdAt: at(0, 12, 41), clientName: 'Jenna Rivera' },
    { id: 'p2', bookingId: 'b3', kind: 'deposit', status: 'succeeded', amountCents: 22500, createdAt: at(-1, 15), clientName: 'Ana Martinez' },
    { id: 'p3', bookingId: 'b2', kind: 'deposit', status: 'succeeded', amountCents: 4200, createdAt: at(-1, 9), clientName: 'Dev Patel' },
    { id: 'p4', bookingId: 'b6', kind: 'balance', status: 'succeeded', amountCents: 4900, createdAt: at(-2, 11), clientName: 'Kevin Lee' },
  ] satisfies Payment[],
  clients: [
    { id: 'c1', name: 'Jenna Rivera', phone: '+15125550101', email: null, visits: 6, spentCents: 138000, lastVisit: at(-1, 10), nextBooking: at(0, 9, 30) },
    { id: 'c3', name: 'Ana Martinez', phone: '+15125550103', email: null, visits: 3, spentCents: 165000, lastVisit: at(-3, 14), nextBooking: at(0, 16) },
    { id: 'c2', name: 'Dev Patel', phone: '+15125550102', email: null, visits: 1, spentCents: 14000, lastVisit: at(-20, 9), nextBooking: at(0, 13) },
    { id: 'c4', name: 'Kevin Lee', phone: '+15125550104', email: null, visits: 4, spentCents: 52000, lastVisit: at(-120, 9), nextBooking: null },
  ] satisfies ClientSummary[],
  paymentDetails: { link: null as string | null, note: 'Zelle: (512) 555-0101' as string | null },
  balance: {
    connected: true,
    availableCents: 246000,
    pendingCents: 39300,
    nextPayout: { amountCents: 246000, arrivalDate: at(1, 9) },
    bankLast4: '4821',
  } satisfies Balance,
};
