import Link from "next/link";
import { COUNTRIES, COUNTRY_CODES, formatMoney } from "@/lib/countries";
import type { DirectoryEntry, DirectoryQuery } from "@/lib/directory";
import { TRADE_IDS, TRADES } from "@/lib/trades";

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

/** Result cards: photo, name, trade, area, rating and lowest price, linking to the booking page. */
export function DirectoryResults({ items }: { items: DirectoryEntry[] }) {
  if (items.length === 0) {
    return (
      <p className="glass mt-8 rounded-[24px] p-8 text-center text-steel">
        No businesses match yet. Try another area, or{" "}
        <Link href="/#get-the-app" className="text-bead underline underline-offset-4">put yours on Beadup</Link>.
      </p>
    );
  }
  return (
    <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {items.map((d) => (
        <li key={d.handle}>
          <Link href={`/${d.handle}`} className="glass group flex h-full gap-4 rounded-[24px] p-5 transition-colors hover:bg-white/[0.05]">
            {d.photo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={`/api/media/${d.handle}/avatar?v=${d.photo}`} alt="" width={64} height={64} loading="lazy" className="h-16 w-16 shrink-0 rounded-[18px] object-cover ring-1 ring-white/10" />
            ) : (
              <span aria-hidden="true" className="flex h-16 w-16 shrink-0 items-center justify-center rounded-[18px] bg-gradient-to-b from-white to-[#cfd8e4] font-display text-xl font-extrabold text-midnight">
                {d.businessName.replace(/[^\p{L}\p{N}\s]/gu, "").split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]!.toUpperCase()).join("") || "B"}
              </span>
            )}
            <span className="flex min-w-0 flex-1 flex-col gap-1">
              <span className="truncate font-display text-[17px] font-bold">{d.businessName}</span>
              <span className="truncate text-[13px] text-steel">
                {[TRADES[d.trade].name, d.serviceArea || COUNTRIES[d.country].name].filter(Boolean).join(" · ")}
              </span>
              <span className="mt-auto flex items-center gap-3 pt-1 text-[13px]">
                {d.rating !== null ? (
                  <span className="font-semibold text-gold">★ {d.rating.toFixed(1)} <span className="font-normal text-steel">({d.reviewCount})</span></span>
                ) : (
                  <span className="text-steel">New</span>
                )}
                {d.fromCents !== null && <span className="text-mist">from {formatMoney(d.fromCents, d.country)}</span>}
              </span>
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
