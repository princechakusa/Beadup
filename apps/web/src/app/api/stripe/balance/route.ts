import { detailerFromRequest } from "@/lib/auth";
import { stripe } from "@/lib/stripe";
import { supabaseAdmin } from "@/lib/supabase-admin";

// The signed-in detailer's Stripe balance and next payout, for the app's
// Money screen. Read-only; the account id never leaves the server.
export async function GET(request: Request): Promise<Response> {
  const userId = await detailerFromRequest(request);
  if (!userId) return new Response("unauthorized", { status: 401 });

  const db = supabaseAdmin();
  if (!db) return new Response("not configured", { status: 503 });
  const { data: account } = await db
    .from("detailer_accounts")
    .select("stripe_account_id, charges_enabled")
    .eq("detailer_id", userId)
    .maybeSingle();

  const empty = { connected: false, availableCents: 0, pendingCents: 0, nextPayout: null, bankLast4: null };
  const s = stripe();
  const accountId = account?.stripe_account_id as string | null | undefined;
  if (!s || !accountId) return Response.json(empty);

  const opts = { stripeAccount: accountId };
  const [balance, payouts, banks] = await Promise.all([
    s.balance.retrieve({}, opts),
    s.payouts.list({ limit: 1, status: "pending" }, opts),
    s.accounts.listExternalAccounts(accountId, { object: "bank_account", limit: 1 }),
  ]);
  const usd = (list: { amount: number; currency: string }[]) =>
    list.filter((b) => b.currency === "usd").reduce((n, b) => n + b.amount, 0);
  const next = payouts.data[0];
  const bank = banks.data[0];

  return Response.json({
    connected: Boolean(account?.charges_enabled),
    availableCents: usd(balance.available),
    pendingCents: usd(balance.pending),
    nextPayout: next ? { amountCents: next.amount, arrivalDate: new Date(next.arrival_date * 1000).toISOString() } : null,
    bankLast4: bank && "last4" in bank ? bank.last4 : null,
  });
}
