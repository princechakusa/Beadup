"use server";

import { createHash } from "node:crypto";
import { headers } from "next/headers";
import { z } from "zod";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { verifyTurnstile } from "@/lib/turnstile";

const input = z.object({
  email: z.email().max(254),
  note: z.string().max(500),
  turnstileToken: z.string().max(2048).optional(),
});

export type DeletionRequestResult = { ok: true } | { ok: false; error: "invalid" | "bot_check" | "rate_limited" | "unavailable" };

/**
 * Web account deletion request (Google Play requires a web path). Recorded for
 * support to verify and process; the in-app path deletes immediately.
 * Always answers the same way for known and unknown emails.
 */
export async function requestDeletion(raw: z.input<typeof input>): Promise<DeletionRequestResult> {
  const parsed = input.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "invalid" };
  const db = supabaseAdmin();
  if (!db) return { ok: false, error: "unavailable" };

  const h = await headers();
  const ip = h.get("x-real-ip") ?? h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (!(await verifyTurnstile(parsed.data.turnstileToken, ip))) return { ok: false, error: "bot_check" };

  const key = `deletion:${createHash("sha256").update(ip).digest("hex").slice(0, 32)}`;
  const { data: allowed } = await db.rpc("hit_rate_limit", { p_key: key, p_limit: 3, p_window_seconds: 3600 });
  if (allowed !== true) return { ok: false, error: "rate_limited" };

  const { error } = await db
    .from("deletion_requests")
    .insert({ email: parsed.data.email.toLowerCase(), note: parsed.data.note.trim() });
  if (error) return { ok: false, error: "unavailable" };
  return { ok: true };
}
