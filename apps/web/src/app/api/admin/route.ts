import { revalidateTag } from "next/cache";
import { z } from "zod";
import { bookingPageTag } from "@/lib/booking-page";
import { currentAdmin, loadOverview, sameOrigin } from "@/lib/admin";
import { supabaseAdmin } from "@/lib/supabase-admin";

const noStore = { "Cache-Control": "no-store" };

/** Dashboard data for the signed-in admin. */
export async function GET(): Promise<Response> {
  const admin = await currentAdmin();
  if (!admin) return Response.json({ ok: false }, { status: 401, headers: noStore });
  return Response.json({ ok: true, overview: await loadOverview(admin) }, { headers: noStore });
}

const action = z.discriminatedUnion("type", [
  // Moderation of reported reviews (detailers can never hide their own: Apple 1.2).
  z.object({ type: z.literal("review.hide"), id: z.uuid(), hidden: z.boolean() }),
  // Free Pro months: launch offers ("first 20 get 3 months") and support goodwill.
  z.object({ type: z.literal("pro.grant"), detailerId: z.uuid(), months: z.number().int().min(1).max(12) }),
  z.object({ type: z.literal("deletion.close"), id: z.number().int().positive(), status: z.enum(["done", "no_account"]) }),
]);

export async function POST(request: Request): Promise<Response> {
  if (!(await sameOrigin())) return new Response("forbidden", { status: 403 });
  const admin = await currentAdmin();
  if (!admin) return Response.json({ ok: false }, { status: 401, headers: noStore });
  const parsed = action.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ ok: false, error: "invalid" }, { status: 400 });
  const db = supabaseAdmin();
  if (!db) return Response.json({ ok: false }, { status: 503 });
  const a = parsed.data;

  if (a.type === "review.hide") {
    const { data, error } = await db.from("reviews").update({ hidden: a.hidden }).eq("id", a.id).select("detailer:detailers(handle)").maybeSingle();
    if (error || !data) return Response.json({ ok: false }, { status: 404 });
    const d = (Array.isArray(data.detailer) ? data.detailer[0] : data.detailer) as { handle?: string } | null;
    if (d?.handle) revalidateTag(bookingPageTag(d.handle), { expire: 0 }); // the rating on their page changes
  } else if (a.type === "pro.grant") {
    for (let i = 0; i < a.months; i++) {
      const { error } = await db.rpc("grant_bonus_month", { p_detailer_id: a.detailerId, p_reason: `admin:${admin}` });
      if (error) return Response.json({ ok: false }, { status: 400 });
    }
  } else {
    const { error } = await db.from("deletion_requests").update({ status: a.status, processed_at: new Date().toISOString() }).eq("id", a.id);
    if (error) return Response.json({ ok: false }, { status: 400 });
  }

  await db.from("audit_log").insert({ actor: admin, event: `admin.${a.type}`, data: a });
  return Response.json({ ok: true, overview: await loadOverview(admin) }, { headers: noStore });
}
