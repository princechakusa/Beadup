import type { Metadata } from "next";
import Link from "next/link";
import { IconArrowRight } from "@/components/site/Icons";
import { Reveal } from "@/components/site/Reveal";
import { AquaHero } from "@/components/site/AquaHero";
import { SitePage } from "@/components/site/SiteChrome";
import { GUIDES } from "@/content/guides";
import { appStoreMetadata, OG_IMAGES, TWITTER_CARD } from "@/lib/seo";

const TITLE = "Guides for appointment businesses";
const DESCRIPTION = "Plain, practical guides for detailers, salons, barbers, cleaners and mechanics: pricing, deposits, no-shows and getting booked.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/blog" },
  openGraph: { images: OG_IMAGES, title: TITLE, description: DESCRIPTION, url: "/blog" },
  twitter: { ...TWITTER_CARD, title: TITLE, description: DESCRIPTION },
  ...appStoreMetadata(),
};

export default function Blog() {
  return (
    <SitePage>
      <AquaHero title="Run a tighter booking business">
        {DESCRIPTION}
      </AquaHero>
      <section className="mx-auto w-full max-w-6xl px-5 sm:px-8">
        <Reveal className="mt-6 grid gap-5 md:grid-cols-2">
          {GUIDES.map((g) => (
            <Link
              key={g.slug}
              href={`/blog/${g.slug}`}
              className="glass glass-edge group flex flex-col rounded-[26px] p-7 transition-transform duration-500 ease-(--ease-spring) hover:-translate-y-1"
            >
              <span className="text-[12px] font-semibold uppercase tracking-[0.16em] text-steel">{g.readMin} min read</span>
              <h2 className="mt-3 font-display text-[24px] font-bold leading-tight tracking-[-0.02em] text-paint">{g.title}</h2>
              <p className="mt-3 flex-1 text-[15px] leading-relaxed text-steel">{g.description}</p>
              <span className="mt-6 inline-flex items-center gap-1.5 text-[15px] font-semibold text-bead">
                Read guide
                <IconArrowRight size={16} className="transition-transform duration-300 group-hover:translate-x-1" />
              </span>
            </Link>
          ))}
        </Reveal>
      </section>
    </SitePage>
  );
}
