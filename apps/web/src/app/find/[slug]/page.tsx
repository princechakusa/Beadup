import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { DirectoryResults, DirectorySearch } from "@/components/site/Directory";
import { AppBand } from "@/components/site/AppBand";
import { AquaHero } from "@/components/site/AquaHero";
import { SitePage } from "@/components/site/SiteChrome";
import { TRADE_PAGES, tradePage } from "@/content/trade-pages";
import { visitorCountry } from "@/lib/site";
import { directoryQuery, getDirectory } from "@/lib/directory";
import { OG_IMAGES, TWITTER_CARD } from "@/lib/seo";
import { TRADES } from "@/lib/trades";

/** Only the trades with pages: anything else is a real 404 (the middleware also checks). */
export const dynamicParams = false;

export function generateStaticParams() {
  return TRADE_PAGES.map((p) => ({ slug: p.slug }));
}

const heading = (name: string) => `${name} near you`;

export async function generateMetadata({ params }: PageProps<"/find/[slug]">): Promise<Metadata> {
  const p = tradePage((await params).slug);
  if (!p) return { title: "Not found" };
  const name = TRADES[p.trade].name;
  const description = `Book ${name.toLowerCase()} near you on Beadup: prices, photos and ratings, and an online booking in under a minute.`;
  return {
    title: `${heading(name)}: book online`,
    description,
    alternates: { canonical: `/find/${p.slug}` },
    openGraph: { images: OG_IMAGES, title: `${heading(name)} · Beadup`, description, url: `/find/${p.slug}` },
    twitter: { ...TWITTER_CARD, title: `${heading(name)} · Beadup`, description },
  };
}

/** Directory for one trade (e.g. /find/barbers). */
export default async function FindTrade({ params, searchParams }: PageProps<"/find/[slug]">) {
  const p = tradePage((await params).slug);
  if (!p) notFound();
  const query = { ...directoryQuery(await searchParams), trade: p.trade };
  const items = await getDirectory(query);
  const home = query.country ? null : await visitorCountry();
  const name = TRADES[p.trade].name;
  return (
    <SitePage>
      <AquaHero
        title={heading(name)}
        below={<DirectorySearch query={query} action={`/find/${p.slug}`} fixedTrade />}>
        {name} on Beadup, with prices, photos and ratings. Book a time online, no app needed.{" "}
        <Link href={`/for/${p.slug}`} className="font-semibold underline underline-offset-4">Run a {name.toLowerCase()} business?</Link>
      </AquaHero>
      <section className="mx-auto w-full max-w-[1500px] px-5 sm:px-8 lg:px-10">
        <DirectoryResults items={items} home={home} />
      </section>
      <AppBand className="mt-20" />
    </SitePage>
  );
}
