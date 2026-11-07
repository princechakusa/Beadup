import { NextResponse, type NextRequest } from "next/server";
import { getDemoDetailer } from "@/lib/demo";
import { SITE_PAGES } from "@/lib/site-pages";

// Booking pages stream, so a notFound() during render can only send HTTP 200.
// Checking the handle here, before rendering, gives unknown handles a real 404.

const HANDLE_RE = /^[a-z0-9][a-z0-9-]{1,39}$/i;
const TTL_MS = 60_000;
const MAX_ENTRIES = 5_000;
// Best-effort per-instance cache. Correctness never depends on it.
const seen = new Map<string, { exists: boolean; at: number }>();

async function pageExists(handle: string): Promise<boolean> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return getDemoDetailer(handle) !== null;

  const hit = seen.get(handle);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.exists;

  const res = await fetch(`${url}/rest/v1/rpc/booking_page_exists`, {
    method: "POST",
    headers: { apikey: key, "Content-Type": "application/json" },
    body: JSON.stringify({ p_handle: handle }),
    signal: AbortSignal.timeout(3_000),
  });
  // On a database error let the page render and handle it; never 404 a real detailer.
  if (!res.ok) return true;
  const exists = (await res.json()) === true;
  if (seen.size >= MAX_ENTRIES) seen.clear();
  seen.set(handle, { exists, at: Date.now() });
  return exists;
}

export async function proxy(request: NextRequest) {
  const handle = request.nextUrl.pathname.slice(1).toLowerCase();
  if (SITE_PAGES.has(handle)) return NextResponse.next();
  let exists: boolean;
  try {
    exists = HANDLE_RE.test(handle) && (await pageExists(handle));
  } catch {
    exists = true; // timeout or network error: fall through to the page
  }
  if (exists) return NextResponse.next();
  return NextResponse.rewrite(new URL("/_not-found", request.url), { status: 404 });
}

export const config = {
  // Single path segments only (the booking pages), skipping Next internals and files.
  matcher: ["/((?!_next|api)[^/.]+)"],
};
