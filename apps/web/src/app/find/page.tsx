import type { Metadata } from "next";
import Link from "next/link";
import { DirectoryResults, DirectorySearch } from "@/components/site/Directory";
import { AppBand } from "@/components/site/AppBand";
import { AquaHero, heroChip } from "@/components/site/AquaHero";
import { SitePage } from "@/components/site/SiteChrome";
import { visitorCountry } from "@/lib/site";
import { directoryQuery, getDirectory } from "@/lib/directory";
import { OG_IMAGES, TWITTER_CARD } from "@/lib/seo";

/** One short row, like a store's category chips. */
const HERO_TRADES = [
  { href: "/find/car-detailers", label: "Detailing" },
  { href: "/find/hair-salons", label: "Hair" },
  { href: "/find/barbers", label: "Barber" },
  { href: "/find/nail-technicians", label: "Nails" },
  { href: "/find/pet-groomers", label: "Grooming" },
  { href: "/find/house-cleaners", label: "Cleaning" },
  { href: "/find/mobile-mechanics", label: "Mechanic" },
  { href: "/for", label: "More..." },
];

const TITLE = "Find and book a pro near you";
const DESCRIPTION =
  "Book detailers, hair salons, barbers, nail techs, groomers, cleaners and mechanics near you. See prices, photos and ratings, then book online in a minute.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/find" },
  openGraph: { images: OG_IMAGES, title: `${TITLE} · Beadup`, description: DESCRIPTION, url: "/find" },
  twitter: { ...TWITTER_CARD, title: `${TITLE} · Beadup`, description: DESCRIPTION },
};

/** The public directory: every published business that hasn't opted out. */
export default async function Find({ searchParams }: PageProps<"/find">) {
  const query = directoryQuery(await searchParams);
  const items = await getDirectory(query);
  const home = query.country ? null : await visitorCountry();
  return (
    <SitePage>
      <AquaHero
        title="Find a pro. Book with confidence."
        below={
          <div className="flex flex-col gap-6">
            <DirectorySearch query={query} />
            <nav aria-label="Trades" className="-mx-5 overflow-x-auto px-5 sm:mx-0 sm:overflow-visible sm:px-0">
              <ul className="mx-auto flex w-max items-center gap-3 sm:w-auto sm:justify-center">
                {HERO_TRADES.map((c) => (
                  <li key={c.href}>
                    <Link href={c.href} className={heroChip}>
                      {c.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          </div>
        }>
        Real prices, real photos and real ratings. Pick a business and book a time in under a minute, no app needed.
      </AquaHero>
      <section className="mx-auto w-full max-w-[1500px] px-5 sm:px-8 lg:px-10">
        <DirectoryResults items={items} home={home} />
      </section>
      <AppBand className="mt-20" />
    </SitePage>
  );
}
