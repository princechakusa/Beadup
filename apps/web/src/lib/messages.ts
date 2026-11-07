import "server-only";
import { z } from "zod";
import { bookingFeeCents, formatUsd } from "./pricing";
import { sendSms } from "./sms";
import { siteUrl } from "./stripe";
import { supabaseAdmin } from "./supabase-admin";

// Outbox worker for customer texts. Rows are queued by the database in the
// same transaction as the payment, then delivered here (right after the
// webhook responds, and by the cron retry route).

const contextSchema = z.object({
  id: z.uuid(),
  kind: z.enum(["booking_confirmed", "balance_link", "balance_receipt", "reminder", "review_request"]),
  status: z.string(),
  linkUrl: z.string().nullable(),
  phone: z.string(),
  clientName: z.string(),
  canText: z.boolean(),
  businessName: z.string(),
  timezone: z.string(),
  serviceName: z.string(),
  startsAt: z.string(),
  address: z.string(),
  subtotalCents: z.number(),
  depositCents: z.number(),
  paidCents: z.number(),
  reviewToken: z.string(),
});
type MessageContext = z.infer<typeof contextSchema>;

const STOP = "Reply STOP to opt out.";

function when(iso: string, timeZone: string) {
  const d = new Date(iso);
  const day = d.toLocaleDateString("en-US", { timeZone, weekday: "short", month: "short", day: "numeric" });
  const time = d.toLocaleTimeString("en-US", { timeZone, hour: "numeric", minute: "2-digit" });
  return `${day} at ${time}`;
}

/** Plain, short, no emoji. Every message names the business and carries STOP. */
export function renderMessage(m: MessageContext): string {
  const biz = m.businessName.replace(/\.+$/, "");
  switch (m.kind) {
    case "booking_confirmed":
      return `${biz}: you're booked for ${m.serviceName} on ${when(m.startsAt, m.timezone)} at ${m.address}. Deposit paid: ${formatUsd(m.paidCents)}. ${STOP}`;
    case "balance_link": {
      const balance = m.subtotalCents - m.depositCents;
      const due = balance + bookingFeeCents(balance);
      return `${biz}: thanks for choosing us. Your balance is ${formatUsd(due)} incl. card fee. Pay here: ${m.linkUrl} ${STOP}`;
    }
    case "balance_receipt":
      return `${biz}: payment received, ${formatUsd(m.paidCents)} in total. Thank you! ${STOP}`;
    case "reminder":
      return `${biz}: reminder, ${m.serviceName} tomorrow, ${when(m.startsAt, m.timezone).split(" at ")[1]}, at ${m.address}. Reply here if you need to change it. ${STOP}`;
    case "review_request":
      return `${biz}: thanks for choosing us. How did we do? It takes 10 seconds: ${siteUrl()}/r/${m.reviewToken} ${STOP}`;
  }
}

/** Delivers queued texts, for one booking or (cron) for everyone. Never throws. */
export async function deliverQueued(bookingId?: string): Promise<{ sent: number; skipped: number; failed: number }> {
  const out = { sent: 0, skipped: 0, failed: 0 };
  const db = supabaseAdmin();
  if (!db) return out;

  const { data: ids } = await db.rpc("queued_messages", { p_booking_id: bookingId ?? null, p_limit: 50 });
  for (const id of (ids ?? []) as string[]) {
    try {
      const { data } = await db.rpc("message_context", { p_message_id: id });
      const parsed = contextSchema.safeParse(data);
      if (!parsed.success || parsed.data.status !== "queued") continue;
      const m = parsed.data;
      const body = renderMessage(m);

      if (!m.canText) {
        // No consent, or the client opted out: record it, never send.
        await db.rpc("mark_message", { p_message_id: id, p_status: "skipped", p_body: body, p_error: "no_consent" });
        out.skipped++;
        continue;
      }
      const res = await sendSms(m.phone, body);
      if (res.ok) {
        await db.rpc("mark_message", { p_message_id: id, p_status: "sent", p_body: body, p_provider_id: res.id });
        out.sent++;
      } else {
        await db.rpc("mark_message", {
          p_message_id: id,
          p_status: res.retry ? "failed" : "skipped",
          p_body: body,
          p_error: res.error,
        });
        out[res.retry ? "failed" : "skipped"]++;
      }
    } catch (e) {
      console.error("message delivery failed", id, e instanceof Error ? e.message : e);
      out.failed++;
    }
  }
  return out;
}
