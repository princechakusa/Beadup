import "server-only";
import Stripe from "stripe";

let client: Stripe | null = null;

/** Server-side Stripe client, or null when STRIPE_SECRET_KEY is not set (local demo mode). */
export function stripe(): Stripe | null {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return null;
  client ??= new Stripe(key, {
    apiVersion: "2026-09-30.endive",
    appInfo: { name: "Beadup", url: "https://beadup.app" },
    maxNetworkRetries: 2,
  });
  return client;
}

/**
 * Public site origin for Stripe redirect URLs. Taken from config, never from
 * the request Host header, so redirects can't be pointed at another domain.
 */
export function siteUrl(): string {
  const url = process.env.NEXT_PUBLIC_SITE_URL;
  if (url) return url.replace(/\/+$/, "");
  if (process.env.NODE_ENV === "production") throw new Error("NEXT_PUBLIC_SITE_URL is not set");
  return "http://localhost:3000";
}

/** Checkout sessions must live at least 30 minutes; match the booking hold. */
export const CHECKOUT_TTL_SECONDS = 30 * 60 + 60;
