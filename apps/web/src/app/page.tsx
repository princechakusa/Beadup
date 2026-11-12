import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { APP_STORE_URL, AppStoreButton, IphoneNote } from "@/components/site/AppStoreButton";
import {
  IconArrowRight,
  IconBell,
  IconCalendar,
  IconCamera,
  IconCheck,
  IconEyeOff,
  IconLink,
  IconRoute,
  IconShield,
  IconSparkle,
  IconTrash,
  IconUsers,
  IconWallet,
  IconWifiOff,
} from "@/components/site/Icons";
import { CountUp } from "@/components/site/CountUp";
import { LinkClaim } from "@/components/site/LinkClaim";
import { NoShowCalculator } from "@/components/site/NoShowCalculator";
import { Phone } from "@/components/site/Phone";
import { Reveal } from "@/components/site/Reveal";
import { Spotlight } from "@/components/site/Spotlight";
import { Walkthrough } from "@/components/site/Walkthrough";
import { ButtonLink, SitePage } from "@/components/site/SiteChrome";
import { AppMicrodata, FaqMicrodata } from "@/components/site/Structured";
import { BookInSeconds, FeatureBar, HeroLanding } from "@/components/site/HeroLanding";
import { appStoreMetadata } from "@/lib/seo";
import type { Country } from "@/lib/countries";
import { getPublicConfig, proPriceFor, siteCountry, visitorCountry, type PublicConfig } from "@/lib/site";

const TITLE = "Beadup: quote, book and get paid as a mobile detailer";
const DESCRIPTION =
  "The app for mobile car detailers. AI photo quotes from your own prices, a booking link clients use without an app, and a deposit step that cuts no-shows.";

export const metadata: Metadata = {
  title: { absolute: TITLE },
  description: DESCRIPTION,
  alternates: { canonical: "/" },
  openGraph: { title: TITLE, description: DESCRIPTION, url: "/" },
  twitter: { title: TITLE, description: DESCRIPTION },
  ...appStoreMetadata(),
};

export default async function Home() {
  const config = await getPublicConfig();
  const visitor = await visitorCountry();
  const external = config.payments_mode === "external";
  const ai = config.ai_provider === "anthropic" ? "Anthropic" : "OpenAI";

  return (
    <SitePage>
      <AppMicrodata description={DESCRIPTION} appStoreUrl={APP_STORE_URL} />
      <Spotlight />
      <HeroLanding />
      <FeatureBar />
      <BookInSeconds />
      <NoShows country={siteCountry(visitor)} />
      <HowItWorks external={external} />
      <Features external={external} ai={ai} />
      <Compare external={external} />
      <Showcase />
      <Trust external={external} ai={ai} />
      <PricingTeaser config={config} price={proPriceFor(config, visitor)} />
      <Faq config={config} external={external} ai={ai} />
      <FinalCta free={config.free_bookings_per_month} />
    </SitePage>
  );
}

/* ---------------------------------------------------------------- No-shows */

function NoShows({ country }: { country: Country }) {
  return (
    <section aria-labelledby="noshow-title" className="mx-auto mt-32 w-full max-w-6xl px-5 sm:px-8">
      <SectionHead eyebrow="The problem" title={<span id="noshow-title">What a no-show really costs</span>}>
        You drove out, you blocked the slot, you turned someone else away. Slide your own numbers and see what a deposit keeps.
      </SectionHead>
      <Reveal className="mt-12">
        <NoShowCalculator country={country} />
      </Reveal>
    </section>
  );
}

/* --------------------------------------------------------------- Shared */

function SectionHead({ eyebrow, title, children, center = false }: { eyebrow: string; title: ReactNode; children?: ReactNode; center?: boolean }) {
  return (
    <Reveal className={`flex max-w-3xl flex-col gap-4 ${center ? "mx-auto items-center text-center" : ""}`}>
      <p className="text-[13px] font-semibold uppercase tracking-[0.18em] text-bead">{eyebrow}</p>
      <h2 className="text-gradient text-balance font-display text-[34px] font-extrabold leading-[1.05] tracking-[-0.04em] sm:text-5xl">{title}</h2>
      {children && <p className="max-w-2xl text-lg leading-relaxed text-mist">{children}</p>}
    </Reveal>
  );
}

/* ---------------------------------------------------------- How it works */

