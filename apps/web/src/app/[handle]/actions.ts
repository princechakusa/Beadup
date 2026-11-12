"use server";

import { createHash } from "node:crypto";
import { revalidateTag } from "next/cache";
import { after } from "next/server";
import { headers } from "next/headers";
import { clientIp } from "@/lib/client-ip";
import { z } from "zod";
import { bookingPageTag, getBookingPage, HANDLE_RE } from "@/lib/booking-page";
import { VEHICLE_SIZES } from "@/lib/booking-types";
import { smsConsentText } from "@/lib/consent";
import { bookingFeeCents, depositCents } from "@/lib/pricing";
import { notifyPayment } from "@/lib/push";
import { getPublicConfig } from "@/lib/site";
import { CHECKOUT_TTL_SECONDS, siteUrl, stripe } from "@/lib/stripe";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { toE164 } from "@/lib/countries";
import { verifyTurnstile } from "@/lib/turnstile";

/** Turns US numbers like "(512) 555-0199" into E.164 "+15125550199". */

const bookingInput = z.object({
  handle: z.string().regex(HANDLE_RE),
  serviceId: z.uuid(),
  vehicleSize: z.enum(VEHICLE_SIZES),
  addOnIds: z.array(z.uuid()).max(20),
  date: z.iso.date(),
  time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  name: z.string().trim().min(2).max(80),
  // Normalised to E.164 below, once the detailer's country is known.
  phone: z.string().trim().min(6).max(30),
  // Required (6+ characters) unless the client goes to the business (checked below).
  address: z.string().trim().max(200),
  smsConsent: z.boolean(),
  turnstileToken: z.string().max(2048).optional(),
});

export type BookingInput = z.input<typeof bookingInput>;

export type BookingResult =
  /** checkoutUrl is set when the client must pay on Stripe Checkout next. */
  | {
      ok: true;
      bookingId: string;
      depositCents: number;
      bookingFeeCents: number;
      checkoutUrl?: string;
      /** "external": confirmed now; the client pays the deposit to the detailer directly. */
      payments?: "stripe" | "external";
      /** Lets this browser say "I've sent the deposit" for this booking (never shown or stored elsewhere). */
      clientToken?: string;
    }
  | {
      ok: false;
      error:
        | "invalid"
        | "rate_limited"
        | "bot_check"
        | "slot_taken"
        | "slot_unavailable"
        | "unavailable"
        | "payments_not_ready"
        | "plan_limit"
        /** A service or add-on was removed or changed after the page loaded. */
        | "catalog_changed";
    };

const checkoutContext = z.object({
  bookingId: z.uuid(),
  handle: z.string(),
  businessName: z.string(),
  serviceName: z.string(),
  depositCents: z.number().int().min(0),
  bookingFeeCents: z.number().int().min(0),
  stripeAccountId: z.string().nullable(),
  chargesEnabled: z.boolean(),
});

/**
 * Opens a Stripe Checkout session on the detailer's connected account (direct
 * charge: the detailer is merchant of record and pays processing, which the
 * client's booking fee covers; Beadup takes no cut). Card data stays on Stripe.
 */
async function startCheckout(bookingId: string): Promise<{ url: string } | { error: "payments_not_ready" | "unavailable" }> {
  const db = supabaseAdmin();
  const s = stripe();
  if (!db || !s) return { error: "unavailable" };

  const { data } = await db.rpc("checkout_context", { p_booking_id: bookingId });
  const ctx = checkoutContext.safeParse(data);
  if (!ctx.success) return { error: "unavailable" };
  const c = ctx.data;
  if (!c.stripeAccountId || !c.chargesEnabled) {
    await db.rpc("cancel_booking", { p_booking_id: bookingId, p_by: "client" }); // release the hold
    return { error: "payments_not_ready" };
  }

  const site = siteUrl();
  const session = await s.checkout.sessions.create(
    {
      mode: "payment",
      expires_at: Math.floor(Date.now() / 1000) + CHECKOUT_TTL_SECONDS,
      client_reference_id: c.bookingId,
      metadata: { booking_id: c.bookingId },
      payment_intent_data: {
        metadata: { booking_id: c.bookingId },
        description: `${c.serviceName} deposit, ${c.businessName}`,
      },
      line_items: [
        {
          quantity: 1,
          price_data: { currency: "usd", unit_amount: c.depositCents, product_data: { name: `Deposit: ${c.serviceName}` } },
        },
        ...(c.bookingFeeCents > 0
          ? [
              {
                quantity: 1,
                price_data: {
                  currency: "usd",
                  unit_amount: c.bookingFeeCents,
                  product_data: { name: "Booking fee", description: "Covers card processing" },
                },
              },
            ]
          : []),
      ],
      custom_text: {
        submit: {
          message:
            "Cancel 24 hours or more before your appointment for a refund of the deposit. The booking fee covers card processing and is not refunded.",
        },
      },
      success_url: `${site}/${c.handle}/booked?b=${c.bookingId}&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${site}/${c.handle}`,
    },
    { stripeAccount: c.stripeAccountId, idempotencyKey: `checkout-${c.bookingId}` },
  );
  if (!session.url) return { error: "unavailable" };

  await db.rpc("attach_checkout_session", {
    p_booking_id: c.bookingId,
    p_session_id: session.id,
    p_account_id: c.stripeAccountId,
  });
  return { url: session.url };
}

