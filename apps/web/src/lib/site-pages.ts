/**
 * Site pages that share the one-segment URL space with booking handles.
 * The proxy lets these through without a handle lookup; every one is also a
 * reserved handle in the database (detailers_handle_reserved).
 */
export const SITE_PAGES = new Set(["privacy", "terms", "support", "pricing", "delete-account", "blog", "admin", "for"]);
