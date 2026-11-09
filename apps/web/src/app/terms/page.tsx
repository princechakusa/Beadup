import type { Metadata } from "next";
import Link from "next/link";
import { DocPage, H2 } from "@/components/site/SiteChrome";
import { getPublicConfig, LEGAL_NAME, SUPPORT_EMAIL } from "@/lib/site";

export const metadata: Metadata = {
  title: "Terms of service",
  description: "The agreement between you and Beadup for using the Beadup app and website.",
  alternates: { canonical: "/terms" },
};

// Mirrors how the product works (cancellation policy = cancel_booking() in
// SQL; subscriptions = store billing). Have it reviewed by a lawyer before
// launch and fill in the governing law.
const TOC = ["What Beadup is", "Accounts", "Payments", "Cancellations and refunds for bookings", "Beadup Pro", "AI photo quotes", "Text messages", "Acceptable use", "Disclaimers and liability", "Changes", "Contact"];

export default async function Terms() {
  const { payments_mode } = await getPublicConfig();
  const external = payments_mode === "external";
  return (
    <DocPage eyebrow="Legal" title="Terms of service" updated="November 7, 2026" toc={TOC}>
      <p>
        These terms are an agreement between you and {LEGAL_NAME} (&quot;Beadup&quot;, &quot;we&quot;) about using the
        Beadup app and website. By using Beadup you agree to them. If you are using Beadup for a business, you agree on
        behalf of that business.
      </p>

      <H2>What Beadup is</H2>
      <p>
        Beadup is software for mobile car detailers to quote, schedule and get paid. Detailers are independent businesses.
        Beadup is not a party to the service a detailer provides to a client, and is not responsible for the quality,
        timing or outcome of that work.
      </p>

      <H2>Accounts</H2>
      <ul>
        <li>You must give accurate information and keep your sign-in secure.</li>
        <li>You are responsible for activity on your account.</li>
        <li>You can delete your account at any time in the app or on our <Link href="/delete-account">account deletion page</Link>.</li>
      </ul>

      <H2>Payments</H2>
      {external ? (
      <ul>
        <li>
          Beadup does not process or hold client payments. Clients pay the detailer directly, using the payment method
          the detailer shows after booking (for example their own payment link or bank transfer details).
        </li>
        <li>
          The booking page shows the price and a suggested deposit (currently 30% of the price). Deposits, balances,
          cancellations and refunds are agreed between the client and the detailer.
        </li>
        <li>Beadup does not take a percentage of detailers&apos; payments.</li>
      </ul>
      ) : (
      <ul>
        <li>
          Client payments are processed by Stripe and paid out to the detailer&apos;s Stripe account. Detailers must
          accept Stripe&apos;s terms, and Stripe may verify their identity or hold payouts under its own policies.
        </li>
        <li>
          Clients pay a deposit when booking (currently 30% of the price) and the balance after the job, plus a booking fee
          that covers card processing. The amounts are shown before payment.
        </li>
        <li>Beadup does not take a percentage of detailers&apos; payments.</li>
      </ul>
      )}

      <H2>Cancellations and refunds for bookings</H2>
      {external ? (
      <p>
        Clients should contact the detailer to change or cancel a booking. Because deposits are paid to the detailer
        directly, refunds are made by the detailer under the policy they give the client. Beadup cannot issue refunds.
      </p>
      ) : (
      <ul>
        <li>If a client cancels 24 hours or more before the appointment, the deposit is refunded. The booking fee covers card processing and is not refunded.</li>
        <li>If a client cancels later than that, or doesn&apos;t show up, the deposit is not refunded.</li>
        <li>If the detailer cancels, the client is refunded in full, including the booking fee.</li>
      </ul>
      )}

      <H2>Beadup Pro</H2>
      <p>
        The free plan includes a monthly booking limit. Beadup Pro is an auto-renewing subscription bought in the app
        through the App Store or Google Play, at the price shown there before you buy. It renews until you cancel in your
        App Store or Google Play subscription settings, and is billed and refunded under those stores&apos; terms.
      </p>

      <H2>AI photo quotes</H2>
      <p>
        AI suggestions are estimates to help detailers price a job. They use the detailer&apos;s own price list and the
        detailer reviews and approves every quote before it is sent. Clients are never charged based on an AI suggestion
        alone.
      </p>

      <H2>Text messages</H2>
      <p>
        Clients who agree receive booking confirmations, reminders and receipts by text. Message and data rates may apply.
        Reply STOP to opt out or HELP for help.
      </p>

      <H2>Acceptable use</H2>
      <p>
        Don&apos;t misuse Beadup: no unlawful, fraudulent or harmful activity, no spam, no attempts to access other
        people&apos;s data or disrupt the service. We may suspend accounts that break these terms.
      </p>

      <H2>Disclaimers and liability</H2>
      <p>
        Beadup is provided &quot;as is&quot;. To the extent the law allows, we are not liable for indirect or
        consequential losses, and our total liability for any claim is limited to the amount you paid Beadup in the 12
        months before the claim. Nothing in these terms limits rights you have under consumer law that can&apos;t be
        limited.
      </p>

      <H2>Changes</H2>
      <p>We may update these terms. We&apos;ll change the date above and tell detailers in the app about significant changes.</p>

      <H2>Contact</H2>
      <p>
        <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>
      </p>
    </DocPage>
  );
}
