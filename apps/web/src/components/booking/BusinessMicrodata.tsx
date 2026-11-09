import type { Detailer } from "@/lib/booking-types";
import { absoluteUrl } from "@/lib/seo";

/**
 * The detailer as a schema.org AutoWash (a LocalBusiness), so their booking
 * page can show up for "mobile detailing <city>" with services and rating.
 * Microdata (meta tags only, renders nothing): CSP forbids inline JSON-LD.
 */
export function BusinessMicrodata({ detailer }: { detailer: Detailer }) {
  const url = absoluteUrl(`/${detailer.handle}`);
  const prices = detailer.services.map((s) => s.priceCents.sedan).filter((c) => c > 0);
  const from = prices.length ? Math.min(...prices) / 100 : null;
  return (
    <div itemScope itemType="https://schema.org/AutoWash" className="hidden">
      <meta itemProp="name" content={detailer.businessName} />
      {detailer.tagline && <meta itemProp="description" content={detailer.tagline} />}
      <link itemProp="url" href={url} />
      {detailer.serviceArea && <meta itemProp="areaServed" content={detailer.serviceArea} />}
      {from !== null && <meta itemProp="priceRange" content={`From $${from}`} />}
      <span itemProp="potentialAction" itemScope itemType="https://schema.org/ReserveAction">
        <link itemProp="target" href={url} />
      </span>
      {detailer.rating !== null && detailer.reviewCount > 0 && (
        <span itemProp="aggregateRating" itemScope itemType="https://schema.org/AggregateRating">
          <meta itemProp="ratingValue" content={detailer.rating.toFixed(1)} />
          <meta itemProp="reviewCount" content={String(detailer.reviewCount)} />
          <meta itemProp="bestRating" content="5" />
        </span>
      )}
      <span itemProp="hasOfferCatalog" itemScope itemType="https://schema.org/OfferCatalog">
        <meta itemProp="name" content="Detailing services" />
        {detailer.services.map((s) => (
          <span key={s.id} itemProp="itemListElement" itemScope itemType="https://schema.org/Offer">
            <meta itemProp="price" content={(s.priceCents.sedan / 100).toFixed(2)} />
            <meta itemProp="priceCurrency" content="USD" />
            <span itemProp="itemOffered" itemScope itemType="https://schema.org/Service">
              <meta itemProp="name" content={s.name} />
              {s.description && <meta itemProp="description" content={s.description} />}
            </span>
          </span>
        ))}
      </span>
    </div>
  );
}
