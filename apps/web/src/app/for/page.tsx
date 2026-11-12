import type { Metadata } from "next";
import Link from "next/link";
import { IconArrowRight } from "@/components/site/Icons";
import { Reveal } from "@/components/site/Reveal";
import { SitePage } from "@/components/site/SiteChrome";
import { TRADE_PAGES } from "@/content/trade-pages";
import { appStoreMetadata } from "@/lib/seo";
import { TRADES } from "@/lib/trades";

const TITLE = "Booking links for appointment businesses";
const DESCRIPTION =
  "Car detailers, hair salons, barbers, nail techs, makeup artists, pet groomers, cleaners, pressure washers, mechanics and handymen: one booking link, deposits and WhatsApp reminders.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/for" },
  openGraph: { title: `${TITLE} · Beadup`, description: DESCRIPTION, url: "/for" },
  ...appStoreMetadata(),
};

/** Every trade Beadup is set up for, each linking to its own page. */
export default function WhoItsFor() {
  return (
    <SitePage>
      <section className="mx-auto w-full max-w-5xl px-5 pt-10 sm:px-8 sm:pt-16">
        <h1 className="text-gradient text-balance font-display text-[40px] font-extrabold leading-[1.02] tracking-[-0.045em] sm:text-6xl">
          One booking link for every appointment business
        </h1>
        <p className="mt-6 max-w-2xl text-xl leading-relaxed text-mist">
          Pick your trade when you sign up and Beadup sets itself up for it: the right words, prices by size or one price, photos on
          your services, and whether clients come to you or you go to them.
        </p>
      </section>
      <ul className="mx-auto mt-14 grid w-full max-w-5xl gap-4 px-5 sm:grid-cols-2 sm:px-8 lg:grid-cols-3">
        {TRADE_PAGES.map((p, i) => (
          <Reveal as="li" key={p.slug} delay={((i % 3) * 80) as 0 | 80 | 160}>
            <Link href={`/for/${p.slug}`} className="glass group flex h-full flex-col gap-2 rounded-[24px] p-6 hover:bg-white/[0.05]">
              <span className="font-display text-lg font-bold">{TRADES[p.trade].name}</span>
              <span className="text-[14px] leading-relaxed text-steel">{p.description}</span>
              <span className="mt-auto inline-flex items-center gap-1.5 pt-2 text-[14px] font-semibold text-bead">
                See how <IconArrowRight size={15} className="transition-transform group-hover:translate-x-0.5" />
              </span>
            </Link>
          </Reveal>
        ))}
      </ul>
    </SitePage>
  );
}
