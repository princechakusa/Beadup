import type { Metadata } from "next";
import Link from "next/link";
import { DocPage, H2 } from "@/components/site/SiteChrome";
import { LEGAL_NAME, SUPPORT_EMAIL } from "@/lib/site";

export const metadata: Metadata = {
  title: "Refund policy",
  description: "How refunds work for Beadup Pro (bought in the app or on our website) and for appointment deposits paid to businesses.",
  alternates: { canonical: "/refund-policy" },
};

// Written for today (Pro sold in the app through Apple and Google; deposits paid
// to businesses directly) and for website purchases through Paddle (merchant of
// record) once they are switched on. Have it reviewed by a lawyer before launch.
const TOC = ["Summary", "Beadup Pro bought in the app", "Beadup Pro bought on our website", "Cancelling", "Appointment deposits", "The free plan", "How to ask for a refund"];

export default function RefundPolicy() {
  return (
    <DocPage eyebrow="Legal" title="Refund policy" updated="November 12, 2026" toc={TOC}>
      <p>
        This policy explains how refunds work for payments to {LEGAL_NAME} (&quot;Beadup&quot;, &quot;we&quot;) for Beadup Pro,
        and what happens with money that clients pay to the businesses that use Beadup.
      </p>

      <H2>Summary</H2>
      <ul>
        <li>Beadup Pro bought in the iPhone or Android app is refunded by Apple or Google, under their rules.</li>
        <li>Beadup Pro bought on our website can be refunded in full within 14 days of any payment, no questions asked.</li>
        <li>You can cancel Pro at any time. You keep Pro until the end of the period you paid for.</li>
        <li>
          Deposits and payments for appointments go straight to the business you booked, not to Beadup. Refunds for those are
          handled by that business.
        </li>
      </ul>

      <H2>Beadup Pro bought in the app</H2>
      <p>
        When you subscribe in the Beadup app, Apple (App Store) or Google (Google Play) takes the payment and handles refunds.
        We can&apos;t refund these purchases ourselves.
      </p>
      <ul>
        <li>
          App Store: request a refund at{" "}
          <a href="https://reportaproblem.apple.com" rel="noopener noreferrer">reportaproblem.apple.com</a>.
        </li>
        <li>
          Google Play: request a refund in the Play Store under Payments and subscriptions, or at{" "}
          <a href="https://support.google.com/googleplay/answer/2479637" rel="noopener noreferrer">Google Play Help</a>.
        </li>
      </ul>
      <p>If you&apos;re not sure how you subscribed, write to us and we&apos;ll help.</p>

      <H2>Beadup Pro bought on our website</H2>
      <p>
        When Pro is sold on our website, our order process is conducted by our online reseller Paddle.com. Paddle.com is the
        merchant of record for those orders: it takes the payment and processes refunds.
      </p>
      <ul>
        <li>You can ask for a full refund within 14 days of any payment (the first one or a renewal), for any reason.</li>
        <li>After 14 days, payments are not refunded, except where the law requires it or where Beadup Pro didn&apos;t work as described and we couldn&apos;t fix it.</li>
        <li>Refunds go back to the payment method you used. They usually arrive within 5 to 10 business days, depending on your bank.</li>
        <li>When a payment is refunded, Pro ends and your account moves to the free plan. Your data stays.</li>
      </ul>

      <H2>Cancelling</H2>
      <p>
        You can cancel Pro at any time: in your App Store or Google Play subscription settings for app purchases, or from the
        receipt email or your account for website purchases. Cancelling stops the next renewal. You keep Pro until the end of the
        period you already paid for, and there is no charge after that. Deleting your Beadup account does not cancel a store
        subscription, so cancel it in the store too.
      </p>

      <H2>Appointment deposits</H2>
      <p>
        Beadup is software. When you book an appointment with a business on Beadup (a detailer, salon, barber, groomer, cleaner,
        mechanic or any other business), any deposit or payment goes directly to that business, using the payment link or
        instructions they gave you. Beadup never receives that money, so Beadup can&apos;t refund it.
      </p>
      <p>
        If you cancel or the business cancels, the business&apos;s own cancellation and refund terms apply. Contact the business
        directly; their phone and WhatsApp are on your booking page. You can also ask to cancel from your private booking page.
      </p>

      <H2>The free plan</H2>
      <p>The free plan costs nothing, so there is nothing to refund.</p>

      <H2>How to ask for a refund</H2>
      <p>
        Email <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a> from the email on your account, with the date of the payment.
        We reply within 2 business days. See also our <Link href="/terms">terms of service</Link> and{" "}
        <Link href="/privacy">privacy policy</Link>.
      </p>
    </DocPage>
  );
}
