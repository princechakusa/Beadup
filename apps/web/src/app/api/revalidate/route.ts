import { revalidateTag } from "next/cache";
import { bookingPageTag } from "@/lib/booking-page";
import { detailerFromRequest } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase-admin";

// The app calls this after a detailer edits services, prices, add-ons or
// availability, so their public booking page shows the change right away.
// Only ever refreshes the caller's own page.
export async function POST(request: Request): Promise<Response> {
  const userId = await detailerFromRequest(request);
  if (!userId) return new Response("unauthorized", { status: 401 });
  const db = supabaseAdmin();
  if (!db) return new Response("not configured", { status: 503 });

  const { data } = await db.from("detailers").select("handle").eq("id", userId).maybeSingle();
  if (!data?.handle) return new Response("not found", { status: 404 });
  revalidateTag(bookingPageTag(data.handle), { expire: 0 });
  return Response.json({ ok: true });
}