function HowItWorks({ external }: { external: boolean }) {
  const steps = [
    {
      n: "01",
      icon: <IconCamera size={21} />,
      title: "Quote from photos",
      body: "Take a few photos of the car. Beadup suggests an itemized price from your own services and add-ons. Adjust it, approve it, send it.",
      screen: "quote" as const,
    },
    {
      n: "02",
      icon: <IconLink size={21} />,
      title: "Share your booking link",
      body: "Put it in your bio, your texts and your quotes. Clients pick a detail, their vehicle and an open time, from any browser.",
      screen: "booking" as const,
    },
    {
      n: "03",
      icon: <IconWallet size={21} />,
      title: "Get booked, with a deposit",
      body: external
        ? "Every booking asks for a 30% deposit, paid straight to you with your own payment link. The job lands on your calendar."
        : "Every booking takes a 30% deposit up front, so the time is really theirs. The job lands on your calendar.",
      screen: "payment" as const,
    },
    {
      n: "04",
      icon: <IconRoute size={21} />,
      title: "Show up, finish, get paid",
      body: "Today shows the next job with a Start route button. Mark it done, collect the balance, and ask for a review while the car still shines.",
      screen: "today" as const,
    },
  ];
  return (
    <section id="how-it-works" aria-labelledby="how-title" className="mx-auto mt-32 w-full max-w-6xl px-5 sm:px-8">
      <SectionHead eyebrow="How it works" title={<span id="how-title">From driveway photo to booked job</span>}>
        Four steps, all from your phone, between jobs.
      </SectionHead>
      <div className="mt-14">
        <Walkthrough steps={steps} />
      </div>
    </section>
  );
}

/* --------------------------------------------------------------- Features */

