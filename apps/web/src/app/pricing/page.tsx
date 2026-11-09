import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { AppStoreButton } from "@/components/site/AppStoreButton";
import { IconCheck } from "@/components/site/Icons";
import { Reveal } from "@/components/site/Reveal";
import { SitePage } from "@/components/site/SiteChrome";
import { getPublicConfig } from "@/lib/site";

const DESCRIPTION = "Start free with every feature. Upgrade to Beadup Pro in the app when you're booking more.";

export const metadata: Metadata = {
  title: "Pricing",
  description: DESCRIPTION,
  alternates: { canonical: "/pricing" },
  openGraph: { title: "Beadup pricing", description: DESCRIPTION, url: "/pricing" },
  twitter: { title: "Beadup pricing", description: DESCRIPTION },
};

function Check({ children }: { children: ReactNode }) {
  return (
    <li className="flex items-start gap-3">
      <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-bead/15 text-bead">
        <IconCheck size={13} strokeWidth={2.6} />
      </span>
      <span>{children}</span>
    </li>
  );
}

export default async function Pricing() {
  const config = await getPublicConfig();
  const free = config.free_bookings_per_month;
  // The price is display-only and comes from config; the real price is set in
  // the App Store / Google Play and shown by the store at purchase.
  const price = config.pro_price_display;

  const external = config.payments_mode === "external";
  const everything = external
    ? [
        "Your booking link, with your own deposit link shown to clients",
        "AI photo quotes from your price list",
        "Calendar, clients and money in one app",
        "Booking alerts on your phone",
        "No cut of your payments: clients pay you directly",
      ]
    : [
        "Your booking link with deposits",
        "AI photo quotes from your price list",
        "Calendar, clients and money in one app",
        "Automatic email receipts for every payment",
        "Clients pay the card fee, you keep the full deposit",
      ];

  const faq: [string, ReactNode][] = [
    [
      "What counts as a booking?",
      `Each appointment a client books through your link. The free plan includes ${free} a month, and the count starts again every month.`,
    ],
    [
      "How do I upgrade?",
      "In the Beadup app, open Pro. The purchase goes through the App Store, which shows the price in your currency before you confirm.",
    ],
    [
      "How do I cancel?",
      "Pro renews automatically until you cancel. Cancel any time in your App Store subscription settings, at least 24 hours before it renews.",
    ],
    ["Changed phones?", "Use Restore Purchases on the Pro screen in the app to get Pro back on your new iPhone."],
    [
      "Does Beadup take a cut of my jobs?",
      external
        ? "No. Clients pay you directly through your own payment link. Beadup never handles the money."
        : "No. Card processing is paid by your clients as a small booking fee, so you keep the full deposit.",
    ],
  ];

  return (
    <SitePage>
      <section className="mx-auto w-full max-w-6xl px-5 pt-14 text-center sm:px-8 sm:pt-20">
        <p className="enter text-[13px] font-semibold uppercase tracking-[0.18em] text-bead">Pricing</p>
        <h1 className="enter d-1 text-gradient mx-auto mt-3 max-w-3xl font-display text-[42px] font-extrabold leading-[1.02] tracking-[-0.045em] sm:text-7xl">
          Simple pricing for busy detailers
        </h1>
        <p className="enter d-2 mx-auto mt-5 max-w-xl text-lg leading-relaxed text-mist">
          Start free with every feature. Upgrade in the app when you&apos;re booking more.
        </p>
      </section>

      <section aria-label="Plans" className="mx-auto mt-14 grid w-full max-w-5xl gap-5 px-5 sm:px-8 md:grid-cols-2">
        <div className="enter d-3 glass flex flex-col gap-6 rounded-[32px] p-8 sm:p-10">
          <div>
            <h2 className="font-display text-2xl font-bold">Free</h2>
            <p className="mt-1 text-steel">For getting started</p>
          </div>
          <p className="font-display text-6xl font-extrabold tracking-[-0.05em]">$0</p>
          <ul className="flex flex-col gap-3.5 text-[15px] text-mist">
            <Check>
              <strong className="font-semibold text-paint">Up to {free} bookings a month</strong>
            </Check>
            {everything.map((f) => (
              <Check key={f}>{f}</Check>
            ))}
          </ul>
        </div>

        <div className="enter d-4 glass glass-edge relative flex flex-col gap-6 overflow-hidden rounded-[32px] p-8 shadow-[0_0_100px_-20px_rgba(77,216,255,0.4)] sm:p-10">
          <div aria-hidden="true" className="pointer-events-none absolute -right-24 -top-24 h-64 w-64 rounded-full bg-[radial-gradient(closest-side,rgba(77,216,255,0.25),transparent)]" />
          <div className="relative flex items-start justify-between gap-4">
            <div>
              <h2 className="font-display text-2xl font-bold">Pro</h2>
              <p className="mt-1 text-steel">For a full calendar</p>
            </div>
            <span className="rounded-full border border-bead/30 bg-bead/10 px-3 py-1 text-[12px] font-semibold text-bead">Unlimited</span>
          </div>
          {price ? (
            <p className="relative font-display text-6xl font-extrabold tracking-[-0.05em]">
              {price}
              <span className="text-xl font-semibold tracking-normal text-steel">/{config.pro_price_period ?? "month"}</span>
            </p>
          ) : (
            <p className="relative font-display text-3xl font-bold text-mist">Price shown in the app</p>
          )}
          <ul className="relative flex flex-col gap-3.5 text-[15px] text-mist">
            <Check>
              <strong className="font-semibold text-paint">Unlimited bookings</strong>
            </Check>
            <Check>Everything in Free</Check>
          </ul>
          <p className="relative mt-auto rounded-[20px] border border-white/[0.07] bg-black/20 p-4 text-sm leading-relaxed text-steel">
            Pro is a monthly subscription bought in the Beadup app through the App Store. It renews automatically until
            you cancel in your App Store subscription settings.
            {price ? " US price shown; prices in other countries are set by the store." : ""}
          </p>
        </div>
      </section>

      <p className="mx-auto mt-8 max-w-xl px-5 text-center text-sm text-steel">
        {external
          ? "Clients pay you directly through your own payment link. Beadup never takes a cut."
          : "Card processing is paid by your clients as a small booking fee, so you keep the full deposit."}
      </p>

      <section aria-labelledby="pricing-faq" className="mx-auto mt-24 w-full max-w-3xl px-5 sm:px-8">
        <Reveal>
          <h2 id="pricing-faq" className="text-gradient text-center font-display text-3xl font-extrabold tracking-[-0.03em] sm:text-4xl">
            Billing questions
          </h2>
        </Reveal>
        <Reveal className="mt-10 flex flex-col gap-3">
          {faq.map(([q, a]) => (
            <details key={q} className="glass group rounded-[22px]">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-6 px-6 py-5 text-[17px] font-semibold [&::-webkit-details-marker]:hidden">
                {q}
                <span aria-hidden="true" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-white/10 text-bead transition-transform duration-500 ease-(--ease-spring) group-open:rotate-45">
                  +
                </span>
              </summary>
              <div className="px-6 pb-6 text-[15px] leading-relaxed text-steel">{a}</div>
            </details>
          ))}
        </Reveal>
        <Reveal className="mt-14 flex flex-col items-center gap-4 text-center">
          <AppStoreButton />
          <p className="text-sm text-steel">
            More help on the <Link href="/support" className="text-bead underline underline-offset-4">support page</Link>.
          </p>
        </Reveal>
      </section>
    </SitePage>
  );
}
