/** Top-level SEO landing pages (content in src/content/landing-pages.tsx). Also reserved handles in SQL. */
export const LANDING_SLUGS = ["car-detailing-booking-app", "ai-detailing-quote-calculator", "booking-link-with-deposits"] as const;

/**
 * Site pages that share the one-segment URL space with booking handles.
 * The proxy lets these through without a handle lookup; every one is also a
 * reserved handle in the database (detailers_handle_reserved).
 */
export const SITE_PAGES = new Set(["privacy", "terms", "support", "pricing", "delete-account", "blog", "admin", "for", "refund-policy", "find", ...LANDING_SLUGS]);
