import type { Metadata } from "next";
import Link from "next/link";
import { DocPage } from "@/components/site/SiteChrome";
import { getPublicConfig, SUPPORT_EMAIL } from "@/lib/site";

export const metadata: Metadata = { title: "Support" };

const CLIENT_FAQ_EXTERNAL: [string, React.ReactNode][] = [
  [
    "How do I change or cancel my booking?",
    "Contact your detailer directly. Deposits are paid to the detailer, so refunds follow the policy they gave you.",
  ],
  ["How do I pay my deposit?", "After booking, your confirmation shows your detailer's payment link or instructions. Pay them directly."],
];

const DETAILER_FAQ_EXTERNAL: [string, React.ReactNode][] = [
  ["How do I get paid?", "Clients pay you directly. In the app, go to Settings, then Payment link, and add your Square, PayPal, Venmo or Cash App link, or your Zelle details. Clients see it right after they book."],
  ["What does Beadup cost me?", <>Beadup never touches your money and takes no cut. See <Link href="/pricing">pricing</Link> for plans.</>],
];

const CLIENT_FAQ: [string, React.ReactNode][] = [
  [
    "How do I change or cancel my booking?",
    "Contact your detailer using the number in your confirmation text. If you cancel 24 hours or more before the appointment, your deposit is refunded; the booking fee covers card processing and isn't refunded.",
  ],
  ["I paid but didn't get a confirmation.", "Check your email for the Stripe receipt. If you still need help, email us with the business name and the time you booked."],
  ["How do I stop text messages?", "Reply STOP to any message. Reply START to turn them back on."],
];

const DETAILER_FAQ: [string, React.ReactNode][] = [
  ["How do I get paid?", "Connect Stripe in the app under Settings, Payouts. Deposits and balances go to your Stripe account and then to your bank."],
  ["What does Beadup cost me?", <>Beadup doesn&apos;t take a cut of your payments, and clients pay the card fee. See <Link href="/pricing">pricing</Link> for plans.</>],
  ["Are AI quotes accurate?", "They're a starting point priced from your own price list. Always check the suggestion before you send it."],
  ["How do I cancel Pro?", "In your App Store or Google Play subscription settings."],
  ["How do I delete my account?", <>In the app: Settings, Delete account. Or use the <Link href="/delete-account">account deletion page</Link>.</>],
];

export default async function Support() {
  const { payments_mode } = await getPublicConfig();
  const external = payments_mode === "external";
  const clientFaq = external ? CLIENT_FAQ_EXTERNAL : CLIENT_FAQ;
  const detailerFaq = external ? [...DETAILER_FAQ_EXTERNAL, ...DETAILER_FAQ.slice(2)] : DETAILER_FAQ;
  return (
    <DocPage title="Support">
      <p>
        Email <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a> and we&apos;ll get back to you as soon as we can.
      </p>
      <h2>For clients</h2>
      {clientFaq.map(([q, a]) => (
        <div key={q}>
          <p>
            <strong>{q}</strong>
          </p>
          <p className="mt-1">{a}</p>
        </div>
      ))}
      <h2>For detailers</h2>
      {detailerFaq.map(([q, a]) => (
        <div key={q}>
          <p>
            <strong>{q}</strong>
          </p>
          <p className="mt-1">{a}</p>
        </div>
      ))}
    </DocPage>
  );
}
