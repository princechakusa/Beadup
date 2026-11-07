import "server-only";
import { createHash } from "node:crypto";

/**
 * The visitor's IP for rate limiting. Prefer headers that the hosting
 * platform sets itself (a client cannot forge them there); the left-most
 * X-Forwarded-For entry is client-controlled on hosts that append to it, so
 * it is only a last resort.
 */
export function clientIp(h: Headers): string {
  return (
    h.get("cf-connecting-ip") ?? // Cloudflare
    h.get("x-nf-client-connection-ip") ?? // Netlify
    h.get("x-real-ip") ?? // Vercel and most reverse proxies
    h.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    "unknown"
  ).slice(0, 64);
}

/** One-way hash so raw IPs are never stored (rate-limit keys). */
export const hashIp = (ip: string) => createHash("sha256").update(ip).digest("hex").slice(0, 32);
