import { createClient } from "@supabase/supabase-js";
import { unstable_cache } from "next/cache";
import { detailerSchema, type Detailer } from "./booking-types";
import { getDemoDetailer } from "./demo";

export const HANDLE_RE = /^[a-z0-9][a-z0-9-]{1,39}$/i;

/** Cache tag to revalidate when a detailer edits their catalog or profile. */
export const bookingPageTag = (handle: string) => `booking-page:${handle.toLowerCase()}`;

/**
 * Public data for a detailer's booking page, or null if the handle is unknown
 * or unpublished. Uses the anon key only: the database function returns
 * public fields and nothing else.
 */
export function getBookingPage(handle: string): Promise<Detailer | null> {
  // Cached per handle for a minute; edits revalidate the tag at once.
  return unstable_cache(() => loadBookingPage(handle), ["booking-page", handle.toLowerCase()], {
    tags: [bookingPageTag(handle)],
    revalidate: 60,
  })();
}

async function loadBookingPage(handle: string): Promise<Detailer | null> {
  if (!HANDLE_RE.test(handle)) return null;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    if (process.env.NODE_ENV === "production") throw new Error("Supabase env vars are not set");
    return getDemoDetailer(handle);
  }

  const supabase = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const { data, error } = await supabase.rpc("get_booking_page", { p_handle: handle.toLowerCase() });
  // Throw rather than return null, so an outage is never cached as "not found".
  if (error) throw new Error(`get_booking_page failed: ${error.code ?? "unknown"}`);
  if (data == null) return null;
  return detailerSchema.parse(data);
}
