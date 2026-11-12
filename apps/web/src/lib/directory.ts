import { createClient } from "@supabase/supabase-js";
import { unstable_cache } from "next/cache";
import { z } from "zod";
import { COUNTRY_CODES } from "./countries";
import { TRADE_IDS } from "./trades";

const entry = z.object({
  handle: z.string(),
  businessName: z.string(),
  trade: z.enum(TRADE_IDS).catch("other"),
  serviceArea: z.string(),
  tagline: z.string(),
  country: z.enum(["US", "CA", "GB", "AU", "NZ", "AE", "ZA", "SG"]).catch("US"),
  rating: z.number().nullable(),
  reviewCount: z.number().int(),
  photo: z.string().nullable(),
  fromCents: z.number().int().nullable(),
});
export type DirectoryEntry = z.infer<typeof entry>;

export type DirectoryQuery = { trade?: string; country?: string; q?: string };

/** Cleans query-string input to what the directory accepts. */
export function directoryQuery(raw: Record<string, string | string[] | undefined>): DirectoryQuery {
  const one = (v: unknown) => (typeof v === "string" ? v : undefined);
  const trade = one(raw.trade);
  const country = one(raw.country)?.toUpperCase();
  const q = one(raw.q)?.trim().slice(0, 60);
  return {
    trade: trade && (TRADE_IDS as readonly string[]).includes(trade) ? trade : undefined,
    country: country && (COUNTRY_CODES as string[]).includes(country) ? country : undefined,
    q: q || undefined,
  };
}

async function load(trade: string, country: string, q: string): Promise<DirectoryEntry[]> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return [];
  const db = createClient(url, key, { auth: { persistSession: false } });
  const { data, error } = await db.rpc("get_directory", { p_trade: trade || null, p_country: country || null, p_query: q || null, p_limit: 60 });
  if (error) throw new Error(`get_directory failed: ${error.code ?? "unknown"}`);
  return z.array(entry).catch([]).parse(data);
}

/** Published, listed businesses (cached 5 minutes per search). */
export function getDirectory(query: DirectoryQuery): Promise<DirectoryEntry[]> {
  const t = query.trade ?? "";
  const c = query.country ?? "";
  const q = query.q ?? "";
  return unstable_cache(() => load(t, c, q), ["directory", t, c, q.toLowerCase()], { revalidate: 300, tags: ["directory"] })();
}
