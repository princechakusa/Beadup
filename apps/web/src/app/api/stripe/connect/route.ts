import { detailerFromRequest } from "@/lib/auth";
import { siteUrl, stripe } from "@/lib/stripe";
import { supabaseAdmin } from "@/lib/supabase-admin";

// Starts or resumes Stripe Connect onboarding for the signed-in detailer and
// returns a one-time onboarding URL to open in the browser.
//
// Accounts are Express-dashboard accounts where Stripe handles pricing and
// owns losses (controller.fees.payer = "account", losses.payments = "stripe"),
// so Beadup pays no Connect fees and carries no negative-balance risk.
export async function POST(request: Request): Promise<Response> {
  const userId = await detailerFromRequest(request);
  if (!userId) return new Response("unauthorized", { status: 401 });

  const db = supabaseAdmin();
  const s = stripe();
  if (!db || !s) return new Response("payments not configured", { status: 503 });

  const { data: rl } = await db.rpc("hit_rate_limit", { p_key: `connect:${userId}`, p_limit: 10, p_window_seconds: 3600 });
  if (rl !== true) return new Response("rate limited", { status: 429 });

  const { data: account } = await db
    .from("detailer_accounts")
    .select("stripe_account_id")
    .eq("detailer_id", userId)
    .maybeSingle();
  const { data: detailer } = await db.from("detailers").select("business_name").eq("id", userId).maybeSingle();
  if (!detailer) return new Response("create your profile first", { status: 409 });

  let accountId = account?.stripe_account_id as string | null | undefined;
  if (!accountId) {
    const created = await s.accounts.create(
      {
        country: "US",
        controller: {
          fees: { payer: "account" },
          losses: { payments: "stripe" },
          stripe_dashboard: { type: "express" },
        },
        capabilities: { card_payments: { requested: true }, transfers: { requested: true } },
        business_profile: { name: detailer.business_name, mcc: "7542" }, // car washes
        metadata: { detailer_id: userId },
      },
      { idempotencyKey: `connect-account-${userId}` },
    );
    accountId = created.id;
    await db.rpc("set_stripe_account", { p_detailer_id: userId, p_account_id: accountId });
  }

  const link = await s.accountLinks.create({
    account: accountId,
    type: "account_onboarding",
    refresh_url: `${siteUrl()}/stripe/return?refresh=1`,
    return_url: `${siteUrl()}/stripe/return`,
  });
  return Response.json({ url: link.url });
}
