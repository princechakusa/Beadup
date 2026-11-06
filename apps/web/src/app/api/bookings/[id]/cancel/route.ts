import { z } from "zod";
import { detailerFromRequest } from "@/lib/auth";
import { stripe } from "@/lib/stripe";
import { supabaseAdmin } from "@/lib/supabase-admin";

const cancelResult = z.union([
  z.object({
    ok: z.literal(true),
    refundCents: z.number().int().min(0),
    paymentIntentId: z.string().nullable(),
    stripeAccountId: z.string().nullable(),
  }),
  z.object({ ok: z.literal(false), error: z.string() }),
]);

// A detailer cancels one of their bookings. Policy (see cancel_booking in SQL):
// the client gets everything back, deposit and booking fee.
export async function POST(request: Request, ctx: RouteContext<"/api/bookings/[id]/cancel">): Promise<Response> {
  const userId = await detailerFromRequest(request);
  if (!userId) return new Response("unauthorized", { status: 401 });
  const { id } = await ctx.params;
  if (!z.uuid().safeParse(id).success) return new Response("not found", { status: 404 });

  const db = supabaseAdmin();
  if (!db) return new Response("not configured", { status: 503 });

  const { data, error } = await db.rpc("cancel_booking", { p_booking_id: id, p_by: "detailer", p_detailer_id: userId });
  if (error) return new Response("error", { status: 500 });
  const result = cancelResult.parse(data);
  if (!result.ok) return Response.json(result, { status: result.error === "not_found" ? 404 : 409 });

  if (result.refundCents > 0 && result.paymentIntentId && result.stripeAccountId) {
    const s = stripe();
    if (!s) return new Response("payments not configured", { status: 503 });
    // The charge.refunded webhook marks the payment refunded.
    try {
      await s.refunds.create(
        { payment_intent: result.paymentIntentId, amount: result.refundCents, metadata: { booking_id: id, by: "detailer" } },
        { stripeAccount: result.stripeAccountId, idempotencyKey: `cancel-refund-${id}` },
      );
    } catch (e) {
      // The booking is already cancelled; record the failed refund for follow-up.
      await db.from("audit_log").insert({
        detailer_id: userId,
        actor: "system",
        event: "refund.failed",
        data: { booking_id: id, amount_cents: result.refundCents, message: e instanceof Error ? e.message.slice(0, 200) : "unknown" },
      });
      return Response.json({ ok: false, error: "refund_failed" }, { status: 502 });
    }
  }
  return Response.json({ ok: true, refundCents: result.refundCents });
}
