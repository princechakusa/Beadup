import { tradeHeroSrc } from "@/content/trade-heroes";

/**
 * The picture at the top of a trade landing page: a photo of that trade
 * (barber, car detailer...), or a dark-glass banner with a bead glow until the
 * photo exists. Plain classes only (no inline style: the CSP forbids it), the
 * image is served from this site, and it is decorative (alt text names the trade).
 */
export function TradeHero({ slug, trade }: { slug: string; trade: string }) {
  const src = tradeHeroSrc(slug);
  return (
    <figure className="relative mt-6 overflow-hidden rounded-[32px] border border-white/10 bg-gunmetal shadow-[0_30px_80px_-30px_rgba(77,216,255,0.35)]">
      <div className="relative aspect-[16/9] w-full">
        {src ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={src} alt={`${trade} at work`} width={1280} height={731} fetchPriority="high" decoding="async" className="absolute inset-0 h-full w-full object-cover" />
        ) : (
          <div aria-hidden="true" className="absolute inset-0 bg-[radial-gradient(ellipse_60%_80%_at_70%_30%,rgba(77,216,255,0.28),transparent),radial-gradient(ellipse_50%_60%_at_20%_90%,rgba(11,79,122,0.5),transparent)]" />
        )}
        <div aria-hidden="true" className="absolute inset-0 bg-gradient-to-t from-midnight/90 via-midnight/10 to-transparent" />
        <figcaption className="absolute bottom-4 left-5 rounded-full border border-white/15 bg-midnight/60 px-4 py-1.5 text-[13px] font-semibold text-paint backdrop-blur">
          {trade}
        </figcaption>
      </div>
    </figure>
  );
}
