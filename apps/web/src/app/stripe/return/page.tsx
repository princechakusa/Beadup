import type { Metadata } from "next";
import { BeadLogo } from "@/components/BeadLogo";

export const metadata: Metadata = { title: "Payments setup", robots: { index: false, follow: false } };

// Stripe sends detailers here after Connect onboarding. Status is synced by
// the account.updated webhook, so this page only needs to send them back.
export default function StripeReturnPage() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col items-center justify-center px-5 text-center">
      <BeadLogo size={56} />
      <h1 className="mt-6 font-display text-3xl font-extrabold">Back to Beadup</h1>
      <p className="mt-3 text-[15px] leading-relaxed text-steel">
        Your payment details are saved with Stripe. Return to the Beadup app to finish setting up. If Stripe asked for more
        information, you can continue from Settings, Payments.
      </p>
    </main>
  );
}
