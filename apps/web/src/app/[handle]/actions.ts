"use server";

import { createHash } from "node:crypto";
import { updateTag } from "next/cache";
import { headers } from "next/headers";
import { z } from "zod";
import { bookingPageTag, getBookingPage, HANDLE_RE } from "@/lib/booking-page";
import { VEHICLE_SIZES } from "@/lib/booking-types";
import { smsConsentText } from "@/lib/consent";
import { bookingFeeCents, depositCents } from "@/lib/pricing";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { verifyTurnstile } from "@/lib/turnstile";

/** Turns US numbers like "(512) 555-0199" into E.164 "+15125550199". */
function toE164(raw: string): string | null {
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return null;
}

const bookingInput = z.object({
  handle: z.string().regex(HANDLE_RE),
  serviceId: z.uuid(),
  vehicleSize: z.enum(VEHICLE_SIZES),
  addOnIds: z.array(z.uuid()).max(20),
  date: z.iso.date(),
  time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  name: z.string().trim().min(2).max(80),
  phone: z.string().trim().max(30).transform(toE164).pipe(z.string()),
  address: z.string().trim().min(6).max(200),
  smsConsent: z.boolean(),
  turnstileToken: z.string().max(2048).optional(),
});

export type BookingInput = z.input<typeof bookingInput>;

export type BookingResult =
  | { ok: true; bookingId: string; depositCents: number; bookingFeeCents: number }
  | { ok: false; error: "invalid" | "rate_limited" | "bot_check" | "slot_taken" | "slot_unavailable" | "unavailable" };

const hash = (s: string) => createHash("sha256").update(s).digest("hex").slice(0, 32);

export async function createBooking(raw: BookingInput): Promise<BookingResult> {
  const parsed = bookingInput.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "invalid" };
  const input = parsed.data;

  const h = await headers();
  const ip = h.get("x-real-ip") ?? h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";

  if (!(await verifyTurnstile(input.turnstileToken, ip))) return { ok: false, error: "bot_check" };

  const detailer = await getBookingPage(input.handle);
  if (!detailer) return { ok: false, error: "unavailable" };

  const db = supabaseAdmin();
  if (!db) {
    if (process.env.NODE_ENV === "production") return { ok: false, error: "unavailable" };
    // Local demo mode without a database: price it like the server would.
    const service = detailer.services.find((s) => s.id === input.serviceId);
    if (!service) return { ok: false, error: "invalid" };
    const extras = detailer.addOns.filter((a) => input.addOnIds.includes(a.id)).reduce((n, a) => n + a.priceCents, 0);
    const deposit = depositCents(service.priceCents[input.vehicleSize] + extras);
    return { ok: true, bookingId: "demo", depositCents: deposit, bookingFeeCents: bookingFeeCents(deposit) };
  }

  // 5 attempts per 10 minutes per IP, and 3 per hour per phone number.
  const [byIp, byPhone] = await Promise.all([
    db.rpc("hit_rate_limit", { p_key: `book:ip:${hash(ip)}`, p_limit: 5, p_window_seconds: 600 }),
    db.rpc("hit_rate_limit", { p_key: `book:phone:${hash(input.phone)}`, p_limit: 3, p_window_seconds: 3600 }),
  ]);
  if (byIp.error || byPhone.error) return { ok: false, error: "unavailable" };
  if (byIp.data !== true || byPhone.data !== true) return { ok: false, error: "rate_limited" };

  const { data, error } = await db.rpc("create_booking", {
    p_handle: input.handle,
    p_service_id: input.serviceId,
    p_vehicle_size: input.vehicleSize,
    p_add_on_ids: input.addOnIds,
    p_date: input.date,
    p_time: input.time,
    p_name: input.name,
    p_phone: input.phone,
    p_address: input.address,
    p_sms_consent: input.smsConsent,
    p_consent_text: input.smsConsent ? smsConsentText(detailer.businessName) : null,
  });
  if (error) {
    console.error("create_booking failed", error.code);
    return { ok: false, error: "unavailable" };
  }

  const result = z
    .union([
      z.object({ ok: z.literal(true), bookingId: z.uuid(), depositCents: z.number(), bookingFeeCents: z.number() }),
      z.object({ ok: z.literal(false), error: z.string() }),
    ])
    .parse(data);

  if (!result.ok) {
    const known = ["slot_taken", "slot_unavailable"] as const;
    const code = known.find((k) => k === result.error);
    if (code) updateTag(bookingPageTag(input.handle)); // refresh taken times
    return { ok: false, error: code ?? "invalid" };
  }

  updateTag(bookingPageTag(input.handle));
  return { ok: true, bookingId: result.bookingId, depositCents: result.depositCents, bookingFeeCents: result.bookingFeeCents };
}
