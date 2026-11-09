import type { ReactNode } from "react";
import { absoluteUrl } from "@/lib/seo";

/*
 * Structured data as schema.org microdata (itemScope/itemProp on real HTML),
 * not JSON-LD: an inline <script> would need dangerouslySetInnerHTML, which
 * the CSP rules forbid. Google, Bing and answer engines read both.
 */

/** A visible FAQ list marked up as a schema.org FAQPage. */
export function FaqMicrodata({ items }: { items: [string, ReactNode][] }) {
  return (
    <div itemScope itemType="https://schema.org/FAQPage" className="not-doc flex flex-col gap-3">
      {items.map(([q, a]) => (
        <details key={q} itemProp="mainEntity" itemScope itemType="https://schema.org/Question" className="glass group rounded-[22px] open:bg-white/[0.04]">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-6 px-6 py-5 text-[16px] font-semibold text-paint [&::-webkit-details-marker]:hidden">
            <span itemProp="name">{q}</span>
            <span aria-hidden="true" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-white/10 text-bead transition-transform duration-500 ease-(--ease-spring) group-open:rotate-45">
              +
            </span>
          </summary>
          <div itemProp="acceptedAnswer" itemScope itemType="https://schema.org/Answer" className="px-6 pb-6 text-[15px] leading-relaxed text-steel">
            <div itemProp="text">{a}</div>
          </div>
        </details>
      ))}
    </div>
  );
}

/** Beadup itself, as a SoftwareApplication and Organization (rendered once, on the home page). */
export function AppMicrodata({ description, appStoreUrl }: { description: string; appStoreUrl: string | null }) {
  return (
    <>
      <div itemScope itemType="https://schema.org/SoftwareApplication" className="hidden">
        <meta itemProp="name" content="Beadup" />
        <meta itemProp="description" content={description} />
        <meta itemProp="applicationCategory" content="BusinessApplication" />
        <meta itemProp="operatingSystem" content="iOS" />
        <link itemProp="url" href={absoluteUrl("/")} />
        <link itemProp="image" href={absoluteUrl("/opengraph-image.png")} />
        {appStoreUrl && <link itemProp="installUrl" href={appStoreUrl} />}
        <span itemProp="offers" itemScope itemType="https://schema.org/Offer">
          <meta itemProp="price" content="0" />
          <meta itemProp="priceCurrency" content="USD" />
          <meta itemProp="description" content="Free plan. Optional Beadup Pro subscription in the app." />
        </span>
        <span itemProp="audience" itemScope itemType="https://schema.org/BusinessAudience">
          <meta itemProp="audienceType" content="Mobile car detailers" />
        </span>
      </div>
      <div itemScope itemType="https://schema.org/Organization" className="hidden">
        <meta itemProp="name" content="Beadup" />
        <link itemProp="url" href={absoluteUrl("/")} />
        <link itemProp="logo" href={absoluteUrl("/icon.png")} />
      </div>
    </>
  );
}
