import "server-only";
import { z } from "zod";
import { supabaseAdmin } from "./supabase-admin";

/** 192-bit hex token from bookings.client_token. Checked before any database call. */
export const CLIENT_TOKEN_RE = /^[0-9a-f]{48}$/;

const localStart = z.string().regex(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/);

export const clientBookingSchema = z.object({
  expired: z.literal(false),
  bookingId: z.uuid(),
  ref: z.string(),
  handle: z.string(),
  trade: z.string().default("detailing"),
  visitMode: z.enum(["mobile", "studio"]).catch("mobile").default("mobile"),
  businessName: z.string(),
  contactPhone: z.string().nullable(),
  country: z.enum(["US", "CA", "GB", "AU", "NZ", "AE", "ZA", "SG"]),
  timezone: z.string(),
  firstName: z.string(),
  serviceName: z.string(),
  staffName: z.string().nullable().default(null),
  vehicleSize: z.enum(["sedan", "suv", "truck"]),
  addOns: z.array(z.string()),
  startsAt: z.string(),
  durationMin: z.number().int(),
  status: z.enum(["pending_payment", "confirmed", "completed", "cancelled", "no_show"]),
  subtotalCents: z.number().int(),
  depositCents: z.number().int(),
  payments: z.enum(["stripe", "external"]),
  depositStatus: z.enum(["not_required", "due", "reported", "received"]),
  paymentLink: z.string().regex(/^https:\/\/[^\s<>"]+$/).nullable(),
  paymentNote: z.string().nullable(),
  request: z
    .object({ kind: z.enum(["reschedule", "cancel"]), preferred: z.array(localStart), note: z.string(), createdAt: z.string() })
    .nullable(),
});

const expiredSchema = z.object({ expired: z.literal(true), businessName: z.string(), handle: z.string() });

export type ClientBooking = z.infer<typeof clientBookingSchema>;
export type ClientBookingResult = ClientBooking | z.infer<typeof expiredSchema> | null;

/** The booking behind a client token, or null. Server only: the result includes the booking id. */
export async function loadClientBooking(token: string): Promise<ClientBookingResult> {
  if (!CLIENT_TOKEN_RE.test(token)) return null;
  const db = supabaseAdmin();
  if (!db) return null;
  const { data, error } = await db.rpc("client_booking", { p_token: token });
  if (error || !data) return null;
  const parsed = z.union([clientBookingSchema, expiredSchema]).safeParse(data);
  return parsed.success ? parsed.data : null;
}