function Features({ external, ai }: { external: boolean; ai: string }) {
  return (
    <section id="features" aria-labelledby="features-title" className="mx-auto mt-32 w-full max-w-6xl px-5 sm:px-8">
      <SectionHead eyebrow="Features" title={<span id="features-title">Everything a one-person detailing business needs</span>}>
        Built around how mobile detailers actually work: in the driveway, between jobs, with one phone.
      </SectionHead>

      <div className="mt-14 grid gap-5 lg:grid-cols-6">
        {/* AI quote: wide */}
        <Reveal className="glass glass-edge spot relative overflow-hidden rounded-[32px] lg:col-span-4">
          <div className="grid h-full gap-6 p-7 sm:grid-cols-[minmax(0,1fr)_220px] sm:p-9">
            <div className="flex flex-col gap-4">
              <FeatureIcon icon={IconSparkle} />
              <h3 className="font-display text-[26px] font-bold leading-tight tracking-[-0.03em]">AI photo quotes</h3>
              <p className="text-[15px] leading-relaxed text-steel">
                Photos in, itemized quote out, priced only from your own price list. It flags add-ons like pet hair or
                odor treatment when it sees them. Nothing is sent until you approve it.
              </p>
              <ul className="mt-auto flex flex-col gap-2.5 pt-2 text-[14px] text-mist">
                <Bullet>Suggestions, never automatic charges</Bullet>
                <Bullet>Photos go to {ai} only after you agree</Bullet>
                <Bullet>Photos are re-encoded with location data removed</Bullet>
              </ul>
            </div>
            <div className="relative -mb-20 hidden sm:block">
              <Phone screen="quote" glow={false} sizes="220px" />
            </div>
          </div>
        </Reveal>

        {/* Booking link */}
        <Reveal delay={80} className="glass glass-edge spot spot flex flex-col gap-4 rounded-[32px] p-7 sm:p-9 lg:col-span-2">
          <FeatureIcon icon={IconLink} />
          <h3 className="font-display text-[26px] font-bold leading-tight tracking-[-0.03em]">One link, no app for clients</h3>
          <p className="text-[15px] leading-relaxed text-steel">
            Clients choose a detail, vehicle size, add-ons and a time in under a minute. No account, no download.
          </p>
          <div className="mt-auto pt-2">
            <LinkClaim />
          </div>
        </Reveal>

        {/* Calendar */}
        <Reveal className="glass glass-edge spot relative flex flex-col gap-4 overflow-hidden rounded-[32px] p-7 sm:p-9 lg:col-span-2">
          <FeatureIcon icon={IconCalendar} />
          <h3 className="font-display text-[26px] font-bold leading-tight tracking-[-0.03em]">Your week at a glance</h3>
          <p className="text-[15px] leading-relaxed text-steel">
            Every job on a timeline inside the hours you set, and clients can only book times that are still open.
          </p>
          <div className="relative -mb-40 mt-4 px-6">
            <Phone screen="calendar" glow={false} sizes="(min-width: 1024px) 260px, 70vw" />
          </div>
        </Reveal>

        {/* Money */}
        <Reveal delay={80} className="glass glass-edge spot spot relative flex flex-col gap-4 overflow-hidden rounded-[32px] p-7 sm:p-9 lg:col-span-2">
          <FeatureIcon icon={IconWallet} tone="gold" />
          <h3 className="font-display text-[26px] font-bold leading-tight tracking-[-0.03em]">Know what you made</h3>
          <p className="text-[15px] leading-relaxed text-steel">
            {external
              ? "Earned this month, what's still booked and which deposits are in. Clients pay you directly; Beadup takes no cut."
              : "Earned this month, what's still booked, deposits and balances. Clients cover the card fee, so you keep the full amount."}
          </p>
          <ul className="mt-2 flex flex-col divide-y divide-white/[0.06] rounded-[20px] border border-white/[0.07] bg-black/20 px-4 text-[14px]">
            {[
              ["Ana · Ceramic coating", "$750"],
              ["Dev · Interior refresh", "$140"],
              ["Jenna · Full detail", "$240"],
            ].map(([job, amount]) => (
              <li key={job} className="flex items-center justify-between py-3">
                <span className="text-mist">{job}</span>
                <span className="font-semibold text-gold">{amount}</span>
              </li>
            ))}
          </ul>
          <div className="mt-auto rounded-[22px] border border-gold/20 bg-gold/[0.05] p-5">
            <p className="text-[12px] text-steel">Earned in November</p>
            <p className="font-display text-[40px] font-extrabold leading-none tracking-[-0.04em] text-gold">
              <CountUp value={4280} prefix="$" />
              <span className="text-xl text-gold/60">.00</span>
            </p>
            <p className="mt-2 text-[12px] text-steel">Example figures</p>
          </div>
        </Reveal>

        {/* Alerts + offline */}
        <Reveal delay={160} className="flex flex-col gap-5 lg:col-span-2">
          <div className="glass glass-edge spot flex flex-1 flex-col gap-4 rounded-[32px] p-7 sm:p-9">
            <FeatureIcon icon={IconBell} />
            <h3 className="font-display text-[22px] font-bold leading-tight tracking-[-0.02em]">Booking alerts</h3>
            <p className="text-[15px] leading-relaxed text-steel">Your phone pings the moment someone books, with the service and time. Turn it on only if you want it.</p>
          </div>
          <div className="glass glass-edge spot flex flex-1 flex-col gap-4 rounded-[32px] p-7 sm:p-9">
            <FeatureIcon icon={IconWifiOff} />
            <h3 className="font-display text-[22px] font-bold leading-tight tracking-[-0.02em]">No signal? Still works</h3>
            <p className="text-[15px] leading-relaxed text-steel">Your schedule is saved on the phone, so the next address is there even in a parking garage.</p>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

function FeatureIcon({ icon: Icon, tone = "bead" }: { icon: (p: { size?: number }) => ReactNode; tone?: "bead" | "gold" }) {
  return (
    <span
      className={`flex h-12 w-12 items-center justify-center rounded-[16px] border ${
        tone === "gold" ? "border-gold/25 bg-gold/10 text-gold" : "border-bead/25 bg-bead/10 text-bead"
      } shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]`}
    >
      <Icon size={22} />
    </span>
  );
}

function Bullet({ children }: { children: ReactNode }) {
  return (
    <li className="flex items-start gap-2.5">
      <IconCheck size={17} className="mt-0.5 shrink-0 text-bead" />
      <span>{children}</span>
    </li>
  );
}

/* ---------------------------------------------------------------- Compare */

function Compare({ external }: { external: boolean }) {
  const before = [
    "Back-and-forth DMs to settle on a price",
    "\"What time works?\" ten messages deep",
    "No deposit, so a no-show costs the whole slot",
    "Prices typed from memory, different every time",
    "Earnings somewhere in a notes app",
  ];
  const after = [
    "A priced quote from photos in about a minute",
    "Clients pick an open time on your link",
    external ? "30% deposit paid to you before you drive out" : "30% deposit taken at booking",
    "Your price list, applied the same way every time",
    "Every job, deposit and balance in one place",
  ];
  return (
    <section aria-labelledby="compare-title" className="mx-auto mt-32 w-full max-w-6xl px-5 sm:px-8">
      <SectionHead eyebrow="Before and after" title={<span id="compare-title">Same jobs. Less chasing.</span>} center />
      <div className="mx-auto mt-12 grid max-w-5xl gap-5 md:grid-cols-2">
        <Reveal className="glass flex flex-col gap-5 rounded-[30px] p-7 sm:p-9">
          <p className="text-[13px] font-semibold uppercase tracking-[0.16em] text-steel">Without Beadup</p>
          <ul className="flex flex-col gap-3.5">
            {before.map((t) => (
              <li key={t} className="flex items-start gap-3 text-[15px] leading-relaxed text-steel">
                <span aria-hidden="true" className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-steel/50" />
                {t}
              </li>
            ))}
          </ul>
        </Reveal>
        <Reveal delay={80} className="glass glass-edge spot relative flex flex-col gap-5 overflow-hidden rounded-[30px] p-7 shadow-[0_0_90px_-30px_rgba(77,216,255,0.5)] sm:p-9">
          <div aria-hidden="true" className="breathe pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-[radial-gradient(closest-side,rgba(77,216,255,0.2),transparent)]" />
          <p className="text-[13px] font-semibold uppercase tracking-[0.16em] text-bead">With Beadup</p>
          <ul className="flex flex-col gap-3.5">
            {after.map((t) => (
              <li key={t} className="flex items-start gap-3 text-[15px] leading-relaxed text-paint">
                <IconCheck size={18} className="mt-0.5 shrink-0 text-bead" />
                {t}
              </li>
            ))}
          </ul>
        </Reveal>
      </div>
    </section>
  );
}

/* --------------------------------------------------------------- Showcase */

function Showcase() {
  const screens = [
    { screen: "today" as const, label: "Today" },
    { screen: "quote" as const, label: "New quote" },
    { screen: "calendar" as const, label: "Calendar" },
    { screen: "booking" as const, label: "Client booking" },
    { screen: "money" as const, label: "Money" },
  ];
  return (
    <section aria-labelledby="showcase-title" className="relative mt-32">
      <div className="mx-auto w-full max-w-6xl px-5 sm:px-8">
        <SectionHead eyebrow="The app" title={<span id="showcase-title">Made to be used with one thumb</span>} center>
          Dark, calm and fast in bright sun. Real screens from the Beadup iPhone app.
        </SectionHead>
      </div>
      <Reveal className="relative mt-14">
        <ul tabIndex={0} aria-label="App screens" className="mx-auto flex w-full max-w-[1400px] snap-x snap-mandatory gap-6 overflow-x-auto px-[max(20px,calc(50vw-140px))] pb-6 [scrollbar-width:none] sm:gap-8 lg:justify-center lg:overflow-visible lg:px-8">
          {screens.map((s, i) => (
            <li
              key={s.screen}
              className={`w-[240px] shrink-0 snap-center sm:w-[250px] lg:w-[220px] xl:w-[240px] ${i % 2 === 1 ? "lg:translate-y-10" : ""}`}
            >
              <Phone screen={s.screen} glow={i === 2} sizes="250px" />
              <p className="mt-5 text-center text-sm font-medium text-steel">{s.label}</p>
            </li>
          ))}
        </ul>
      </Reveal>
    </section>
  );
}

/* ------------------------------------------------------------------ Trust */

function Trust({ external, ai }: { external: boolean; ai: string }) {
  const items = [
    {
      icon: IconWallet,
      title: external ? "Your money goes straight to you" : "Card details never touch Beadup",
      body: external
        ? "Clients pay deposits directly to you with your own payment link. Beadup never handles the money and never takes a cut."
        : "Payments run on Stripe's secure checkout. Beadup never sees or stores a card number.",
    },
    {
      icon: IconSparkle,
      title: "AI only with your consent",
      body: `Vehicle photos are sent to ${ai} only after you turn on AI photo quotes${ai === "OpenAI" ? ", with request storage turned off" : ""}. Photos are kept private.`,
    },
    {
      icon: IconUsers,
      title: "Your clients stay yours",
      body: "Each detailer can only ever see their own clients and bookings. That rule is enforced inside the database itself.",
    },
    {
      icon: IconEyeOff,
      title: "No ads, no tracking",
      body: "We don't sell data, show ads or follow you around the web. Our website sets no tracking cookies.",
    },
    {
      icon: IconShield,
      title: "Locked down by default",
      body: "Encrypted in transit, strict browser security headers, bot protection on booking pages and private photo storage.",
    },
    {
      icon: IconTrash,
      title: "Leave any time",
      body: "Delete your account in the app and your data goes with it. No email chains, no hoops.",
    },
  ];
  return (
    <section aria-labelledby="trust-title" className="mx-auto mt-32 w-full max-w-6xl px-5 sm:px-8">
      <div className="glass relative overflow-hidden rounded-[36px] px-6 py-12 sm:px-12 sm:py-16">
        <div aria-hidden="true" className="pointer-events-none absolute -right-40 -top-40 h-[420px] w-[420px] rounded-full bg-[radial-gradient(closest-side,rgba(77,216,255,0.14),transparent)]" />
        <SectionHead eyebrow="Privacy and security" title={<span id="trust-title">Your business, kept private</span>}>
          Beadup handles your clients&apos; names, numbers and addresses. We treat that like it matters.
        </SectionHead>
        <ul className="mt-12 grid gap-x-10 gap-y-9 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((it, i) => (
            <Reveal as="li" key={it.title} delay={((i % 3) * 80) as 0 | 80 | 160} className="flex flex-col gap-3">
              <it.icon size={24} className="text-bead" />
              <h3 className="font-display text-lg font-bold tracking-[-0.01em]">{it.title}</h3>
              <p className="text-[15px] leading-relaxed text-steel">{it.body}</p>
            </Reveal>
          ))}
        </ul>
        <Reveal className="mt-12 flex flex-wrap gap-x-6 gap-y-3 border-t border-white/[0.07] pt-8 text-[15px]">
          <Link href="/privacy" className="inline-flex items-center gap-1.5 font-semibold text-bead hover:underline">
            Read the privacy policy <IconArrowRight size={16} />
          </Link>
          <Link href="/terms" className="inline-flex items-center gap-1.5 font-semibold text-mist hover:text-paint">
            Terms of service <IconArrowRight size={16} />
          </Link>
        </Reveal>
      </div>
    </section>
  );
}

