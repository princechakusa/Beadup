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

/** The public App Store listing (id 6831768099). Used for structured data and links when the env var is not set. */
export const APP_STORE_LISTING = process.env.NEXT_PUBLIC_APP_STORE_URL || "https://apps.apple.com/us/app/beadup/id6831768099";

/** Default share image (the root opengraph-image.png). A page that sets its own openGraph/twitter loses the file-based image, so it is repeated here. */
export const OG_IMAGES = [{ url: "/opengraph-image.png", width: 1200, height: 630, alt: "Beadup: the booking link for appointment businesses" }];
export const TWITTER_CARD = { card: "summary_large_image" as const, images: ["/opengraph-image.png"] };

/** Title, description, canonical, Open Graph and Twitter tags for a page that has no hero image of its own. */
export function pageMeta(path: string, title: string, description: string, ogTitle = `${title} · Beadup`): Metadata {
  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: { title: ogTitle, description, url: path, images: OG_IMAGES },
    twitter: { title: ogTitle, description, ...TWITTER_CARD },
  };
}
