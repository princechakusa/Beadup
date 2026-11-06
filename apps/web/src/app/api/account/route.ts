import { revalidateTag } from "next/cache";
import { bookingPageTag } from "@/lib/booking-page";
import { detailerFromRequest } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase-admin";

// Account deletion (Apple 5.1.1(v), Google Play User Data; rules.md section 2).
// Deleting the auth user cascades to the detailer's profile, catalog,
// clients, bookings, quotes, payments records and messages. The audit log
// keeps the event with the detailer reference removed. The detailer's own
// Stripe account belongs to them and is not deleted.
//
// Refused while paid bookings are still upcoming, so clients never lose a
// deposit to a disappearing business: cancel (and refund) those first.
export async function DELETE(request: Request): Promise<Response> {
  const userId = await detailerFromRequest(request);
  if (!userId) return new Response("unauthorized", { status: 401 });
  const db = supabaseAdmin();
  if (!db) return new Response("not configured", { status: 503 });

  const { data: rl } = await db.rpc("hit_rate_limit", { p_key: `delete:${userId}`, p_limit: 5, p_window_seconds: 3600 });
  if (rl !== true) return new Response("rate limited", { status: 429 });

  const { count, error: countError } = await db
    .from("bookings")
    .select("id", { count: "exact", head: true })
    .eq("detailer_id", userId)
    .eq("status", "confirmed")
    .gt("starts_at", new Date().toISOString());
  if (countError) return new Response("error", { status: 500 });
  if ((count ?? 0) > 0) return Response.json({ ok: false, error: "upcoming_bookings", count }, { status: 409 });

  const { data: detailer } = await db.from("detailers").select("handle").eq("id", userId).maybeSingle();

  await db.from("audit_log").insert({ detailer_id: userId, actor: userId, event: "account.deleted", data: {} });
  const { error } = await db.auth.admin.deleteUser(userId);
  if (error) {
    console.error("account delete failed", error.message);
    return new Response("error", { status: 500 });
  }
  if (detailer?.handle) revalidateTag(bookingPageTag(detailer.handle), { expire: 0 });
  return Response.json({ ok: true });
}
