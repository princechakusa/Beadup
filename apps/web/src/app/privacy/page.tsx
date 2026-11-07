import type { Metadata } from "next";
import Link from "next/link";
import { DocPage } from "@/components/site/SiteChrome";
import { getPublicConfig, LEGAL_NAME, SUPPORT_EMAIL } from "@/lib/site";

export const metadata: Metadata = { title: "Privacy policy" };

// Written to match what the code actually does (see docs/store-submission.md
// for the store privacy answers). Have it reviewed by a lawyer before launch,
// and update it whenever data use changes (rules.md section 3).
export default async function Privacy() {
  const { ai_provider, payments_mode } = await getPublicConfig();
  const external = payments_mode === "external";
  const ai = ai_provider === "anthropic" ? "Anthropic" : "OpenAI";
  return (
    <DocPage title="Privacy policy" updated="November 7, 2026">
      <p>
        Beadup is an app for mobile car detailers to quote jobs, take bookings and get paid. This policy explains what
        information {LEGAL_NAME} (&quot;Beadup&quot;, &quot;we&quot;) collects, why, who we share it with and the choices
        you have. It covers detailers who use the Beadup app and their clients who book through a Beadup booking link.
      </p>
      <p>
        Questions: <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>.
      </p>

      <h2>What we collect</h2>
      <p>
        <strong>From detailers</strong>
      </p>
      <ul>
        <li>Account details: your email address, and your name if you sign in with Apple and choose to share it.</li>
        <li>Your business profile: business name, booking link, service area, timezone, services, prices and hours.</li>
        <li>Your clients, bookings, quotes and payment records inside Beadup.</li>
        <li>Vehicle photos you add to a quote, and the AI suggestion made from them, if you use AI photo quotes.</li>
        <li>A push notification token for your device, only if you turn on booking alerts.</li>
        {external ? (
          <li>The payment link or payment instructions you choose to show clients after they book.</li>
        ) : (
          <li>Your Stripe account identifier, so payments reach your Stripe account. Beadup does not store your bank details.</li>
        )}
      </ul>
      <p>
        <strong>From clients who book</strong>
      </p>
      <ul>
        <li>Your name, mobile number and the address where the vehicle will be.</li>
        <li>The service, vehicle size, time and price of your booking.</li>
        {!external && <li>Your email address, if you enter it at checkout, so we can send your receipt.</li>}
        <li>Whether you agreed to receive text messages, the exact wording you agreed to and when, and any opt-out.</li>
        <li>A rating and comment, if you choose to leave a review.</li>
      </ul>
      {external ? (
        <p>
          <strong>Payments</strong> are made by clients directly to their detailer, outside Beadup. Beadup never receives
          card or bank details.
        </p>
      ) : (
        <p>
          <strong>Card details</strong> are entered on Stripe&apos;s secure checkout and are never received or stored by
          Beadup.
        </p>
      )}
      <p>
        <strong>Security data:</strong> to prevent abuse we keep a one-way scrambled version of your IP address for a
        short time to limit repeated requests, and booking pages use Cloudflare Turnstile to check for automated bots.
      </p>

      <h2>How we use it</h2>
      <ul>
        <li>To run the service: booking pages, scheduling, quotes, payments, receipts and reminders.</li>
        <li>To send booking texts to clients who agreed to receive them. Reply STOP to any text to opt out.</li>
        <li>To suggest a quote from vehicle photos, only after the detailer has agreed to AI photo quotes.</li>
        <li>To keep accounts and payments secure and to prevent fraud and abuse.</li>
        <li>To meet legal obligations.</li>
      </ul>
      <p>
        We do not sell personal information, show ads, or track you across other companies&apos; apps or websites.
      </p>

      <h2>Who we share it with</h2>
      <p>We share information only with the service providers that run parts of Beadup, and only what they need:</p>
      <ul>
        {!external && (
          <li>
            <strong>Stripe</strong> processes payments and payouts. Detailers are Stripe account holders and Stripe&apos;s own
            terms and privacy policy apply to them.
          </li>
        )}
        <li>
          <strong>Twilio</strong> delivers text messages, when Beadup sends them. Text messages are not in use yet; we
          will update this policy before they are.
        </li>
        <li>
          <strong>{ai}</strong> provides the AI model that suggests quotes. Vehicle photos and the detailer&apos;s
          service list are sent to {ai} only after the detailer turns on AI photo quotes{ai === "OpenAI" ? ", with storage of the request turned off" : ""}.
        </li>
        <li>
          <strong>Supabase</strong> hosts our database, sign-in and private photo storage.
        </li>
        <li>
          <strong>Expo</strong> delivers push notifications to detailers who turn on booking alerts.
        </li>
        <li>
          <strong>Cloudflare</strong> provides bot protection on booking pages.
        </li>
        <li>Our website hosting provider.</li>
      </ul>
      <p>
        When a client books, their booking details are shared with the detailer they booked. We may also disclose
        information if the law requires it.
      </p>

      <h2>How long we keep it</h2>
      <p>
        We keep account information for as long as the account is open. When a detailer deletes their account, we delete
        their profile, clients, bookings, quotes, photos and messages from Beadup. We keep a short security record that an
        account was deleted, without personal details.{" "}
        {!external && "Stripe and the card networks keep payment records they are required to keep by law. "}Deleted data can remain in encrypted backups for a limited time before it is overwritten.
      </p>

      <h2>Your choices and rights</h2>
      <ul>
        <li>Detailers can delete their account in the app under Settings, Delete account, or from our <Link href="/delete-account">account deletion page</Link>.</li>
        <li>Detailers can turn off AI photo quotes and booking alerts in Settings at any time.</li>
        <li>Clients can reply STOP to any text to stop messages, and can ask the detailer or us to access, correct or delete their information.</li>
        <li>
          Depending on where you live, including California, you may have the right to know, access, correct or delete
          your personal information. Email <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>; we will not treat you
          differently for asking.
        </li>
      </ul>

      <h2>Security</h2>
      <p>
        Information is encrypted in transit. Each detailer can only access their own data, enforced in our database.
        Photos are stored privately. Card numbers never touch our servers.
      </p>

      <h2>Children</h2>
      <p>Beadup is for businesses and their customers and is not directed to children under 13.</p>

      <h2>Changes</h2>
      <p>
        If we change this policy we will update the date above, and tell detailers in the app when the change is
        significant.
      </p>
    </DocPage>
  );
}
