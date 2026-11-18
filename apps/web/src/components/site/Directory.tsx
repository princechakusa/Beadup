import Link from "next/link";
import { COUNTRIES, COUNTRY_CODES, formatMoney } from "@/lib/countries";
import type { DirectoryEntry, DirectoryQuery } from "@/lib/directory";
import { TRADE_IDS, TRADES } from "@/lib/trades";
import { IconStar } from "./Icons";

/** Search by name or area, trade and country. A plain GET form: works without JavaScript. */
export function DirectorySearch({ query, action = "/find", fixedTrade }: { query: DirectoryQuery; action?: string; fixedTrade?: boolean }) {
  const field = "h-12 rounded-[16px] border border-white/10 bg-white/[0.04] px-4 text-[15px] text-paint outline-none focus:border-bead/60";
  return (
    <form action={action} method="get" role="search" className="glass mt-8 grid gap-3 rounded-[24px] p-4 sm:grid-cols-[minmax(0,1fr)_200px_190px_auto]">
      <label className="sr-only" htmlFor="dir-q">Name or area</label>
      <input id="dir-q" name="q" defaultValue={query.q ?? ""} placeholder="Name or area, e.g. Soweto" maxLength={60} className={field} />
      {!fixedTrade && (
        <>
          <label className="sr-only" htmlFor="dir-trade">Trade</label>
          <select id="dir-trade" name="trade" defaultValue={query.trade ?? ""} className={field}>
            <option value="">All trades</option>
            {TRADE_IDS.filter((t) => t !== "other").map((t) => (
              <option key={t} value={t}>{TRADES[t].name}</option>
            ))}
          </select>
        </>
      )}
      <label className="sr-only" htmlFor="dir-country">Country</label>
      <select id="dir-country" name="country" defaultValue={query.country ?? ""} className={field}>
        <option value="">All countries</option>
        {COUNTRY_CODES.map((c) => (
          <option key={c} value={c}>{COUNTRIES[c].name}</option>
        ))}
      </select>
      <button type="submit" className="h-12 rounded-[16px] bg-bead px-6 font-semibold text-midnight">Search</button>
    </form>
  );
}

function initials(name: string) {
  return name.replace(/[^\p{L}\p{N}\s]/gu, "").split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]!.toUpperCase()).join("") || "B";
}

/**
 * Photo-first cards (design option A): big photo, trade tag, rating, name, place, lowest price.
 * `home` is the visitor's country: those businesses come first, everyone else follows (nobody is hidden).
 */
export function DirectoryResults({ items, home }: { items: DirectoryEntry[]; home?: string | null }) {
  if (items.length === 0) {
    return (
      <p className="glass mt-8 rounded-[24px] p-8 text-center text-steel">
        No businesses match yet. Try another area, or{" "}
        <Link href="/#get-the-app" className="text-bead underline underline-offset-4">put yours on Beadup</Link>.
      </p>
    );
  }
  const ordered = home ? [...items.filter((d) => d.country === home), ...items.filter((d) => d.country !== home)] : items;
  return (
    <ul className="mt-8 grid gap-x-6 gap-y-9 sm:grid-cols-2 lg:grid-cols-4">
      {ordered.map((d) => (
        <li key={d.handle}>
          <Link href={`/${d.handle}`} className="group flex h-full flex-col gap-2.5 rounded-[22px]">
            <span className="relative block h-[200px] overflow-hidden rounded-[22px] border border-white/[0.08] bg-gradient-to-br from-[#232a35] to-[#11151b] transition-transform duration-300 ease-(--ease-spring) group-hover:-translate-y-0.5">
              {d.photo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={`/api/media/${d.handle}/avatar?v=${d.photo}`} alt="" loading="lazy" className="h-full w-full object-cover" />
              ) : (
                <span aria-hidden="true" className="flex h-full w-full items-center justify-center bg-[radial-gradient(120px_90px_at_70%_30%,rgba(77,216,255,0.25),transparent)] font-display text-4xl font-extrabold text-paint/70">
                  {initials(d.businessName)}
                </span>
              )}
              <span className="absolute bottom-3 left-3 inline-flex h-7 items-center rounded-full border border-white/[0.12] bg-midnight/70 px-3 text-[12px] font-semibold">
                {TRADES[d.trade].name}
              </span>
            </span>
            <span className="flex items-center gap-1.5 text-[14px]">
              {d.rating !== null ? (
                <>
                  <span className="font-semibold">{d.rating.toFixed(1)}</span>
                  <IconStar size={14} className="fill-gold text-gold" />
                  <span className="text-steel">({d.reviewCount} {d.reviewCount === 1 ? "review" : "reviews"})</span>
                </>
              ) : (
                <>
                  <span className="font-semibold">New</span>
                  <span className="text-steel">no reviews yet</span>
                </>
              )}
            </span>
            <span className="truncate font-display text-[18px] font-bold">{d.businessName}</span>
            <span className="truncate text-[14px] text-steel">{d.serviceArea || COUNTRIES[d.country].name}</span>
            <span className="mt-auto flex items-center justify-between pt-1">
              <span className="text-[14px] font-semibold text-gold">{d.fromCents !== null ? `from ${formatMoney(d.fromCents, d.country)}` : ""}</span>
              <span className="inline-flex h-9 items-center rounded-[12px] bg-bead px-4 text-[14px] font-bold text-bead-ink">Book</span>
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
