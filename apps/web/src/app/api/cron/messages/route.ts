import { timingSafeEqual } from "node:crypto";
import { deliverEmails } from "@/lib/email";
import { deliverQueued } from "@/lib/messages";
import { retryFailedRefunds } from "@/lib/refunds";
import { supabaseAdmin } from "@/lib/supabase-admin";

// Every 15 minutes: queues due texts (day-before reminders, review requests),
// delivers or retries queued ones (up to 5 attempts), and retries refunds
// that failed when a detailer cancelled.
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
  const { data: emailsQueued } = db ? await db.rpc("enqueue_due_emails") : { data: null };
  const [delivery, refunds, emails] = await Promise.all([deliverQueued(), retryFailedRefunds(), deliverEmails()]);
  return Response.json({ queued, ...delivery, refunds, emailsQueued, emails });
}
