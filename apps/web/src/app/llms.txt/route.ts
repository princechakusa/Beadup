import { GUIDES } from "@/content/guides";
import { TRADE_PAGES } from "@/content/trade-pages";
import { SITE_URL } from "@/lib/seo";
import { getPublicConfig } from "@/lib/site";

/**
 * /llms.txt: a plain-text summary for AI assistants and answer engines
 * (llmstxt.org). Facts only, kept in step with the app and plan_config.
 */
export async function GET() {
  const c = await getPublicConfig();
  const external = c.payments_mode === "external";
  const ai = c.ai_provider === "anthropic" ? "Anthropic" : "OpenAI";
  const text = `# Beadup

> Beadup is an iPhone app and booking link for solo and small appointment businesses: car, boat and RV detailers, hair salons and braiders, barbers, nail and beauty technicians, makeup artists, pet groomers, house and window cleaners, pressure washers, mobile mechanics and handymen. It works in the United States, Canada, the United Kingdom, Australia, New Zealand, the United Arab Emirates, South Africa and Singapore. Clients book in any web browser with no app and no account.

## What it does
- Trades: the business picks its trade at sign-up. Beadup then uses that trade's words, starter services and pricing: by size (vehicle, boat length, dog size, home size, job size) or one price per service.
- Booking link: every business gets a public page (${SITE_URL}/<handle>) with its photo, services (each can have a photo, for example a hairstyle), prices, recent work and open times. Clients pick a service, extras and a time. Businesses where clients come to them don't ask for an address.
- Deposits: every booking shows a 30% deposit. ${
    external
      ? "Clients pay it directly to the business through its own payment link or instructions (for example PayPal, Venmo, Square, Cash App, Zelle or a bank transfer). Beadup never handles client money and takes no cut. Clients can tell the business they've sent it; the business confirms receipt."
      : "Clients pay it by card at booking, plus a small booking fee that covers card processing."
  }
- WhatsApp: booking pages, confirmations and receipts have WhatsApp buttons with the message written in. The app has one-tap WhatsApp or SMS templates to confirm, remind the day before and say "on my way". No WhatsApp Business API or fees.
- Client self-service: each client gets a private booking page to see the booking, pay the deposit, ask for a new time or ask to cancel.
- After the job: a printable receipt and a rating link in one message.
- Scheduling: no overlapping bookings, travel time between jobs, days off, rescheduling.
- AI photo quotes (car detailing): photos of a vehicle give a suggested quote priced only from the business's own price list; the business approves every quote. Photos go to ${ai} only after the business agrees in the app.

## Pricing
- Free plan: up to ${c.free_bookings_per_month} bookings a month, every feature included.
- Beadup Pro: optional monthly subscription bought in the app through the App Store, removing the booking limit. The current price is shown in the App Store and at ${SITE_URL}/pricing.

## Who it's for
${TRADE_PAGES.map((t) => `- [${t.title}](${SITE_URL}/for/${t.slug}): ${t.answer}`).join("\n")}

Prices show in the business's own currency (USD, CAD, GBP, AUD, NZD, AED, ZAR or SGD) and clients enter local phone numbers.

## Key pages
- [Home](${SITE_URL}/)
- [Pricing](${SITE_URL}/pricing)
- [Support and FAQ](${SITE_URL}/support)
- [Privacy policy](${SITE_URL}/privacy)
- [Sample booking page](${SITE_URL}/beadup-demo-detailing)${process.env.NEXT_PUBLIC_APP_STORE_URL ? `\n- [Beadup on the App Store](${process.env.NEXT_PUBLIC_APP_STORE_URL})` : ""}

## Guides
${GUIDES.map((g) => `- [${g.title}](${SITE_URL}/blog/${g.slug}): ${g.answer}`).join("\n")}
`;
  return new Response(text, {
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "public, max-age=3600" },
  });
}
