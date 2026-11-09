import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { IconArrowRight, IconDoc, IconMail, IconTrash, IconUsers, IconWallet } from "@/components/site/Icons";
import { FaqMicrodata } from "@/components/site/Structured";
import { Reveal } from "@/components/site/Reveal";
import { SitePage } from "@/components/site/SiteChrome";
import { getPublicConfig, SUPPORT_EMAIL } from "@/lib/site";

const DESCRIPTION = "Help for detailers using Beadup and for clients who booked through a Beadup link.";

export const metadata: Metadata = {
  title: "Support",
  description: DESCRIPTION,
  alternates: { canonical: "/support" },
  openGraph: { title: "Beadup support", description: DESCRIPTION, url: "/support" },
  twitter: { title: "Beadup support", description: DESCRIPTION },
};

const CLIENT_FAQ_EXTERNAL: [string, ReactNode][] = [
  [
    "How do I change or cancel my booking?",
    "Contact your detailer directly. Deposits are paid to the detailer, so refunds follow the policy they gave you.",
  ],
  ["How do I pay my deposit?", "After booking, your confirmation shows your detailer's payment link or instructions. Pay them directly."],
];

const DETAILER_FAQ_EXTERNAL: [string, ReactNode][] = [
  ["How do I get paid?", "Clients pay you directly. In the app, go to Settings, then Payment link, and add your Square, PayPal, Venmo or Cash App link, or your Zelle details. Clients see it right after they book."],
  ["What does Beadup cost me?", <>Beadup never touches your money and takes no cut. See <Link href="/pricing">pricing</Link> for plans.</>],
];

const CLIENT_FAQ: [string, ReactNode][] = [
  [
    "How do I change or cancel my booking?",
    "Contact your detailer using the number in your confirmation text. If you cancel 24 hours or more before the appointment, your deposit is refunded; the booking fee covers card processing and isn't refunded.",
  ],
  ["I paid but didn't get a confirmation.", "Check your email for the Stripe receipt. If you still need help, email us with the business name and the time you booked."],
  ["How do I stop text messages?", "Reply STOP to any message. Reply START to turn them back on."],
];

const DETAILER_FAQ: [string, ReactNode][] = [
  ["How do I get paid?", "Connect Stripe in the app under Settings, Payouts. Deposits and balances go to your Stripe account and then to your bank."],
  ["What does Beadup cost me?", <>Beadup doesn&apos;t take a cut of your payments, and clients pay the card fee. See <Link href="/pricing">pricing</Link> for plans.</>],
  ["Are AI quotes accurate?", "They're a starting point priced from your own price list. Always check the suggestion before you send it."],
  ["How do I cancel Pro?", "In your App Store subscription settings."],
  ["How do I delete my account?", <>In the app: Settings, Delete account. Or use the <Link href="/delete-account">account deletion page</Link>.</>],
];

function FaqGroup({ id, icon: Icon, title, items }: { id: string; icon: typeof IconUsers; title: string; items: [string, ReactNode][] }) {
  return (
    <section aria-labelledby={id} className="flex flex-col gap-4">
      <Reveal className="flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-[13px] border border-bead/25 bg-bead/10 text-bead">
          <Icon size={20} />
        </span>
        <h2 id={id} className="font-display text-2xl font-bold tracking-[-0.02em]">
          {title}
        </h2>
      </Reveal>
      <Reveal className="[&_a]:text-bead [&_a]:underline [&_a]:underline-offset-4">
        <FaqMicrodata items={items} />
      </Reveal>
    </section>
  );
}

export default async function Support() {
  const { payments_mode } = await getPublicConfig();
  const external = payments_mode === "external";
  const clientFaq = external ? CLIENT_FAQ_EXTERNAL : CLIENT_FAQ;
  const detailerFaq = external ? [...DETAILER_FAQ_EXTERNAL, ...DETAILER_FAQ.slice(2)] : DETAILER_FAQ;
  const links = [
    { href: "/delete-account", icon: IconTrash, title: "Delete your account", body: "In the app or with a request here." },
    { href: "/privacy", icon: IconDoc, title: "Privacy policy", body: "What we collect and why." },
    { href: "/pricing", icon: IconWallet, title: "Pricing and billing", body: "Plans, upgrades and cancelling." },
  ];
  return (
    <SitePage>
      <section className="mx-auto w-full max-w-6xl px-5 pt-14 sm:px-8 sm:pt-20">
        <p className="enter text-[13px] font-semibold uppercase tracking-[0.18em] text-bead">Support</p>
        <h1 className="enter d-1 text-gradient mt-3 max-w-3xl font-display text-[42px] font-extrabold leading-[1.02] tracking-[-0.045em] sm:text-7xl">
          How can we help?
        </h1>
        <p className="enter d-2 mt-5 max-w-xl text-lg leading-relaxed text-mist">
          Answers for detailers and for clients who booked through a Beadup link. A real person reads every email.
        </p>

        <div className="mt-12 grid gap-5 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
          <a
            href={`mailto:${SUPPORT_EMAIL}`}
            className="enter d-3 glass glass-edge group flex flex-col gap-5 rounded-[30px] p-8 transition-transform duration-500 ease-(--ease-spring) hover:-translate-y-1"
          >
            <span className="flex h-12 w-12 items-center justify-center rounded-[16px] border border-bead/25 bg-bead/10 text-bead">
              <IconMail size={22} />
            </span>
            <span className="font-display text-2xl font-bold tracking-[-0.02em]">Email us</span>
            <span className="text-[15px] leading-relaxed text-steel">
              Email <span className="break-all font-semibold text-bead">{SUPPORT_EMAIL}</span> and we&apos;ll get back to you as soon as
              we can. If it&apos;s about a booking, include the business name and the time you booked.
            </span>
            <span className="mt-auto inline-flex items-center gap-1.5 text-[15px] font-semibold text-paint">
              Write to support <IconArrowRight size={16} className="transition-transform group-hover:translate-x-0.5" />
            </span>
          </a>
          <ul className="enter d-4 flex flex-col gap-3">
            {links.map((l) => (
              <li key={l.href}>
                <Link href={l.href} className="glass group flex items-center gap-4 rounded-[22px] p-5 transition-colors hover:bg-white/[0.05]">
                  <l.icon size={22} className="shrink-0 text-bead" />
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="font-semibold">{l.title}</span>
                    <span className="text-sm text-steel">{l.body}</span>
                  </span>
                  <IconArrowRight size={18} className="text-steel transition-transform group-hover:translate-x-0.5 group-hover:text-paint" />
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <div className="mx-auto mt-20 grid w-full max-w-6xl gap-14 px-5 sm:px-8 lg:grid-cols-2 lg:gap-10">
        <FaqGroup id="for-clients" icon={IconUsers} title="For clients" items={clientFaq} />
        <FaqGroup id="for-detailers" icon={IconWallet} title="For detailers" items={detailerFaq} />
      </div>
    </SitePage>
  );
}
