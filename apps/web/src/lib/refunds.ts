import "server-only";
import { stripe } from "./stripe";
import { supabaseAdmin } from "./supabase-admin";

const MAX_ATTEMPTS = 10;

/**
 * Retries refunds that failed when a detailer cancelled (logged as
 * `refund.failed` in the audit log). Uses the same Stripe idempotency key as
 * the original attempt, so a refund that actually succeeded before a timeout
 * is returned, never issued twice. Gives up after MAX_ATTEMPTS and leaves the
 * case for manual follow-up (`refund.gave_up`).
 */
export async function retryFailedRefunds(): Promise<{ resolved: number; failed: number }> {
  const out = { resolved: 0, failed: 0 };
  const db = supabaseAdmin();
  const s = stripe();
  if (!db || !s) return out;

  const { data: failures } = await db
    .from("audit_log")
    .select("detailer_id, data")
    .eq("event", "refund.failed")
    .order("created_at", { ascending: true })
    .limit(50);

  for (const f of failures ?? []) {
    const bookingId = (f.data as { booking_id?: string })?.booking_id;
    const amount = (f.data as { amount_cents?: number })?.amount_cents;
    if (!bookingId || !amount) continue;

    const { data: history } = await db
      .from("audit_log")
      .select("event")
      .in("event", ["refund.resolved", "refund.gave_up", "refund.retry_failed"])
      .eq("data->>booking_id", bookingId);
    const events = (history ?? []).map((h) => h.event);
    if (events.includes("refund.resolved") || events.includes("refund.gave_up")) continue;
    const attempts = events.filter((e) => e === "refund.retry_failed").length;
    if (attempts >= MAX_ATTEMPTS) {
      await db.from("audit_log").insert({ detailer_id: f.detailer_id, actor: "system", event: "refund.gave_up", data: { booking_id: bookingId, amount_cents: amount } });
      continue;
    }

    const { data: payment } = await db
      .from("payments")
      .select("stripe_payment_intent_id, stripe_account_id")
      .eq("booking_id", bookingId)
      .eq("kind", "deposit")
      .in("status", ["succeeded", "refunded"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!payment?.stripe_payment_intent_id || !payment.stripe_account_id) continue;

    try {
      await s.refunds.create(
        { payment_intent: payment.stripe_payment_intent_id, amount, metadata: { booking_id: bookingId, by: "detailer", retry: "true" } },
        { stripeAccount: payment.stripe_account_id, idempotencyKey: `cancel-refund-${bookingId}` },
      );
      await db.from("audit_log").insert({ detailer_id: f.detailer_id, actor: "system", event: "refund.resolved", data: { booking_id: bookingId, amount_cents: amount } });
      out.resolved++;
    } catch (e) {
      await db.from("audit_log").insert({
        detailer_id: f.detailer_id,
        actor: "system",
        event: "refund.retry_failed",
        data: { booking_id: bookingId, message: e instanceof Error ? e.message.slice(0, 200) : "unknown" },
      });
      out.failed++;
    }
  }
  return out;
}
