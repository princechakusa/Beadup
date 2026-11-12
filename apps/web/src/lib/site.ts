import { createClient } from "@supabase/supabase-js";
import { unstable_cache } from "next/cache";
import { z } from "zod";
import type { Country } from "./countries";

export const SUPPORT_EMAIL = process.env.NEXT_PUBLIC_SUPPORT_EMAIL ?? "support@beadup.app";
/** The public sample booking page linked from the website. */
export const SAMPLE_PAGE = "/beadup-demo-detailing";

/** The legal entity named in the policies. Set before launch. */
export const LEGAL_NAME = process.env.NEXT_PUBLIC_LEGAL_NAME ?? "Beadup";

const configSchema = z.object({
  free_bookings_per_month: z.number().int().positive(),
  pro_price_display: z.string().nullable().optional(),
  pro_price_period: z.string().optional(),
  /** Display price per country ("ZA": "R349"), copied from the stores. US uses pro_price_display. */
  pro_price_by_country: z.record(z.string().regex(/^[A-Z]{2}$/), z.string().max(20)).optional().default({}),
  /** Text messages to clients (off until Twilio/10DLC is set up). */
  sms_enabled: z.boolean().optional().default(false),
  /** Who receives vehicle photos for AI quotes (named in the privacy policy). */
  ai_provider: z.enum(["openai", "anthropic"]).optional().default("openai"),
  /** "external": clients pay deposits to detailers directly (launch); "stripe": Beadup Checkout. */
  payments_mode: z.enum(["stripe", "external"]).optional().default("stripe"),
});
export type PublicConfig = z.infer<typeof configSchema>;
const FALLBACK: PublicConfig = {
  free_bookings_per_month: 5,
  pro_price_display: null,
  pro_price_period: "month",
  pro_price_by_country: {},
  sms_enabled: false,
  ai_provider: "openai",
  payments_mode: "external",
};

/**
 * Plan limits and the marketing price, from the plan_config table. Nothing
 * here is hardcoded: when the database is unreachable the price is simply not
 * shown (owner decision: never hardcode the Pro price).
 */
export const getPublicConfig = unstable_cache(loadPublicConfig, ["site-config"], { tags: ["site-config"], revalidate: 3600 });

async function loadPublicConfig(): Promise<PublicConfig> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return FALLBACK;
  const db = createClient(url, key, { auth: { persistSession: false } });
  const { data } = await db.rpc("get_public_config");
  const parsed = configSchema.safeParse(data);
  return parsed.success ? parsed.data : FALLBACK;
}

/** The visitor's country from the host (Cloudflare sets cf-ipcountry), or null when unknown. */
export async function visitorCountry(): Promise<string | null> {
  const { headers } = await import("next/headers");
  const c = (await headers()).get("cf-ipcountry")?.toUpperCase() ?? null;
  return c && /^[A-Z]{2}$/.test(c) && c !== "XX" && c !== "T1" ? c : null;
}

/**
 * The Pro price to show a visitor: their country's store price when the owner
 * has entered it, the US price in the US (or when the country is unknown),
 * otherwise nothing, so nobody outside the US is shown dollars.
 */
export function proPriceFor(config: PublicConfig, country: string | null): string | null {
  if (country && country !== "US") return config.pro_price_by_country[country] ?? null;
  return config.pro_price_display ?? null;
}

const SITE_COUNTRIES: readonly Country[] = ["US", "CA", "GB", "AU", "NZ", "AE", "ZA", "SG"];

/** The visitor's country if Beadup works there, else the US (currency on the marketing pages). */
export function siteCountry(country: string | null): Country {
  return SITE_COUNTRIES.find((c) => c === country) ?? "US";
}
