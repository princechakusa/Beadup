import { z } from "zod";

export const VEHICLE_SIZES = ["sedan", "suv", "truck"] as const;
export type VehicleSize = (typeof VEHICLE_SIZES)[number];

const cents = z.number().int().min(0).max(1_000_000);
const hhmm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);

/** Shape returned by the `get_booking_page` database function. */
export const detailerSchema = z.object({
  handle: z.string(),
  businessName: z.string(),
  tagline: z.string(),
  serviceArea: z.string(),
  timezone: z.string(),
  /** Sets the currency prices are shown in and how clients' phone numbers are read. */
  country: z.enum(["US", "CA", "GB", "AU", "NZ", "AE", "ZA", "SG"]).default("US"),
  /** Average of visible reviews, or null when there are none yet. */
  rating: z.number().min(1).max(5).nullable(),
  reviewCount: z.number().int().min(0),
  /** "external": the client pays the deposit to the detailer directly (launch mode). */
  payments: z.enum(["stripe", "external"]).default("stripe"),
  /** The detailer's own payment page (https only, checked in the database too). */
  paymentLink: z
    .string()
    .max(300)
    .regex(/^https:\/\/[^\s<>"]+$/)
    .nullable()
    .default(null),
  /** Plain-text payment instructions, e.g. "Zelle: 512-555-0101". */
  paymentNote: z.string().max(200).nullable().default(null),
  services: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      description: z.string(),
      durationMin: z.number().int().positive(),
      priceCents: z.object({ sedan: cents, suv: cents, truck: cents }),
    }),
  ),
  addOns: z.array(z.object({ id: z.string(), name: z.string(), priceCents: cents })),
  /** Start times already held, "YYYY-MM-DD HH:MM" in the detailer's timezone. */
  taken: z.array(z.string()).default([]),
  /** Live bookings as local start + length, so overlapping start times can be hidden. */
  busy: z
    .array(z.object({ start: z.string().regex(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/), minutes: z.number().int().positive() }))
    .default([]),
  /** Minutes the detailer keeps free between jobs (travel). */
  bufferMin: z.number().int().min(0).max(240).default(0),
  /** Whole dates the detailer isn't working ("YYYY-MM-DD", their zone). */
  daysOff: z.array(z.iso.date()).default([]),
  /** Public phone for questions about a booking (E.164), if the detailer set one. */
  contactPhone: z
    .string()
    .regex(/^\+[1-9]\d{7,14}$/)
    .nullable()
    .default(null),
  /** Start times keyed by weekday ("0" = Sunday), in the detailer's timezone. */
  weeklySlots: z.partialRecord(z.enum(["0", "1", "2", "3", "4", "5", "6"]), z.array(hhmm)),
});

export type Detailer = z.infer<typeof detailerSchema>;
export type Service = Detailer["services"][number];
export type AddOn = Detailer["addOns"][number];
