import type { Metadata } from "next";
import Link from "next/link";
import { DirectoryResults, DirectorySearch } from "@/components/site/Directory";
import { SitePage } from "@/components/site/SiteChrome";
import { TRADE_PAGES } from "@/content/trade-pages";
import { directoryQuery, getDirectory } from "@/lib/directory";
import { TRADES } from "@/lib/trades";

const TITLE = "Find and book a pro near you";
const DESCRIPTION =
  "Book detailers, hair salons, barbers, nail techs, groomers, cleaners and mechanics near you. See prices, photos and ratings, then book online in a minute.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/find" },
  openGraph: { title: `${TITLE} · Beadup`, description: DESCRIPTION, url: "/find" },
};

/** The public directory: every published business that hasn't opted out. */
export default async function Find({ searchParams }: PageProps<"/find">) {
  const query = directoryQuery(await searchParams);
  const items = await getDirectory(query);
  return (
    <SitePage>
      <section className="mx-auto w-full max-w-6xl px-5 pt-10 sm:px-8 sm:pt-16">
        <h1 className="text-gradient text-balance font-display text-[40px] font-extrabold leading-[1.02] tracking-[-0.045em] sm:text-6xl">{TITLE}</h1>
        <p className="mt-5 max-w-2xl text-lg leading-relaxed text-mist">
          Real prices, real photos and real ratings. Pick a business and book a time in under a minute, no app needed.
        </p>
        <nav aria-label="Trades" className="mt-6 flex flex-wrap gap-2">
          {TRADE_PAGES.map((p) => (
            <Link key={p.slug} href={`/find/${p.slug}`} className="inline-flex h-9 items-center rounded-full border border-white/15 px-4 text-[14px] text-mist hover:text-paint">
              {TRADES[p.trade].name}
            </Link>
          ))}
        </nav>
        <DirectorySearch query={query} />
        <DirectoryResults items={items} />
      </section>
    </SitePage>
  );
}
