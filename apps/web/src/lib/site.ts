import { createClient } from "@supabase/supabase-js";
import { cacheLife, cacheTag } from "next/cache";
import { z } from "zod";

export const SUPPORT_EMAIL = process.env.NEXT_PUBLIC_SUPPORT_EMAIL ?? "support@beadup.app";
/** The legal entity named in the policies. Set before launch. */
export const LEGAL_NAME = process.env.NEXT_PUBLIC_LEGAL_NAME ?? "Beadup";

const configSchema = z.object({
  free_bookings_per_month: z.number().int().positive(),
  pro_price_display: z.string().nullable().optional(),
  pro_price_period: z.string().optional(),
  /** Text messages to clients (off until Twilio/10DLC is set up). */
  sms_enabled: z.boolean().optional().default(false),
  /** Who receives vehicle photos for AI quotes (named in the privacy policy). */
  ai_provider: z.enum(["openai", "anthropic"]).optional().default("openai"),
});
export type PublicConfig = z.infer<typeof configSchema>;
const FALLBACK: PublicConfig = { free_bookings_per_month: 5, pro_price_display: null, pro_price_period: "month", sms_enabled: false, ai_provider: "openai" };

/**
 * Plan limits and the marketing price, from the plan_config table. Nothing
 * here is hardcoded: when the database is unreachable the price is simply not
 * shown (owner decision: never hardcode the Pro price).
 */
export async function getPublicConfig(): Promise<PublicConfig> {
  "use cache";
  cacheLife("hours");
  cacheTag("site-config");
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return FALLBACK;
  const db = createClient(url, key, { auth: { persistSession: false } });
  const { data } = await db.rpc("get_public_config");
  const parsed = configSchema.safeParse(data);
  return parsed.success ? parsed.data : FALLBACK;
}