/* ---------------------------------------------------------------- Pricing */

function PricingTeaser({ config, price }: { config: PublicConfig; price: string | null }) {
  return (
    <section aria-labelledby="pricing-title" className="mx-auto mt-32 w-full max-w-6xl px-5 sm:px-8">
      <SectionHead eyebrow="Pricing" title={<span id="pricing-title">Start free. Upgrade when you&apos;re busy.</span>} center />
      <div className="mx-auto mt-12 grid max-w-4xl gap-5 md:grid-cols-2">
        <Reveal className="glass flex flex-col gap-4 rounded-[30px] p-8">
          <h3 className="font-display text-xl font-bold">Free</h3>
          <p className="font-display text-5xl font-extrabold tracking-[-0.04em]">Free</p>
          <p className="text-[15px] text-steel">Up to {config.free_bookings_per_month} bookings a month, with every feature.</p>
        </Reveal>
        <Reveal delay={80} className="glass glass-edge spot spot relative flex flex-col gap-4 overflow-hidden rounded-[30px] p-8 shadow-[0_0_80px_-20px_rgba(77,216,255,0.35)]">
          <div className="flex items-center justify-between">
            <h3 className="font-display text-xl font-bold">Pro</h3>
            <span className="rounded-full border border-bead/30 bg-bead/10 px-3 py-1 text-[12px] font-semibold text-bead">Unlimited</span>
          </div>
          {price ? (
            <p className="font-display text-5xl font-extrabold tracking-[-0.04em]">
              {price}
              <span className="text-xl font-semibold text-steel">/{config.pro_price_period ?? "month"}</span>
            </p>
          ) : (
            <p className="font-display text-2xl font-bold text-mist">Price shown in the app</p>
          )}
          <p className="text-[15px] text-steel">Unlimited bookings. Bought in the Beadup app through the App Store.</p>
        </Reveal>
      </div>
      <Reveal className="mt-8 flex justify-center">
        <ButtonLink href="/pricing" variant="ghost">
          Compare plans
        </ButtonLink>
      </Reveal>
    </section>
  );
}

