import Link from "next/link";
import { IconPhone } from "./Icons";

// Our own button, not Apple's badge or logo (Apple marketing guidelines).
/** The App Store listing, once live. Until then the button says "Coming soon". */
export const APP_STORE_URL = process.env.NEXT_PUBLIC_APP_STORE_URL || null;

// Apple App Analytics campaign link: downloads from the website show up as
// campaign "website" (provider token from App Store Connect > Analytics > Campaigns).
const APP_STORE_PROVIDER_TOKEN = "129220014";
const appId = APP_STORE_URL && /\/id(\d+)/.exec(APP_STORE_URL)?.[1];
const TRACKED_URL = appId ? `https://apps.apple.com/app/apple-store/id${appId}?pt=${APP_STORE_PROVIDER_TOKEN}&ct=website&mt=8` : APP_STORE_URL;

export function AppStoreButton({ size = "lg", className = "" }: { size?: "md" | "lg"; className?: string }) {
  const h = size === "lg" ? "h-[60px] px-6" : "h-12 px-5";
  const body = (
    <>
      <IconPhone size={24} />
      <span className="flex flex-col items-start leading-none">
        <span className="text-[11px] font-medium opacity-75">{APP_STORE_URL ? "Download on the" : "Coming soon to the"}</span>
        <span className={`font-display font-bold tracking-[-0.01em] ${size === "lg" ? "text-[19px]" : "text-base"}`}>App Store</span>
      </span>
    </>
  );
  const cls = `btn-sheen inline-flex items-center gap-3 rounded-[20px] bg-paint text-midnight shadow-[0_14px_40px_-10px_rgba(77,216,255,0.55)] transition-transform duration-300 ease-(--ease-spring) hover:-translate-y-0.5 active:scale-[0.97] ${h} ${className}`;
  return APP_STORE_URL ? (
    <a href={TRACKED_URL ?? APP_STORE_URL} className={cls} rel="noopener">
      {body}
    </a>
  ) : (
    <Link href="/#get-the-app" className={cls} aria-label="Beadup for iPhone is coming soon to the App Store">
      {body}
    </Link>
  );
}

export function IphoneNote() {
  return (
    <span className="inline-flex items-center gap-2 text-sm text-steel">
      <IconPhone size={16} /> For iPhone. Your clients book from any browser.
    </span>
  );
}
