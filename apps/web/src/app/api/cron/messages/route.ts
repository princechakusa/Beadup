import { timingSafeEqual } from "node:crypto";
import { deliverQueued } from "@/lib/messages";
import { supabaseAdmin } from "@/lib/supabase-admin";

// Queues due texts (day-before reminders, review requests) and delivers or
// retries queued ones (failed sends are re-queued up to 5 attempts). Run every
// 15 minutes.
// Call on a schedule with "Authorization: Bearer $CRON_SECRET" (Vercel Cron
// sends this header automatically when CRON_SECRET is set).
function authorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  const header = request.headers.get("authorization") ?? "";
  if (!secret || secret.length < 32) return false;
  const expected = Buffer.from(`Bearer ${secret}`);
  const got = Buffer.from(header);
  return got.length === expected.length && timingSafeEqual(got, expected);
}

export async function GET(request: Request): Promise<Response> {
  if (!authorized(request)) return new Response("unauthorized", { status: 401 });
  const db = supabaseAdmin();
  const { data: queued } = db ? await db.rpc("enqueue_due_messages") : { data: null };
  return Response.json({ queued, ...(await deliverQueued()) });
}