/* -------------------------------------------------------------------- FAQ */

function Faq({ config, external, ai }: { config: PublicConfig; external: boolean; ai: string }) {
  const qa: [string, ReactNode][] = [
    [
      "Do my clients need to download anything?",
      "No. Clients book from your link in any browser, on any phone or computer, with no account. It takes under a minute.",
    ],
    [
      "How do deposits work?",
      external ? (
        <>
          Every booking shows a 30% deposit. Clients pay it straight to you using the payment link or instructions you add
          in Settings, like Square, PayPal, Venmo, Cash App or Zelle. Beadup never touches the money and takes no cut.
        </>
      ) : (
        <>Every booking takes a 30% deposit at checkout. Clients pay a small booking fee that covers card processing, so you keep the full deposit.</>
      ),
    ],
    [
      "How accurate are AI photo quotes?",
      `They're a starting point, priced only from your own services and add-ons. You always review and approve a quote before it's sent. Photos are sent to ${ai} only after you agree to it in the app.`,
    ],
    [
      "Can I set my own services, prices and hours?",
      "Yes. Your services, prices by vehicle size, add-ons and weekly hours are all yours to set in Settings. Your booking link updates right away.",
    ],
    [
      "What does Beadup cost?",
      <>
        Free for up to {config.free_bookings_per_month} bookings a month. Beadup Pro removes the limit and is bought in the
        app through the App Store. See <Link href="/pricing" className="text-bead underline underline-offset-4">pricing</Link>.
      </>,
    ],
    [
      "What if I lose signal on a job?",
      "The app keeps your last synced schedule on the phone and shows it with an Offline label, so you still have the address and the job details.",
    ],
    [
      "How do I delete my account?",
      <>
        In the app, go to Settings, then Delete account. You can also use the{" "}
        <Link href="/delete-account" className="text-bead underline underline-offset-4">account deletion page</Link>.
      </>,
    ],
  ];
  return (
    <section id="faq" aria-labelledby="faq-title" className="mx-auto mt-32 grid w-full max-w-6xl gap-10 px-5 sm:px-8 lg:grid-cols-[minmax(0,380px)_minmax(0,1fr)] lg:gap-16">
      <div className="lg:sticky lg:top-28 lg:self-start">
        <SectionHead eyebrow="FAQ" title={<span id="faq-title">Questions, answered</span>}>
          Something else? <Link href="/support" className="text-bead underline underline-offset-4">Visit support</Link>.
        </SectionHead>
      </div>
      <Reveal>
        <FaqMicrodata items={qa} />
      </Reveal>
    </section>
  );
}