const hash = (s: string) => createHash("sha256").update(s).digest("hex").slice(0, 32);

export async function createBooking(raw: BookingInput): Promise<BookingResult> {
  const parsed = bookingInput.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "invalid" };
  const input = parsed.data;
  // While texts are off, never record SMS consent (it would be for nothing).
  if (!(await getPublicConfig()).sms_enabled) input.smsConsent = false;

  const h = await headers();
  const ip = clientIp(h);

  if (!(await verifyTurnstile(input.turnstileToken, ip))) return { ok: false, error: "bot_check" };

  const detailer = await getBookingPage(input.handle);
  if (!detailer) return { ok: false, error: "unavailable" };
  if (detailer.visitMode !== "studio" && input.address.length < 6) return { ok: false, error: "invalid" };
  const phone = toE164(input.phone, detailer.country);
  if (!phone) return { ok: false, error: "invalid" };
  input.phone = phone;

  const db = supabaseAdmin();
  if (!db) {
    if (process.env.NODE_ENV === "production") return { ok: false, error: "unavailable" };
    // Local demo mode without a database: price it like the server would.
    const service = detailer.services.find((s) => s.id === input.serviceId);
    if (!service) return { ok: false, error: "invalid" };
    const extras = detailer.addOns.filter((a) => input.addOnIds.includes(a.id)).reduce((n, a) => n + a.priceCents, 0);
    const deposit = depositCents(service.priceCents[input.vehicleSize] + extras);
    const external = detailer.payments === "external";
    return { ok: true, bookingId: "demo", depositCents: deposit, bookingFeeCents: external ? 0 : bookingFeeCents(deposit), payments: detailer.payments };
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
      z.object({
        ok: z.literal(true),
        bookingId: z.uuid(),
        depositCents: z.number(),
        bookingFeeCents: z.number(),
        payments: z.enum(["stripe", "external"]).default("stripe"),
        clientToken: z.string().regex(/^[0-9a-f]{48}$/).optional(),
      }),
      z.object({ ok: z.literal(false), error: z.string() }),
    ])
    .parse(data);

  if (!result.ok) {
    // The page the client saw is out of date: refresh it for their next try.
    revalidateTag(bookingPageTag(input.handle), { expire: 0 });
    if (result.error === "service" || result.error === "add_on") return { ok: false, error: "catalog_changed" };
    if (result.error === "not_found") return { ok: false, error: "unavailable" };
    const known = ["slot_taken", "slot_unavailable", "plan_limit"] as const;
    return { ok: false, error: known.find((k) => k === result.error) ?? "invalid" };
  }

  revalidateTag(bookingPageTag(input.handle), { expire: 0 });
  const booked = { bookingId: result.bookingId, depositCents: result.depositCents, bookingFeeCents: result.bookingFeeCents };

  if (result.payments === "external") {
    // Confirmed by the database; the client pays the detailer directly. No
    // payment webhook will follow, so alert the detailer now.
    after(() => notifyPayment(result.bookingId, "booked"));
    return { ok: true, ...booked, payments: "external", clientToken: result.clientToken };
  }

  if (!stripe()) {
    // No payment processor configured: allowed only outside production.
    if (process.env.NODE_ENV === "production") return { ok: false, error: "unavailable" };
    return { ok: true, ...booked };
  }
  try {
    const checkout = await startCheckout(result.bookingId);
    if ("error" in checkout) return { ok: false, error: checkout.error };
    return { ok: true, ...booked, checkoutUrl: checkout.url };
  } catch (e) {
    console.error("checkout failed", e instanceof Error ? e.message : e);
    await db.rpc("cancel_booking", { p_booking_id: result.bookingId, p_by: "client" });
    return { ok: false, error: "unavailable" };
  }
}

const depositSentInput = z.object({ bookingId: z.uuid(), token: z.string().regex(/^[0-9a-f]{48}$/) });

/**
 * External payments: the client says they've sent the deposit to the detailer.
 * Records "payment submitted" and alerts the detailer, who confirms it in the
 * app. It never marks the deposit as received.
 */
export async function reportDepositSent(raw: z.input<typeof depositSentInput>): Promise<{ ok: boolean }> {
  const parsed = depositSentInput.safeParse(raw);
  if (!parsed.success) return { ok: false };
  const db = supabaseAdmin();
  if (!db) return { ok: process.env.NODE_ENV !== "production" }; // local demo mode
  const ip = clientIp(await headers());
  const { data: allowed } = await db.rpc("hit_rate_limit", { p_key: `deposit-sent:ip:${hash(ip)}`, p_limit: 10, p_window_seconds: 600 });
  if (allowed !== true) return { ok: false };

  const { data, error } = await db.rpc("report_deposit_sent", { p_booking_id: parsed.data.bookingId, p_token: parsed.data.token });
  const result = z.object({ ok: z.boolean(), first: z.boolean().optional() }).safeParse(data);
  if (error || !result.success || !result.data.ok) return { ok: false };
  if (result.data.first) after(() => notifyPayment(parsed.data.bookingId, "deposit_reported"));
  return { ok: true };
}
