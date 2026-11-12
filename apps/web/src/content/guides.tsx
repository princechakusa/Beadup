import Link from "next/link";
import type { ReactNode } from "react";
import { H2 } from "@/components/site/SiteChrome";

/**
 * Long-form guides for appointment businesses (/blog/<slug>). Written to answer the
 * questions detailers actually search for and ask AI assistants, in plain
 * words, with no invented statistics. Each guide carries its own short FAQ,
 * which is also published as FAQPage structured data.
 */
export type Guide = {
  slug: string;
  title: string;
  /** Meta description and card text, under ~160 characters. */
  description: string;
  /** One-paragraph direct answer shown first (what answer engines quote). */
  answer: string;
  published: string; // YYYY-MM-DD
  updated: string; // YYYY-MM-DD
  readMin: number;
  toc: string[];
  body: ReactNode;
  faq: [string, string][];
};

const A = ({ href, children }: { href: string; children: ReactNode }) => <Link href={href}>{children}</Link>;

export const GUIDES: Guide[] = [
  {
    slug: "how-to-take-deposits-mobile-detailing",
    title: "How to take deposits as a mobile detailer",
    description:
      "A simple deposit policy for mobile car detailing: how much to ask, when to take it, what to say, and how to collect it without card fees eating your margin.",
    answer:
      "Ask for a deposit of around 30% of the job when the client books, collected through a payment link (Square, PayPal, Venmo, Cash App or Zelle) and explained in one sentence on your booking page. Make it count toward the final price, refundable if they cancel with 24 hours' notice, and kept if they don't show.",
    published: "2026-11-09",
    updated: "2026-11-09",
    readMin: 5,
    toc: ["Why deposits matter for mobile detailers", "How much to ask for", "When to take it", "How to collect it", "What to say to clients", "Your cancellation policy"],
    body: (
      <>
        <H2>Why deposits matter for mobile detailers</H2>
        <p>
          A shop can fill a no-show slot with a walk-in. A mobile detailer can&apos;t. You have already loaded the van,
          bought product and driven across town, and a client who isn&apos;t home costs you the whole block of time. A
          deposit turns a casual &quot;sure, Saturday works&quot; into a real commitment, and it filters out people who were
          never going to book.
        </p>
        <H2>How much to ask for</H2>
        <p>
          Most detailers land between 20% and 50%. A good default is <strong>30%</strong>: high enough that people show
          up, low enough that it doesn&apos;t scare off a first-time client. For big jobs like paint correction or ceramic
          coating, where you may buy product for that car, a higher deposit or a fixed amount is fair.
        </p>
        <ul>
          <li>Maintenance wash or interior refresh: 30%, or a flat $25 to $40.</li>
          <li>Full detail: 30%.</li>
          <li>Ceramic coating or correction: 30% to 50%, stated up front.</li>
        </ul>
        <H2>When to take it</H2>
        <p>
          At the moment of booking, not the night before. The client is most motivated right after they pick a time.
          Hold the slot for a short window (30 minutes to a few hours) and release it if the deposit doesn&apos;t arrive.
        </p>
        <H2>How to collect it</H2>
        <p>
          You don&apos;t need a merchant account to start. A payment link from Square, PayPal, Venmo Business or Cash App,
          or plain Zelle instructions, works fine. What matters is that the client sees it right after they book, with the
          exact amount, so there is nothing to work out.
        </p>
        <p>
          In <A href="/">Beadup</A>, you add your payment link or instructions once in Settings. Every booking then shows
          the 30% deposit and a &quot;Pay deposit&quot; button straight to your link. The money goes to you directly, and
          Beadup takes no cut. When it arrives, you tap &quot;Deposit received&quot; on the job.
        </p>
        <H2>What to say to clients</H2>
        <p>Keep it short and confident. People accept deposits when they sound normal, not apologetic:</p>
        <blockquote>
          &quot;A 30% deposit holds your time. It comes off your total, and it&apos;s refundable if you cancel at least 24
          hours before.&quot;
        </blockquote>
        <H2>Your cancellation policy</H2>
        <p>Write it once and use it everywhere: your booking page, your Instagram highlights and your replies.</p>
        <ul>
          <li>Cancel or reschedule 24+ hours before: full refund or move the deposit to the new date.</li>
          <li>Less than 24 hours, or not home: the deposit is kept.</li>
          <li>Weather on an outdoor job: you reschedule, and the deposit carries over.</li>
        </ul>
      </>
    ),
    faq: [
      ["Is it normal for mobile detailers to charge a deposit?", "Yes. Many mobile detailers take a deposit at booking, usually 20% to 50%, because a no-show costs them travel time and a whole block of the day."],
      ["Should the deposit be refundable?", "Make it refundable or transferable if the client cancels with reasonable notice, often 24 hours, and non-refundable for late cancellations and no-shows."],
      ["Do I need Stripe to take deposits?", "No. A payment link from Square, PayPal, Venmo, Cash App or Zelle instructions is enough. Beadup shows your link to the client right after they book."],
    ],
  },
  {
    slug: "how-to-price-mobile-car-detailing",
    title: "How to price mobile car detailing",
    description:
      "A step-by-step way to set mobile detailing prices from your own costs and time: hourly target, product cost, travel, vehicle size and add-ons.",
    answer:
      "Price each service from your time, not from guesses: pick the hourly amount you need to earn, multiply by how long the job really takes for that vehicle size, add product and travel cost, then round to a clean number. Charge more for SUVs and trucks, and sell extras like pet hair removal as add-ons.",
    published: "2026-11-09",
    updated: "2026-11-09",
    readMin: 6,
    toc: ["Start from the hourly amount you need", "Time each service honestly", "Add product and travel", "Price by vehicle size", "Use add-ons for the messy extras", "Quote fast, then stick to it"],
    body: (
      <>
        <H2>Start from the hourly amount you need</H2>
        <p>
          Work out what you need to earn per working hour after costs: your monthly bills and goals divided by the hours
          you can actually spend on cars (not driving, not texting clients). That number is your floor. If a price works
          out below it, it&apos;s a hobby, not a business.
        </p>
        <H2>Time each service honestly</H2>
        <p>
          Time your last few jobs of each type, from setting up to packing away. Mobile work has setup time a shop
          doesn&apos;t, such as water, power and moving the van, so include it.
        </p>
        <H2>Add product and travel</H2>
        <p>
          Add the product you use per car (chemicals, towels, pads, coating) and a travel allowance. Many detailers set a
          service area and add a small fee beyond it rather than baking long drives into every price.
        </p>
        <p className="font-mono text-[14px]">
          price = (hours × hourly target) + product + travel, then round up to a clean number
        </p>
        <p>
          Example: a full interior on a sedan takes 2.5 hours. At a $60 hourly target that&apos;s $150, plus $12 of
          product, plus $8 of travel, which is $170. Round to $175.
        </p>
        <H2>Price by vehicle size</H2>
        <p>
          Bigger vehicles take longer, so price by size: sedan or coupe, SUV or crossover, and truck or van. A simple
          approach is to re-run the formula with each size&apos;s real time. Clients understand size pricing and it stops
          you from losing money on a third-row SUV.
        </p>
        <H2>Use add-ons for the messy extras</H2>
        <p>
          Pet hair, heavy stains, odor treatment and engine bays vary wildly from car to car. Keep them out of the base
          price and sell them as add-ons. The base price stays competitive and the hard jobs pay what they cost you.
        </p>
        <H2>Quote fast, then stick to it</H2>
        <p>
          Clients book whoever answers first with a clear number. In <A href="/">Beadup</A> you set your prices by vehicle
          size once, and the AI photo quote suggests an itemized price from those prices only. You review and approve it
          before it&apos;s sent. Clients who book from your link see the same prices, so there&apos;s no back-and-forth.
        </p>
      </>
    ),
    faq: [
      ["How do I calculate a price for a detail?", "Multiply the real hours for that vehicle size by your hourly target, add product and travel cost, then round up to a clean number."],
      ["Should SUVs and trucks cost more to detail?", "Yes. They take longer and use more product, so most detailers have separate prices for sedans, SUVs and trucks or vans."],
      ["Can an app quote a detail from photos?", "Beadup suggests a quote from vehicle photos, priced only from your own price list. You always review and approve it before the client sees it."],
    ],
  },
  {
    slug: "how-to-reduce-no-shows-mobile-detailing",
    title: "How to stop no-shows in your mobile detailing business",
    description:
      "Practical ways mobile detailers cut no-shows and last-minute cancellations: deposits, clear booking details, calendar invites and a written policy.",
    answer:
      "Take a deposit when the client books, confirm the exact time and address in writing, give them a calendar invite, and publish a 24-hour cancellation policy. Most no-shows come from clients who never fully committed or simply forgot, and those four steps fix both.",
    published: "2026-11-09",
    updated: "2026-11-09",
    readMin: 4,
    toc: ["Why clients no-show", "Take a deposit at booking", "Confirm the details in writing", "Get it into their calendar", "Publish your policy", "Make rebooking easy"],
    body: (
      <>
        <H2>Why clients no-show</H2>
        <p>
          It&apos;s rarely malice. They booked in a DM without really committing, they forgot, or the car was at work that
          day. Fix commitment and memory, and most no-shows disappear.
        </p>
        <H2>Take a deposit at booking</H2>
        <p>
          A deposit is the single strongest signal of intent. See <A href="/blog/how-to-take-deposits-mobile-detailing">how to take
          deposits as a mobile detailer</A> for amounts and wording.
        </p>
        <H2>Confirm the details in writing</H2>
        <p>
          DMs bury details. A booking page collects the service, vehicle size, time, address and phone number in one place,
          so both of you see the same thing. It also tells you where the car will be before you drive there.
        </p>
        <H2>Get it into their calendar</H2>
        <p>
          People forget appointments that only live in a chat thread. In Beadup, the confirmation screen has an
          &quot;Add to calendar&quot; button so the job sits in the client&apos;s own calendar with the time and address.
        </p>
        <H2>Publish your policy</H2>
        <p>
          State it on your booking page and in your Instagram highlights: cancel 24 hours ahead to keep your deposit, late
          cancellations and no-shows forfeit it. When it&apos;s written down, enforcing it feels fair instead of personal.
        </p>
        <H2>Make rebooking easy</H2>
        <p>
          When someone does cancel properly, send them your booking link right away. A client who reschedules in the same
          conversation is a client you keep.
        </p>
      </>
    ),
    faq: [
      ["What is the best way to stop no-shows for detailing?", "Take a deposit at booking, confirm the time and address in writing, add the job to the client's calendar, and publish a 24-hour cancellation policy."],
      ["Should I charge a no-show fee?", "Keeping the deposit is the simplest no-show fee: it's already paid, so there is nothing to chase."],
    ],
  },
  {
    slug: "instagram-booking-link-for-detailers",
    title: "How to get detailing bookings from Instagram",
    description:
      "Turn Instagram followers into booked jobs: a booking link in your bio, posts that sell, replies that close, and a QR code on the van.",
    answer:
      "Put a booking link in your Instagram bio that lets people pick a service, vehicle size and time without messaging you, then point every post, story and DM reply at it. Clients who can see prices and open times book faster than ones who have to ask \"how much?\" and wait.",
    published: "2026-11-09",
    updated: "2026-11-09",
    readMin: 5,
    toc: ["Put a real booking link in your bio", "Post work that shows the result", "Reply to DMs with the link", "Use stories and highlights", "Take it offline with a QR code"],
    body: (
      <>
        <H2>Put a real booking link in your bio</H2>
        <p>
          &quot;DM to book&quot; makes every client start a conversation and wait for you. A booking link lets them see your
          services and prices and pick an open time, even at 11pm when you&apos;re asleep. With Beadup, your link ends in your own name
          (for example <code>/yourname</code>), and clients book in their browser with no app or account.
        </p>
        <H2>Post work that shows the result</H2>
        <ul>
          <li>Before and after, same angle, same light.</li>
          <li>Short videos: water beading on fresh coating, pet hair coming out, a foam pass.</li>
          <li>Always end the caption with the service name and &quot;book from the link in bio&quot;.</li>
        </ul>
        <H2>Reply to DMs with the link</H2>
        <p>Answer the question, then hand over the link so the client can choose a time themselves:</p>
        <blockquote>
          &quot;A full interior on an SUV is $220. You can see my open times and book here: [link]. A 30% deposit holds your
          spot.&quot;
        </blockquote>
        <H2>Use stories and highlights</H2>
        <p>
          Add a link sticker to stories when you have openings this week, and keep highlights for prices, reviews and your
          policy. New followers check highlights before they book.
        </p>
        <H2>Take it offline with a QR code</H2>
        <p>
          Put a QR code for your booking link on the van, business cards and a flyer you leave with neighbors after a job.
          Beadup shows a QR code for your link in the app, ready to scan from someone else&apos;s phone.
        </p>
      </>
    ),
    faq: [
      ["What link should a detailer put in their Instagram bio?", "A booking link where clients can pick a service, vehicle size and time without messaging you. Beadup gives every detailer one for free."],
      ["Do clients need an app to book a detailer from Instagram?", "Not with Beadup. Clients book from the link in any browser, with no download and no account."],
    ],
  },
  {
    slug: "stop-no-shows-hair-salon-braiding",
    title: "How hair salons and braiders can stop no-shows",
    description:
      "Long braiding and styling appointments lose the most when a client doesn't come. A deposit, clear photos with prices and a reminder the day before fix most of it.",
    answer:
      "Show every style with a photo and one clear price, take a deposit (around 30%) when the client books, and send a reminder the day before. Clients who have paid something and know exactly what they're getting turn up; the ones who wouldn't have usually don't book at all.",
    published: "2026-11-12",
    updated: "2026-11-12",
    readMin: 4,
    toc: ["Why salons feel no-shows most", "Photos and prices remove the back-and-forth", "Take a deposit", "Remind the day before", "A cancellation rule clients accept"],
    body: (
      <>
        <H2>Why salons feel no-shows most</H2>
        <p>
          A braiding appointment can hold your chair for four to eight hours. When that client doesn&apos;t arrive, the whole day is
          gone and it&apos;s too late to fill it.
        </p>
        <H2>Photos and prices remove the back-and-forth</H2>
        <p>
          Most booking messages are &quot;how much for this?&quot; with a screenshot. List each style with your own photo, its price and
          how long it takes. Clients pick the look they want and book it, and you both agree on the job before the day.
        </p>
        <H2>Take a deposit</H2>
        <p>
          Ask for a deposit when the client books, paid to you with your payment link or bank details. Make it part of the final
          price. On Beadup the booking page shows the deposit and how to pay it, and you mark it received in the app.
        </p>
        <H2>Remind the day before</H2>
        <p>
          A short WhatsApp message the day before (&quot;See you tomorrow at 10:00&quot;) catches clients who forgot. Beadup lists
          tomorrow&apos;s clients on your Today screen with the reminder already written.
        </p>
        <H2>A cancellation rule clients accept</H2>
        <p>
          Keep it simple: the deposit comes back if they cancel at least 24 hours before, and it&apos;s kept if they don&apos;t
          show. Say it once on your booking page. See <A href="/for/hair-salons">Beadup for hair salons</A>.
        </p>
      </>
    ),
    faq: [
      ["How much deposit should a salon take?", "Around 30% of the price is common: enough that clients take the time seriously, small enough not to put them off."],
      ["Can clients book a style from its photo?", "Yes. On Beadup each style shows its own photo and price, and the client taps it to book."],
    ],
  },
  {
    slug: "barber-booking-link-whatsapp",
    title: "A booking link for barbers that works with WhatsApp",
    description:
      "Stop answering \"any slots today?\" all day. Put one booking link in your bio and WhatsApp status, and keep WhatsApp for the chat.",
    answer:
      "Put one booking link in your Instagram bio and WhatsApp status. Clients see your cuts, prices and open times and book in a minute, with no app. You keep WhatsApp for questions and reminders, and your chair stops being double-booked.",
    published: "2026-11-12",
    updated: "2026-11-12",
    readMin: 3,
    toc: ["The problem with booking by message", "One link, open times only", "Keep WhatsApp for the chat", "Fill quiet hours"],
    body: (
      <>
        <H2>The problem with booking by message</H2>
        <p>Every &quot;any slots today?&quot; message takes you away from the client in your chair, and two people can be promised the same time.</p>
        <H2>One link, open times only</H2>
        <p>
          A booking link shows only the times you&apos;re actually free, so nobody gets the same slot. With a team, clients choose a
          barber or &quot;anyone&quot;.
        </p>
        <H2>Keep WhatsApp for the chat</H2>
        <p>
          Clients still message you on WhatsApp; Beadup puts a WhatsApp button on your page and writes the confirmation and
          reminder for you. See <A href="/for/barbers">Beadup for barbers</A>.
        </p>
        <H2>Fill quiet hours</H2>
        <p>Share your link in your status on slow mornings. Regulars who are due for a cut show up on your Today screen.</p>
      </>
    ),
    faq: [
      ["Do my clients need an app?", "No. They book in any browser from your link."],
      ["Can I still take walk-ins?", "Yes. Only open the times you want booked online and keep the rest for walk-ins."],
    ],
  },
  {
    slug: "mobile-mechanic-booking-without-phone-tag",
    title: "How mobile mechanics can book jobs without phone tag",
    description:
      "Fixed-price services, the right time blocked for each job, a deposit, and an \"on my way\" message: book mobile mechanic jobs without calls.",
    answer:
      "List your common jobs with a fixed price and how long they take, share one booking link, and take a deposit at booking. The job length blocks your calendar correctly, and an \"on my way\" message means the customer is home when you arrive.",
    published: "2026-11-12",
    updated: "2026-11-12",
    readMin: 3,
    toc: ["Fixed prices for common jobs", "Block the right amount of time", "Make sure they're home"],
    body: (
      <>
        <H2>Fixed prices for common jobs</H2>
        <p>Oil changes, diagnostics and brake pads are easy to price up front. Bigger jobs can start as a diagnostic booking.</p>
        <H2>Block the right amount of time</H2>
        <p>Each service carries its own length, so a two-hour job never gets a second booking in the middle of it, plus your travel time.</p>
        <H2>Make sure they&apos;re home</H2>
        <p>
          A reminder the day before and an &quot;on my way&quot; message from the app cut wasted trips. See{" "}
          <A href="/for/mobile-mechanics">Beadup for mobile mechanics</A>.
        </p>
      </>
    ),
    faq: [["Do I need photos?", "No. Photos are optional; most mechanics list services with a price only."]],
  },
  {
    slug: "price-house-cleaning-by-home-size",
    title: "How to price house cleaning by home size",
    description:
      "Price cleans by bedrooms instead of guessing on every message: standard, deep and move-out cleans, extras, and a deposit that holds the slot.",
    answer:
      "Set three home sizes (for example 1 to 2, 3 and 4+ bedrooms) and a price for each clean at each size, add extras like the oven or fridge, and let clients pick their size when they book. They see the exact price before booking, and you stop quoting every home by message.",
    published: "2026-11-12",
    updated: "2026-11-12",
    readMin: 3,
    toc: ["Why price by size", "Extras, not surprises", "Hold the slot with a deposit"],
    body: (
      <>
        <H2>Why price by size</H2>
        <p>Bedrooms are a fair stand-in for time. Clients understand it, and you can set how long each size usually takes.</p>
        <H2>Extras, not surprises</H2>
        <p>Inside the oven, fridge or laundry are add-ons the client ticks, so the total is clear before you arrive.</p>
        <H2>Hold the slot with a deposit</H2>
        <p>
          A deposit at booking keeps last-minute cancellations rare. See <A href="/for/house-cleaners">Beadup for house cleaners</A>.
        </p>
      </>
    ),
    faq: [["Can I offer regular weekly cleans?", "Yes. From the app you can book a client in every week, every 2 or every 4 weeks."]],
  },
];

export function getGuide(slug: string) {
  return GUIDES.find((g) => g.slug === slug) ?? null;
}