/* -------------------------------------------------------------- Final CTA */

function FinalCta({ free }: { free: number }) {
  return (
    <section id="get-the-app" aria-labelledby="cta-title" className="mx-auto mt-32 w-full max-w-6xl scroll-mt-28 px-5 sm:px-8">
      <Reveal className="glass glass-edge spot relative overflow-hidden rounded-[40px] px-6 py-16 text-center sm:px-12 sm:py-20">
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_60%_70%_at_50%_0%,rgba(77,216,255,0.2),transparent)]" />
        <div className="relative mx-auto flex max-w-2xl flex-col items-center gap-6">
          <AppIcon />
          <h2 id="cta-title" className="text-gradient font-display text-[36px] font-extrabold leading-[1.02] tracking-[-0.04em] sm:text-6xl">
            Your next booked week starts here
          </h2>
          <p className="max-w-lg text-lg leading-relaxed text-mist">
            Set up your services and prices in a few minutes, then share your link. Free for up to {free} bookings a month.
          </p>
          <div className="mt-2 flex flex-col items-center gap-4">
            <AppStoreButton />
            <IphoneNote />
          </div>
        </div>
      </Reveal>
    </section>
  );
}

function AppIcon() {
  return (
    <div className="relative">
      <div aria-hidden="true" className="absolute -inset-6 rounded-full bg-bead/20 blur-2xl" />
      {/* eslint-disable-next-line @next/next/no-img-element -- static 6 KB asset; next/image would add an inline style */}
      <img
        src="/app/icon.webp"
        alt="The Beadup app icon: a water bead on dark paint"
        width={96}
        height={96}
        className="relative h-24 w-24 rounded-[26px] shadow-[0_20px_50px_-10px_rgba(0,0,0,0.8),inset_0_0_0_1px_rgba(255,255,255,0.1)] ring-1 ring-white/10"
      />
    </div>
  );
}
