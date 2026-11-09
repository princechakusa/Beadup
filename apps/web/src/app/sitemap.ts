import type { MetadataRoute } from "next";
import { cacheLife } from "next/cache";
import { GUIDES } from "@/content/guides";
import { SITE_URL } from "@/lib/seo";
import { supabaseAdmin } from "@/lib/supabase-admin";

/** Published booking pages (a page only exists with at least one active service). */
async function bookingHandles(): Promise<string[]> {
  "use cache";
  cacheLife("hours");
  const db = supabaseAdmin();
  if (!db) return [];
  const { data, error } = await db
    .from("detailers")
    .select("handle, services!inner(active)")
    .eq("is_published", true)
    .eq("services.active", true)
    .limit(5000);
  if (error || !data) return [];
  return [...new Set(data.map((d) => d.handle as string))];
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const pages: MetadataRoute.Sitemap = [
    { url: `${SITE_URL}/`, changeFrequency: "weekly", priority: 1 },
    { url: `${SITE_URL}/pricing`, changeFrequency: "monthly", priority: 0.8 },
    { url: `${SITE_URL}/blog`, changeFrequency: "weekly", priority: 0.8 },
    ...GUIDES.map((g) => ({ url: `${SITE_URL}/blog/${g.slug}`, lastModified: g.updated, changeFrequency: "monthly" as const, priority: 0.7 })),
    { url: `${SITE_URL}/support`, changeFrequency: "monthly", priority: 0.6 },
    { url: `${SITE_URL}/privacy`, changeFrequency: "yearly", priority: 0.3 },
    { url: `${SITE_URL}/terms`, changeFrequency: "yearly", priority: 0.3 },
    { url: `${SITE_URL}/delete-account`, changeFrequency: "yearly", priority: 0.2 },
  ];
  // Each detailer's booking page is a local business page worth indexing:
  // it helps them get found for "mobile detailing <city>".
  const handles = await bookingHandles();
  return [...pages, ...handles.map((h) => ({ url: `${SITE_URL}/${h}`, changeFrequency: "weekly" as const, priority: 0.5 }))];
}
