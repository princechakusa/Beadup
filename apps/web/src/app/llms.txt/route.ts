import { GUIDES } from "@/content/guides";
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

> Beadup is an iPhone app for solo mobile car detailers in the United States, Canada, the United Kingdom and Australia. Detailers send quotes, get booked from one link, and take deposits that cut no-shows. Their clients book in any web browser with no app and no account.

## What it does
- Booking link: every detailer gets a public page (${SITE_URL}/<handle>) where clients pick a service, vehicle size (sedan, SUV, truck), add-ons and an open time, then enter their name, phone and address.
- Deposits: every booking shows a 30% deposit. ${
    external
      ? "Clients pay it directly to the detailer through the detailer's own payment link or instructions (for example Square, PayPal, Venmo, Cash App or Zelle). Beadup never handles client money and takes no cut."
      : "Clients pay it by card at booking, plus a small booking fee that covers card processing."
  }
- AI photo quotes: the detailer takes photos of a vehicle and gets a suggested itemized quote priced only from their own price list. The detailer reviews and approves every quote. Photos are sent to ${ai} only after the detailer agrees in the app.
- Run the day: today's jobs, calendar, client list, directions, earnings by week and month, optional push alerts for new bookings, offline copy of the schedule.
- Clients can add the appointment to their calendar from the confirmation screen.

## Pricing
- Free plan: up to ${c.free_bookings_per_month} bookings a month, every feature included.
- Beadup Pro: optional monthly subscription bought in the app through the App Store, removing the booking limit. The current price is shown in the App Store and at ${SITE_URL}/pricing.

## Who it's for
Solo and small mobile car detailing businesses (mobile detailers, ceramic coating installers, mobile car wash operators) in the United States, Canada, the United Kingdom and Australia. Prices show in the detailer's own currency (USD, CAD, GBP or AUD) and clients enter local phone numbers.

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
