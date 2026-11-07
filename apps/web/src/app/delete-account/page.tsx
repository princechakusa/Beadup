import type { Metadata } from "next";
import { DocPage } from "@/components/site/SiteChrome";
import { SUPPORT_EMAIL } from "@/lib/site";
import { DeletionForm } from "./DeletionForm";

export const metadata: Metadata = {
  title: "Delete your account",
  description: "How to delete your Beadup account and data.",
};

export default function DeleteAccount() {
  return (
    <DocPage title="Delete your account">
      <h2>The fastest way: in the app</h2>
      <p>Open Beadup, go to Settings, then Delete account. Your account and data are deleted right away.</p>

      <h2>No access to the app? Ask us</h2>
      <p>Send a request below. We&apos;ll confirm it&apos;s your account by email, then delete it.</p>
      <DeletionForm supportEmail={SUPPORT_EMAIL} />

      <h2>What gets deleted</h2>
      <ul>
        <li>Your account and sign-in</li>
        <li>Your business profile and booking link</li>
        <li>Services, prices, availability, clients, bookings, quotes and photos</li>
        <li>Messages and payment history stored in Beadup</li>
      </ul>
      <h2>What is kept</h2>
      <ul>
        <li>A security record that the account was deleted, without your details.</li>
        <li>Payment records Stripe and the card networks must keep by law. Your Stripe account is yours and isn&apos;t deleted.</li>
        <li>Encrypted backups, which are overwritten within a limited time.</li>
      </ul>
      <p>
        If you booked a detail as a client and want your information removed, email{" "}
        <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>.
      </p>
    </DocPage>
  );
}
