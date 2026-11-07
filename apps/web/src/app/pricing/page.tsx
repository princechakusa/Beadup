import type { Metadata } from "next";
import { SiteFooter, SiteHeader } from "@/components/site/SiteChrome";
import { getPublicConfig } from "@/lib/site";

export const metadata: Metadata = {
  title: "Pricing",
  description: "Start free. Upgrade to Pro in the app when you're booking more.",
};

const Check = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#4DD8FF" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="mt-0.5 shrink-0">
    <path d="M5 12.5l4.5 4.5L19 7.5" />
  </svg>
);

export default async function Pricing() {
  const config = await getPublicConfig();
  const free = config.free_bookings_per_month;
  // The price is display-only and comes from config; the real price is set in
  // the App Store / Google Play and shown by the store at purchase.
  const price = config.pro_price_display;

  const everything = [
    "Your booking link with deposits",
    "AI photo quotes from your price list",
    "Calendar, clients and money in one app",
    "Automatic email receipts for every payment",
    "Clients pay the card fee, you keep the full deposit",
  ];

  return (
    <>
      <SiteHeader />
      <main className="mx-auto w-full max-w-5xl px-5 pt-8 sm:px-10">
        <h1 className="text-center font-display text-4xl font-extrabold tracking-[-0.03em] sm:text-6xl">Simple pricing</h1>
        <p className="mx-auto mt-4 max-w-xl text-center text-lg text-[#c9d0dc]">
          Start free. Upgrade in the app when you&apos;re booking more.
        </p>

        <div className="mt-14 grid gap-5 md:grid-cols-2">
          <div className="flex flex-col gap-5 rounded-[32px] border border-white/[0.08] bg-panel p-8">
            <div>
              <h2 className="font-display text-2xl font-bold">Free</h2>
              <p className="mt-1 text-steel">For getting started</p>
            </div>
            <p className="font-display text-5xl font-extrabold">$0</p>
            <ul className="flex flex-col gap-3 text-[15px]">
              <li className="flex gap-3">
                <Check />
                Up to {free} bookings a month
              </li>
              {everything.map((f) => (
                <li key={f} className="flex gap-3">
                  <Check />
                  {f}
                </li>
              ))}
            </ul>
          </div>

          <div className="relative flex flex-col gap-5 overflow-hidden rounded-[32px] border border-bead/40 bg-[#0f1a20] p-8 shadow-[0_0_80px_rgba(77,216,255,0.12)]">
            <div>
              <h2 className="font-display text-2xl font-bold">Pro</h2>
              <p className="mt-1 text-steel">For a full calendar</p>
            </div>
            {price ? (
              <p className="font-display text-5xl font-extrabold">
                {price}
                <span className="text-xl font-semibold text-steel">/{config.pro_price_period ?? "month"}</span>
              </p>
            ) : (
              <p className="font-display text-2xl font-bold text-steel">Price shown in the app</p>
            )}
            <ul className="flex flex-col gap-3 text-[15px]">
              <li className="flex gap-3">
                <Check />
                Unlimited bookings
              </li>
              <li className="flex gap-3">
                <Check />
                Everything in Free
              </li>
            </ul>
            <p className="mt-auto text-sm leading-relaxed text-steel">
              Pro is a monthly subscription bought in the Beadup app through the App Store or Google Play. It renews
              automatically until you cancel in your App Store or Google Play subscription settings.
              {price ? " US price shown; prices in other countries are set by the store." : ""}
            </p>
          </div>
        </div>

        <p className="mt-10 text-center text-sm text-steel">
          Card processing is paid by your clients as a small booking fee, so you keep the full deposit.
        </p>
      </main>
      <SiteFooter />
    </>
  );
}
