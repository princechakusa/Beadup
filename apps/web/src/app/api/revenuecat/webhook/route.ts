import { timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { supabaseAdmin } from "@/lib/supabase-admin";

// RevenueCat webhook (Pro subscriptions bought in the App Store / Google Play).
// Authenticated by the Authorization header value configured in RevenueCat.
// For every event we read the subscriber's current entitlement from the
// RevenueCat API, so renewals, cancellations, expirations, pauses and
// transfers all resolve to the store's truth. The app user id is the
// detailer's Supabase user id.

const ENTITLEMENT = "pro";

const eventSchema = z.object({
  event: z.object({
    id: z.string().min(1).max(200),
    type: z.string().max(60),
    app_user_id: z.string().max(200).optional(),
    original_app_user_id: z.string().max(200).optional(),
    transferred_from: z.array(z.string().max(200)).optional(),
    transferred_to: z.array(z.string().max(200)).optional(),
    event_timestamp_ms: z.number().optional(),
  }),
});

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function authorized(request: Request): boolean {
  const expected = process.env.REVENUECAT_WEBHOOK_AUTH;
  const got = request.headers.get("authorization") ?? "";
  if (!expected || expected.length < 24) return false;
  const a = Buffer.from(got);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Current Pro entitlement expiry for an app user, from RevenueCat. */
async function proExpiry(appUserId: string, secret: string): Promise<{ active: boolean; expiresAt: string | null }> {
  const res = await fetch(`https://api.revenuecat.com/v1/subscribers/${encodeURIComponent(appUserId)}`, {
    headers: { Authorization: `Bearer ${secret}`, Accept: "application/json" },
    signal: AbortSignal.timeout(8_000),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`revenuecat ${res.status}`);
  const data = (await res.json()) as {
    subscriber?: { entitlements?: Record<string, { expires_date: string | null }> };
  };
  const ent = data.subscriber?.entitlements?.[ENTITLEMENT];
  if (!ent) return { active: false, expiresAt: null };
  // A null expiry means a lifetime grant.
  const active = ent.expires_date === null || Date.parse(ent.expires_date) > Date.now();
  return { active, expiresAt: ent.expires_date };
}

export async function POST(request: Request): Promise<Response> {
  if (!authorized(request)) return new Response("unauthorized", { status: 401 });
  const secret = process.env.REVENUECAT_SECRET_KEY;
  const db = supabaseAdmin();
  if (!secret || !db) return new Response("not configured", { status: 503 });

  const parsed = eventSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return new Response("bad request", { status: 400 });
  const e = parsed.data.event;
  if (e.type === "TEST") return Response.json({ ok: true, outcome: "test" });

  const users = [...new Set([e.app_user_id, e.original_app_user_id, ...(e.transferred_from ?? []), ...(e.transferred_to ?? [])])].filter(
    (u): u is string => !!u && UUID.test(u),
  );
  const eventAt = new Date(e.event_timestamp_ms ?? Date.now()).toISOString();

  try {
    for (const [i, user] of users.entries()) {
      const { active, expiresAt } = await proExpiry(user, secret);
      const { error } = await db.rpc("apply_subscription_event", {
        p_event_id: users.length > 1 ? `${e.id}:${i}` : e.id,
        p_detailer_id: user,
        p_active: active,
        p_expires_at: expiresAt,
        p_event_at: eventAt,
        p_type: e.type,
      });
      if (error) throw new Error(error.code ?? "db");
    }
  } catch (err) {
    console.error("revenuecat webhook failed", e.id, err instanceof Error ? err.message : err);
    return new Response("retry", { status: 500 }); // RevenueCat retries
  }
  return Response.json({ ok: true, users: users.length });
}
