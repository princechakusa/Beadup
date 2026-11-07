"use server";

import { updateTag } from "next/cache";
import { headers } from "next/headers";
import { clientIp } from "@/lib/client-ip";
import { createHash } from "node:crypto";
import { z } from "zod";
import { bookingPageTag } from "@/lib/booking-page";
import { supabaseAdmin } from "@/lib/supabase-admin";

const input = z.object({
  token: z.string().regex(/^[0-9a-f]{48}$/),
  rating: z.number().int().min(1).max(5),
  body: z.string().max(1000),
});

export type ReviewResult = { ok: true } | { ok: false; error: "invalid" | "already_reviewed" | "unavailable" | "rate_limited" };

export async function submitReview(raw: z.input<typeof input>): Promise<ReviewResult> {
  const parsed = input.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "invalid" };
  const db = supabaseAdmin();
  if (!db) return { ok: false, error: "unavailable" };

  const h = await headers();
  const ip = clientIp(h);
  const key = `review:${createHash("sha256").update(ip).digest("hex").slice(0, 32)}`;
  const { data: allowed } = await db.rpc("hit_rate_limit", { p_key: key, p_limit: 10, p_window_seconds: 3600 });
  if (allowed !== true) return { ok: false, error: "rate_limited" };

  const { data, error } = await db.rpc("submit_review", {
    p_token: parsed.data.token,
    p_rating: parsed.data.rating,
    p_body: parsed.data.body,
  });
  if (error) return { ok: false, error: "unavailable" };
  const res = data as { ok: boolean; error?: string; handle?: string };
  if (!res.ok) return { ok: false, error: res.error === "already_reviewed" ? "already_reviewed" : "invalid" };
  if (res.handle) updateTag(bookingPageTag(res.handle)); // the rating on the booking page
  return { ok: true };
}
