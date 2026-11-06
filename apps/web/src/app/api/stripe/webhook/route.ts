import type Stripe from "stripe";
import { stripe } from "@/lib/stripe";
import { supabaseAdmin } from "@/lib/supabase-admin";

// Stripe webhooks. Two endpoints can point here: the platform endpoint and the
// Connect endpoint (events from detailers' accounts), each with its own secret.
// Every event is signature-verified, then applied idempotently in Postgres.

const HANDLED = new Set([
  "account.updated",
  "checkout.session.completed",
  "checkout.session.async_payment_succeeded",
  "checkout.session.async_payment_failed",
  "checkout.session.expired",
  "charge.refunded",
]);

function verify(body: string, signature: string): Stripe.Event | null {
  const s = stripe();
  if (!s) return null;
  const secrets = [process.env.STRIPE_WEBHOOK_SECRET, process.env.STRIPE_CONNECT_WEBHOOK_SECRET].filter(
    (x): x is string => !!x,
  );
  for (const secret of secrets) {
    try {
      return s.webhooks.constructEvent(body, signature, secret);
    } catch {
      // try the next secret
    }
  }
  return null;
}

export async function POST(request: Request): Promise<Response> {
  const signature = request.headers.get("stripe-signature");
  if (!signature) return new Response("missing signature", { status: 400 });

  const body = await request.text();
  if (body.length > 1_000_000) return new Response("too large", { status: 413 });
  const event = verify(body, signature);
  if (!event) return new Response("invalid signature", { status: 400 });
  if (!HANDLED.has(event.type)) return Response.json({ received: true, outcome: "ignored" });

  const db = supabaseAdmin();
  const s = stripe();
  if (!db || !s) return new Response("not configured", { status: 503 });

  const { data: outcome, error } = await db.rpc("apply_stripe_event", {
    p_event_id: event.id,
    p_type: event.type,
    p_account_id: event.account ?? null,
    p_object: event.data.object,
  });
  if (error) {
    console.error("apply_stripe_event failed", event.id, error.code);
    return new Response("retry", { status: 500 }); // Stripe retries with backoff
  }

  if (outcome === "refund_needed") {
    // Paid after the hold expired and someone else took the slot: refund in full.
    const session = event.data.object as Stripe.Checkout.Session;
    try {
      if (typeof session.payment_intent === "string" && event.account) {
        await s.refunds.create(
          { payment_intent: session.payment_intent, reason: "requested_by_customer", metadata: { reason: "slot_lost" } },
          { stripeAccount: event.account, idempotencyKey: `slot-lost-${event.id}` },
        );
      }
    } catch (e) {
      console.error("slot-lost refund failed", event.id, e instanceof Error ? e.message : e);
      await db.rpc("forget_stripe_event", { p_event_id: event.id }); // let Stripe's retry try again
      return new Response("retry", { status: 500 });
    }
  }

  return Response.json({ received: true, outcome });
}
