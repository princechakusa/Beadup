import "server-only";

/**
 * Verifies a Cloudflare Turnstile token (bot protection on the public booking
 * page, rules.md section 7). Fails closed in production. In development,
 * with no secret configured, it is skipped so the flow works offline.
 * Cloudflare publishes test keys for local use: see .env.example.
 */
export async function verifyTurnstile(token: string | undefined, ip: string): Promise<boolean> {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) return process.env.NODE_ENV !== "production";
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
