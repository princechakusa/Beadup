import type { Metadata } from "next";
import Link from "next/link";
import { LandingHero } from "@/components/site/LandingHero";
import { SiteFooter, SiteHeader } from "@/components/site/SiteChrome";
import { getPublicConfig } from "@/lib/site";

export const metadata: Metadata = {
  title: { absolute: "Beadup: quote, book and get paid as a mobile detailer" },
  description:
    "AI photo quotes, a booking link your clients can use without an app, and deposits that cover their own card fee. Built for mobile car detailers.",
};

const FEATURES = [
  {
    title: "AI photo quotes",
    body: "Photos in, itemized price out, from your own price list. You approve every quote before it's sent.",
  },
  {
    title: "Deposits that stick",
    body: "Clients pay a deposit to book. The card fee is on them, so you keep the full amount.",
  },
  {
    title: "One link, no app for clients",
    body: "Put your link in your Instagram bio. Clients pick a time and pay from their browser in under a minute.",
  },
  {
    title: "Your day at a glance",
    body: "Today's jobs, the next address, and one tap to start the route, text or call the client.",
  },
  {
    title: "Automatic receipts",
    body: "Every deposit and balance comes with an email receipt for your client, sent automatically. Nothing to chase.",
  },
  {
    title: "Paid in full, on the spot",
    body: "Send a balance link when the job's done. The money goes straight to your bank through Stripe.",
  },
];

export default async function Home() {
  const config = await getPublicConfig();
  return (
    <div className="relative overflow-hidden">
      <SiteHeader />
      <LandingHero freeBookings={config.free_bookings_per_month} />

      <section id="features" className="mx-auto mt-24 grid w-full max-w-6xl gap-5 px-5 sm:grid-cols-2 sm:px-10 lg:grid-cols-3">
        {FEATURES.map((f) => (
          <div key={f.title} className="flex flex-col gap-2.5 rounded-[32px] border border-white/[0.08] bg-panel p-7">
            <h2 className="font-display text-[22px] font-bold">{f.title}</h2>
            <p className="text-[15px] leading-relaxed text-steel">{f.body}</p>
          </div>
        ))}
      </section>

      <section className="mx-auto mt-24 flex w-full max-w-6xl flex-col items-center gap-5 px-5 text-center sm:px-10">
        <h2 className="font-display text-4xl font-extrabold tracking-[-0.03em]">See what your clients see</h2>
        <p className="max-w-xl text-lg text-[#c9d0dc]">A sample booking page for a mobile detailer. Your page looks like this, with your services and prices.</p>
        <Link
          href="/marcus"
          className="inline-flex h-14 items-center rounded-[18px] border border-white/[0.12] bg-white/[0.05] px-7 font-semibold hover:bg-white/[0.08]"
        >
          Open the sample booking page
        </Link>
      </section>

      <SiteFooter />
    </div>
  );
}
