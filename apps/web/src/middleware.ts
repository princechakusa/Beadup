// Edge runtime on purpose: Cloudflare Workers runs edge middleware natively;
// the Node.js `proxy.ts` convention hangs there (OpenNext, Nov 2026). Next 16
// keeps `middleware.ts` for the edge runtime (deprecated name, same behavior).
import { NextResponse, type NextRequest } from "next/server";
import { documentCsp, newNonce } from "@/lib/csp";
import { getDemoDetailer } from "@/lib/demo";
import { SITE_PAGES } from "@/lib/site-pages";

// 1. Every HTML page gets a per-request CSP nonce (no 'unsafe-inline').
//    Next.js reads it from the request's CSP header and applies it to the
//    scripts it renders; the same policy goes on the response.
// 2. Booking pages stream, so a notFound() during render can only send HTTP
//    200. Checking the handle here, before rendering, gives unknown handles a
//    real 404.

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

/** Only one-segment paths can be booking handles ("/marcus"). */
async function isUnknownHandle(pathname: string): Promise<boolean> {
  const segment = pathname.slice(1);
  if (!segment || segment.includes("/")) return false;
  const handle = segment.toLowerCase();
  if (SITE_PAGES.has(handle)) return false;
  try {
    return !(HANDLE_RE.test(handle) && (await pageExists(handle)));
  } catch {
    return false; // timeout or network error: fall through to the page
  }
}

export async function middleware(request: NextRequest) {
  const nonce = newNonce();
  const csp = documentCsp(nonce);
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("content-security-policy", csp);

  const response = (await isUnknownHandle(request.nextUrl.pathname))
    ? NextResponse.rewrite(new URL("/_not-found", request.url), { status: 404, request: { headers: requestHeaders } })
    : NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("Content-Security-Policy", csp);
  return response;
}

export const config = {
  // Every page. Skips Next's static files, the image optimizer, API routes
  // and anything with a file extension (favicon, images, robots.txt).
  matcher: ["/((?!_next/static|_next/image|api/|.*\\.[a-zA-Z0-9]+$).*)"],
};
