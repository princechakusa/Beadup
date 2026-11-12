import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { DirectoryResults, DirectorySearch } from "@/components/site/Directory";
import { SitePage } from "@/components/site/SiteChrome";
import { TRADE_PAGES, tradePage } from "@/content/trade-pages";
import { directoryQuery, getDirectory } from "@/lib/directory";
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
    openGraph: { title: `${heading(name)} · Beadup`, description, url: `/find/${p.slug}` },
  };
}

/** Directory for one trade (e.g. /find/barbers). */
export default async function FindTrade({ params, searchParams }: PageProps<"/find/[slug]">) {
  const p = tradePage((await params).slug);
  if (!p) notFound();
  const query = { ...directoryQuery(await searchParams), trade: p.trade };
  const items = await getDirectory(query);
  const name = TRADES[p.trade].name;
  return (
    <SitePage>
      <section className="mx-auto w-full max-w-6xl px-5 pt-10 sm:px-8 sm:pt-16">
        <nav aria-label="Breadcrumb" className="text-[13px] text-steel">
          <Link href="/find" className="hover:text-paint">Find a pro</Link> <span aria-hidden="true">/</span> {name}
        </nav>
        <h1 className="text-gradient mt-5 text-balance font-display text-[40px] font-extrabold leading-[1.02] tracking-[-0.045em] sm:text-6xl">{heading(name)}</h1>
        <p className="mt-5 max-w-2xl text-lg leading-relaxed text-mist">
          {name} on Beadup, with prices, photos and ratings. Book a time online, no app needed.{" "}
          <Link href={`/for/${p.slug}`} className="text-bead underline underline-offset-4">Run a {name.toLowerCase()} business?</Link>
        </p>
        <DirectorySearch query={query} action={`/find/${p.slug}`} fixedTrade />
        <DirectoryResults items={items} />
      </section>
    </SitePage>
  );
}
