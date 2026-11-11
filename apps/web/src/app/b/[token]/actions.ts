"use server";

import { createHash } from "node:crypto";
import { headers } from "next/headers";
import { after } from "next/server";
import { z } from "zod";
import { clientIp } from "@/lib/client-ip";
import { CLIENT_TOKEN_RE, loadClientBooking } from "@/lib/client-booking";
import { notifyPayment, notifyRequest } from "@/lib/push";
import { supabaseAdmin } from "@/lib/supabase-admin";

const hash = (s: string) => createHash("sha256").update(s).digest("hex").slice(0, 32);
const token = z.string().regex(CLIENT_TOKEN_RE);

export type ActionResult = { ok: true } | { ok: false; error: "invalid" | "rate_limited" | "status" | "unavailable" };

/** Per IP (10 per 10 min) and per booking token (6 per hour), so one link can't be hammered from many IPs. */
async function allowed(db: NonNullable<ReturnType<typeof supabaseAdmin>>, kind: string, t: string): Promise<boolean> {
  const ip = clientIp(await headers());
  const [byIp, byToken] = await Promise.all([
    db.rpc("hit_rate_limit", { p_key: `client-${kind}:ip:${hash(ip)}`, p_limit: 10, p_window_seconds: 600 }),
    db.rpc("hit_rate_limit", { p_key: `client-${kind}:tok:${hash(t)}`, p_limit: 6, p_window_seconds: 3600 }),
  ]);
  return byIp.data === true && byToken.data === true;
}

/** "I've sent the deposit" from the booking page. Never marks it received. */
export async function reportSentByToken(raw: string): Promise<ActionResult> {
  const t = token.safeParse(raw);
  if (!t.success) return { ok: false, error: "invalid" };
  const db = supabaseAdmin();
  if (!db) return { ok: false, error: "unavailable" };
  if (!(await allowed(db, "deposit", t.data))) return { ok: false, error: "rate_limited" };
  const booking = await loadClientBooking(t.data);
  if (!booking || booking.expired) return { ok: false, error: "invalid" };

  const { data, error } = await db.rpc("report_deposit_sent", { p_booking_id: booking.bookingId, p_token: t.data });
  const r = z.object({ ok: z.boolean(), first: z.boolean().optional(), error: z.string().optional() }).safeParse(data);
  if (error || !r.success) return { ok: false, error: "unavailable" };
  if (!r.data.ok) return { ok: false, error: r.data.error === "status" ? "status" : "invalid" };
  if (r.data.first) after(() => notifyPayment(booking.bookingId, "deposit_reported"));
  return { ok: true };
}

const changeInput = z.object({
  token,
  kind: z.enum(["reschedule", "cancel"]),
  preferred: z.array(z.string().regex(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/)).max(3),
  note: z.string().trim().max(300),
});

/** Ask the detailer to move or cancel. The detailer decides in the app; nothing changes until then. */
export async function requestChange(raw: z.input<typeof changeInput>): Promise<ActionResult> {
  const parsed = changeInput.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "invalid" };
  const db = supabaseAdmin();
  if (!db) return { ok: false, error: "unavailable" };
  const i = parsed.data;
  if (!(await allowed(db, "change", i.token))) return { ok: false, error: "rate_limited" };

  const { data, error } = await db.rpc("request_booking_change", {
    p_token: i.token,
    p_kind: i.kind,
    p_preferred: i.preferred,
    p_note: i.note,
  });
  const r = z.object({ ok: z.boolean(), bookingId: z.uuid().optional(), error: z.string().optional() }).safeParse(data);
  if (error || !r.success) return { ok: false, error: "unavailable" };
  if (!r.data.ok) return { ok: false, error: r.data.error === "status" ? "status" : "invalid" };
  const bookingId = r.data.bookingId;
  if (bookingId) after(() => notifyRequest(bookingId, i.kind));
  return { ok: true };
}
