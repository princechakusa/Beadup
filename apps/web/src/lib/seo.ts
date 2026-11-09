import type { Metadata } from "next";

export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");

/** Absolute URL for a site path ("/pricing" -> "https://beadup.app/pricing"). */
export const absoluteUrl = (path: string) => `${SITE_URL}${path.startsWith("/") ? path : `/${path}`}`;

/** The numeric App Store id from NEXT_PUBLIC_APP_STORE_URL (".../id6831768099"), once the app is live. */
export function appStoreId(): string | null {
  const m = /\/id(\d{6,12})/.exec(process.env.NEXT_PUBLIC_APP_STORE_URL ?? "");
  return m ? m[1] : null;
}

/**
 * Safari's Smart App Banner on marketing pages, only once the app is live
 * (an id for an unreleased app shows a broken banner). Never on booking pages:
 * clients book in the browser and must not be pushed to the detailer app.
 */
export function appStoreMetadata(): Pick<Metadata, "itunes"> {
  const id = appStoreId();
  return id ? { itunes: { appId: id } } : {};
}
