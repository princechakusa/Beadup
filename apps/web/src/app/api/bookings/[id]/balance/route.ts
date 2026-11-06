import { after } from "next/server";
import { z } from "zod";
import { detailerFromRequest } from "@/lib/auth";
import { deliverQueued } from "@/lib/messages";
import { siteUrl, stripe } from "@/lib/stripe";
import { supabaseAdmin } from "@/lib/supabase-admin";

const balanceContext = z.union([
  z.object({
    ok: z.literal(true),
    bookingId: z.uuid(),
    handle: z.string(),
    businessName: z.string(),
    serviceName: z.string(),
    balanceCents: z.number().int().positive(),
    bookingFeeCents: z.number().int().min(0),
    stripeAccountId: z.string(),
  }),
  z.object({ ok: z.literal(false), error: z.string() }),
]);

const BALANCE_LINK_TTL_SECONDS = 23 * 60 * 60; // Checkout allows up to 24h

// After the job, the detailer requests a payment link for the remaining
// balance. It is texted to the client (if they consented) and returned so the
// app can also share it. Paying it marks the booking completed.
export async function POST(request: Request, ctx: RouteContext<"/api/bookings/[id]/balance">): Promise<Response> {
  const userId = await detailerFromRequest(request);
  if (!userId) return new Response("unauthorized", { status: 401 });
  const { id } = await ctx.params;
  if (!z.uuid().safeParse(id).success) return new Response("not found", { status: 404 });

  const db = supabaseAdmin();
  const s = stripe();
  if (!db || !s) return new Response("payments not configured", { status: 503 });

  const { data: rl } = await db.rpc("hit_rate_limit", { p_key: `balance:${userId}`, p_limit: 30, p_window_seconds: 3600 });
  if (rl !== true) return new Response("rate limited", { status: 429 });

  const { data } = await db.rpc("balance_context", { p_booking_id: id, p_detailer_id: userId });
  const c = balanceContext.parse(data);
  if (!c.ok) return Response.json(c, { status: c.error === "not_found" ? 404 : 409 });

  const site = siteUrl();
  const session = await s.checkout.sessions.create(
    {
      mode: "payment",
      expires_at: Math.floor(Date.now() / 1000) + BALANCE_LINK_TTL_SECONDS,
      client_reference_id: c.bookingId,
      metadata: { booking_id: c.bookingId, kind: "balance" },
      payment_intent_data: {
        metadata: { booking_id: c.bookingId, kind: "balance" },
        description: `${c.serviceName} balance, ${c.businessName}`,
      },
      line_items: [
        { quantity: 1, price_data: { currency: "usd", unit_amount: c.balanceCents, product_data: { name: `Balance: ${c.serviceName}` } } },
        ...(c.bookingFeeCents > 0
          ? [
              {
                quantity: 1,
                price_data: {
                  currency: "usd",
                  unit_amount: c.bookingFeeCents,
                  product_data: { name: "Card fee", description: "Covers card processing" },
                },
              },
            ]
          : []),
      ],
      success_url: `${site}/${c.handle}/booked?b=${c.bookingId}&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${site}/${c.handle}`,
    },
    { stripeAccount: c.stripeAccountId },
  );
  if (!session.url) return new Response("checkout unavailable", { status: 502 });

  await db.rpc("attach_balance_session", {
    p_booking_id: c.bookingId,
    p_session_id: session.id,
    p_account_id: c.stripeAccountId,
    p_amount: c.balanceCents,
    p_fee: c.bookingFeeCents,
  });
  await db.rpc("enqueue_message", { p_booking_id: c.bookingId, p_kind: "balance_link", p_link: session.url });
  after(() => deliverQueued(c.bookingId));

  return Response.json({ url: session.url, balanceCents: c.balanceCents, bookingFeeCents: c.bookingFeeCents });
}
