import "server-only";

/**
 * Verifies a Cloudflare Turnstile token (bot protection on the public booking
 * page, rules.md section 7). Cloudflare publishes test keys for local use: see
 * .env.example.
 *
 * - Both keys set: the token must verify (fails closed on any error).
 * - Neither key set (Turnstile not set up yet): skipped; the Postgres rate
 *   limits on every booking (per IP and per phone) still apply. Owner decision
 *   2026-11-09, after failing closed here blocked every live booking. Adding
 *   both keys on Netlify turns the check back on with no code change.
 * - Only the site key set (half-configured): fails closed in production, so a
 *   missing secret is noticed instead of silently disabling the check.
 */
export async function verifyTurnstile(token: string | undefined, ip: string): Promise<boolean> {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) return !process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || process.env.NODE_ENV !== "production";
  if (!token) return false;

  try {
    const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      body: new URLSearchParams({ secret, response: token, ...(ip !== "unknown" ? { remoteip: ip } : {}) }),
      signal: AbortSignal.timeout(5_000),
      cache: "no-store",
    });
    const data = (await res.json()) as { success?: boolean };
    return data.success === true;
  } catch {
    return false;
  }
}
