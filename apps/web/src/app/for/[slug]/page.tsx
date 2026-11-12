import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { APP_STORE_URL, AppStoreButton, IphoneNote } from "@/components/site/AppStoreButton";
import { IconArrowRight, IconCheck } from "@/components/site/Icons";
import { Reveal } from "@/components/site/Reveal";
import { SitePage } from "@/components/site/SiteChrome";
import { AppMicrodata, FaqMicrodata } from "@/components/site/Structured";
import { TRADE_PAGES, tradePage } from "@/content/trade-pages";
import { appStoreMetadata } from "@/lib/seo";
import { getPublicConfig } from "@/lib/site";
import { TRADES } from "@/lib/trades";

/** Only the trades above exist: anything else is a real 404 (not a soft 404 page with status 200). */
export const dynamicParams = false;

export function generateStaticParams() {
  return TRADE_PAGES.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: PageProps<"/for/[slug]">): Promise<Metadata> {
  const p = tradePage((await params).slug);
  if (!p) return { title: "Not found" };
  const url = `/for/${p.slug}`;
  return {
    title: p.title,
    description: p.description,
    alternates: { canonical: url },
    openGraph: { title: `${p.title} · Beadup`, description: p.description, url },
    twitter: { title: `${p.title} · Beadup`, description: p.description },
    ...appStoreMetadata(),
  };
}

/** A landing page for one trade: the short answer first, then why, how, examples and FAQ. */
export default async function TradeLanding({ params }: PageProps<"/for/[slug]">) {
  const p = tradePage((await params).slug);
  if (!p) notFound();
  const config = await getPublicConfig();
  const trade = TRADES[p.trade];
  const faq: [string, string][] = [
    ...p.faq,
    ["Do my clients need an app?", "No. They book from your link in any browser, with no account. It takes under a minute."],
    [
      "How do deposits work?",
      "Each booking shows a 30% deposit that clients pay straight to you with your own payment link or instructions. Beadup never handles the money and takes no cut.",
    ],
    ["What does it cost?", `Free for up to ${config.free_bookings_per_month} bookings a month. Beadup Pro removes the limit and is bought in the app.`],
  ];
  const others = TRADE_PAGES.filter((o) => o.slug !== p.slug);
  const steps: [string, string][] = [
    [
      "Add your services",
      `Name, price${trade.pricing === "tiers" ? ` by ${trade.tierTitle.toLowerCase().replace(/^your /, "")}` : ""}, how long it takes${
        trade.photoFirst ? " and a photo" : ""
      }. Starter services for ${trade.name.toLowerCase()} are ready to edit.`,
    ],
    ["Share your link", "Put beadup.app/yourname in your bio, WhatsApp status and messages."],
    ["Get booked with a deposit", "Clients pick a service and an open time, then pay a 30% deposit straight to you."],
    ["Remind, finish, get reviewed", "Send reminders and receipts on WhatsApp in one tap, then collect a rating."],
  ];

  return (
    <SitePage>
      <AppMicrodata description={p.description} appStoreUrl={APP_STORE_URL} />
      <section className="mx-auto w-full max-w-4xl px-5 pt-10 sm:px-8 sm:pt-16">
        <nav aria-label="Breadcrumb" className="text-[13px] text-steel">
          <Link href="/" className="hover:text-paint">
            Beadup
          </Link>{" "}
          <span aria-hidden="true">/</span>{" "}
          <Link href="/for" className="hover:text-paint">
            Who it&apos;s for
          </Link>{" "}
          <span aria-hidden="true">/</span> {trade.name}
        </nav>
        <h1 className="text-gradient mt-5 text-balance font-display text-[40px] font-extrabold leading-[1.02] tracking-[-0.045em] sm:text-6xl">{p.h1}</h1>
        <p className="mt-6 max-w-2xl text-xl leading-relaxed text-mist">{p.answer}</p>
        <div className="mt-8 flex flex-wrap items-center gap-4">
          <AppStoreButton />
          <Link href="/beadup-demo-detailing" className="inline-flex h-[60px] items-center gap-2 rounded-full border border-white/30 px-7 font-semibold hover:bg-white/[0.06]">
            See a booking page <IconArrowRight size={18} />
          </Link>
        </div>
        <div className="mt-4">
          <IphoneNote />
        </div>
      </section>

      <section aria-label="What it fixes" className="mx-auto mt-20 grid w-full max-w-4xl gap-5 px-5 sm:px-8 md:grid-cols-2">
        <Reveal className="glass flex flex-col gap-4 rounded-[28px] p-7">
          <h2 className="font-display text-xl font-bold">What it fixes</h2>
          <ul className="flex flex-col gap-3 text-[15px] text-steel">
            {p.pains.map((t) => (
              <li key={t} className="flex gap-3">
                <span aria-hidden="true" className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-steel/60" />
                {t}
              </li>
            ))}
          </ul>
        </Reveal>
        <Reveal delay={80} className="glass glass-edge flex flex-col gap-4 rounded-[28px] p-7">
          <h2 className="font-display text-xl font-bold">What you get</h2>
          <ul className="flex flex-col gap-3 text-[15px] text-paint">
            {p.fits.map((t) => (
              <li key={t} className="flex gap-3">
                <IconCheck size={18} className="mt-0.5 shrink-0 text-bead" />
                {t}
              </li>
            ))}
          </ul>
        </Reveal>
      </section>

      <section aria-labelledby="how" className="mx-auto mt-20 w-full max-w-4xl px-5 sm:px-8">
        <h2 id="how" className="font-display text-3xl font-extrabold tracking-[-0.03em]">
          How it works
        </h2>
        <ol className="mt-6 grid gap-4 sm:grid-cols-2">
          {steps.map(([t, b], i) => (
            <li key={t} className="glass rounded-[24px] p-6">
              <p className="text-[13px] font-semibold text-bead">0{i + 1}</p>
              <h3 className="mt-1 font-display text-lg font-bold">{t}</h3>
              <p className="mt-2 text-[15px] leading-relaxed text-steel">{b}</p>
            </li>
          ))}
        </ol>
        <p className="mt-6 text-[14px] text-steel">
          Example prices: {p.examples.map((e) => `${e.name} ${e.price}`).join(" · ")}. You set your own, in your own currency.
        </p>
      </section>

      <section aria-labelledby="faq" className="mx-auto mt-20 w-full max-w-4xl px-5 sm:px-8">
        <h2 id="faq" className="mb-6 font-display text-3xl font-extrabold tracking-[-0.03em]">
          Questions
        </h2>
        <FaqMicrodata items={faq} />
      </section>

      <section aria-labelledby="more" className="mx-auto mt-20 w-full max-w-4xl px-5 sm:px-8">
        <h2 id="more" className="font-display text-xl font-bold">
          Beadup for other businesses
        </h2>
        <ul className="mt-4 flex flex-wrap gap-2">
          {others.map((o) => (
            <li key={o.slug}>
              <Link href={`/for/${o.slug}`} className="inline-flex h-10 items-center rounded-full border border-white/15 px-4 text-[14px] text-mist hover:text-paint">
                {TRADES[o.trade].name}
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </SitePage>
  );
}
