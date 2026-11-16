import { LANDING_SLUGS } from "@/lib/site-pages";

/**
 * Top-level SEO landing pages, one per search intent. Facts match the app today:
 * deposits are 30% and paid straight to the business, WhatsApp messages are
 * one-tap links the business sends itself, AI quotes are car-only suggestions
 * the business approves. No prices in copy (the Pro price lives in the stores).
 */
export type LandingSlug = (typeof LANDING_SLUGS)[number];

export type LandingPageContent = {
  slug: LandingSlug;
  /** <title> text (the site adds " · Beadup"). */
  title: string;
  description: string;
  h1: string;
  /** Short answer first (answer engines quote it). */
  answer: string;
  sections: { h2: string; paragraphs: string[]; bullets?: string[] }[];
  compare: { heading: string; intro: string; other: string; rows: [string, string, string][]; note: string };
  faq: [string, string][];
  related: LandingSlug[];
};

export const LANDING_PAGES: LandingPageContent[] = [
  {
    slug: "car-detailing-booking-app",
    title: "Best Booking & Quoting App for Mobile Car Detailers",
    description:
      "Beadup is a booking and quoting app for mobile car detailers: prices by vehicle size, AI photo quotes, 30% deposits paid to you and WhatsApp reminders. Free to start.",
    h1: "Best booking and quoting app for mobile car detailers",
    answer:
      "Beadup is a booking and quoting app built for mobile car detailers. You get one booking link with your prices by sedan, SUV and truck, open times only, a 30% deposit paid straight to you, AI photo quotes and one-tap WhatsApp reminders. Clients book in any browser with no app and no account. It is free to start. Beadup here means the booking app for service businesses, not a beading or craft app.",
    sections: [
      {
        h2: "What a mobile detailer needs from a booking app",
        paragraphs: [
          "A mobile detailer works alone, drives to the job and loses a slot whenever someone does not show. A useful app has to quote fast, stop double bookings and make clients commit before you drive out.",
        ],
        bullets: [
          "Prices by vehicle size, with add-ons such as pet hair removal and odor treatment",
          "Long jobs like a ceramic coating block the whole day, and travel time between jobs is respected",
          "A deposit at booking so a no-show costs the client, not you",
          "A booking page you can paste in your Instagram bio, WhatsApp status or on a van decal QR code",
        ],
      },
      {
        h2: "How Beadup works for car detailers",
        paragraphs: [
          "You pick car detailing when you sign up and Beadup loads starter services you can edit. You share your link. A client chooses a service, their vehicle size and an open time, then sees the 30% deposit and where to pay it. You get the booking in your Today screen, with the client, address and price already filled in.",
          "After the job you send a printable receipt and a rating link from the app. Reviews show as an average and a count on your booking page.",
        ],
      },
      {
        h2: "Quotes from photos",
        paragraphs: [
          "For jobs that need a look first, you can take photos of the vehicle and get a suggested quote priced only from your own price list. You review and approve every quote before it goes out. Photos go to the AI provider only after you agree in the app.",
        ],
      },
    ],
    compare: {
      heading: "Beadup compared with a general-purpose CRM or booking suite",
      intro:
        "Broad business suites are a good fit for larger teams. This is how a focused app for solo mobile detailers differs in general. Features vary by product, so check the one you are comparing.",
      other: "Typical general-purpose CRM or booking suite",
      rows: [
        ["Built for", "Solo and small mobile service businesses", "Many industries and larger teams"],
        ["Setup", "Pick your trade, edit starter services, share your link", "Often configured from scratch before the first booking"],
        ["Prices by vehicle size", "Sedan, SUV and truck prices are built in", "Usually set up with custom fields or separate services"],
        ["Photo quotes", "AI suggests a quote from your own price list, you approve it", "Not usually included"],
        ["Deposits", "30% shown on every booking, paid straight to you", "Varies; some route payments through the vendor's processor"],
        ["Client reminders", "One-tap WhatsApp or SMS messages, already written", "Varies; often email or automated SMS"],
        ["Clients need an app or account", "No, they book in a browser", "Varies"],
        ["Where you work", "iPhone app, with the booking page on the web", "Often web first"],
      ],
      note: "Beadup does not send reminders automatically: it opens WhatsApp or Messages with the text written and you press send.",
    },
    faq: [
      [
        "What is the best booking app for mobile car detailers?",
        "It depends on how you work. If you are a solo or small mobile detailer who wants prices by vehicle size, deposits and a link clients can book from without an app, Beadup is built for exactly that. Larger teams with many locations may want a broader suite.",
      ],
      ["Do my clients need to download anything?", "No. Clients book from your link in any browser, with no app and no account."],
      [
        "Can I take a deposit?",
        "Yes. Every booking shows a 30% deposit that the client pays straight to you with your own payment link or instructions. Beadup never touches the money and takes no cut.",
      ],
      ["Does it work on Android?", "Beadup is on the iPhone App Store today. Clients can book from any phone or computer. An Android version is in testing."],
      ["Is Beadup the same as a beading or craft app?", "No. Beadup is a booking app for service businesses such as car detailers, salons, barbers and groomers."],
    ],
    related: ["ai-detailing-quote-calculator", "booking-link-with-deposits"],
  },
  {
    slug: "ai-detailing-quote-calculator",
    title: "AI Photo Quote Generator for Auto Detailers",
    description:
      "Take photos of a car and get a suggested quote priced from your own price list. You approve every quote. AI photo quotes for auto detailers in the Beadup app.",
    h1: "AI photo quote generator for auto detailers",
    answer:
      "Beadup's AI photo quote turns photos of a vehicle into a suggested, itemized quote for an auto detailer. The AI only picks services from your own price list and the app prices them from your numbers, so it never invents a price. You review and approve every quote before the client sees it. It is available for car detailing, and photos are sent to the AI provider only after you agree in the app.",
    sections: [
      {
        h2: "How the AI photo quote works",
        paragraphs: [
          "Pick photos of the vehicle from your camera roll or take them in the app. Beadup removes location data from the photos, checks that they show a vehicle, and asks the AI which of your services and add-ons the car needs, for example a full detail plus pet hair removal.",
          "The server then prices the quote from your own prices for that vehicle size. The AI chooses items, it does not set prices. You see an itemized draft, change anything you like and send it when you are happy.",
        ],
      },
      {
        h2: "What it is and what it is not",
        paragraphs: ["It is a fast first draft, not a guarantee of the final job. A photo cannot show everything, so treat the result as a starting point for your own judgment."],
        bullets: [
          "It uses your price list, not a market average",
          "Photos that do not show a vehicle are rejected",
          "You approve every quote; nothing is sent to a client automatically",
          "The AI scan is for car detailing. Other trades use fixed or tiered prices",
        ],
      },
      {
        h2: "From quote to booked",
        paragraphs: ["Once the client accepts, they book from your booking link, pick an open time and the booking carries a 30% deposit that is paid straight to you."],
      },
    ],
    compare: {
      heading: "AI photo quote compared with quoting by hand or with a generic calculator",
      intro:
        "A general quote calculator or template works if your jobs are simple. Here is how a photo quote differs in general. Check the specific tool you are comparing.",
      other: "Manual quote or generic calculator",
      rows: [
        ["Starting point", "Photos of the actual vehicle", "Your memory, a form or a message thread"],
        ["Prices from", "Your own price list, by vehicle size", "Whatever you type or a template you built"],
        ["Itemized", "Yes, services and add-ons listed", "Depends on your template"],
        ["Who decides", "You approve every quote", "You"],
        ["Time per quote", "A few taps after the photos", "Depends on how much typing and checking you do"],
        ["Then booking", "Client books from your link with a 30% deposit", "Usually a separate step"],
      ],
      note: "AI suggestions can be wrong. Always read the draft before you send it.",
    },
    faq: [
      ["Does the AI set my prices?", "No. The AI only chooses items from your own price list. The prices come from the numbers you entered in the app."],
      [
        "Are photos sent to an AI company?",
        "Only the photos you choose, and only after you agree to the AI consent screen in the app. Location data is removed from photos first.",
      ],
      [
        "Does it work for trades other than car detailing?",
        "The AI photo scan is for vehicles. Barbers, salons, groomers and the other trades use their own fixed or tiered prices on the booking link.",
      ],
      ["Do I have to send the quote the AI makes?", "No. It is a draft. You can edit it, and nothing reaches a client until you approve it."],
      ["Is the AI photo quote free?", "The free plan includes every feature up to a monthly booking limit. Beadup Pro, bought in the app, removes the limit."],
    ],
    related: ["car-detailing-booking-app", "booking-link-with-deposits"],
  },
  {
    slug: "booking-link-with-deposits",
    title: "Booking Link with 30% Deposits & WhatsApp Reminders",
    description:
      "A booking link for appointment businesses: clients pick a service and time in a browser, see a 30% deposit paid straight to you, and you remind them on WhatsApp in one tap.",
    h1: "A booking link with 30% deposits and WhatsApp reminders",
    answer:
      "Beadup gives your appointment business one booking link. Clients choose a service and an open time in any browser, with no app and no account. Each booking shows a 30% deposit that the client pays straight to you, and the app writes your WhatsApp confirmations, day-before reminders and receipts so you send them in one tap. It works for detailers, salons, barbers, groomers, cleaners, mechanics and more.",
    sections: [
      {
        h2: "How the booking link works",
        paragraphs: [
          "Your link looks like beadup.app/yourname. It shows your photo, services with prices, recent work and the times you are free. Beadup blocks times that overlap another booking, a day off or your travel time, so clients can only pick what you can actually do.",
        ],
        bullets: [
          "Works in any browser, nothing to install, no account for the client",
          "Shown in the client's language",
          "Businesses where clients visit you skip the address question",
          "Add to calendar button on the confirmation",
        ],
      },
      {
        h2: "Deposits that cut no-shows",
        paragraphs: [
          "Every booking shows a 30% deposit. The client pays it straight to you using your own payment link or instructions, for example PayPal, Venmo, Square, Cash App, Zelle or a bank transfer. Beadup never handles the money and takes no cut. The client can tell you they have sent it and you confirm when it arrives.",
        ],
      },
      {
        h2: "WhatsApp reminders in one tap",
        paragraphs: [
          "The app has ready-written messages to confirm a booking, remind the client the day before and say you are on your way. Tapping one opens WhatsApp (or your Messages app) with the text filled in and the client's number ready. You press send. There is no WhatsApp Business API and no extra fee, and nothing is sent automatically.",
        ],
      },
    ],
    compare: {
      heading: "Beadup compared with a general-purpose scheduling suite",
      intro: "Scheduling suites cover a lot. This is how a simple booking link for solo businesses differs in general. Details vary by product.",
      other: "Typical general-purpose scheduling suite",
      rows: [
        ["Built for", "One-person and small appointment businesses", "Teams, multiple locations and many industries"],
        ["Deposit", "30% on every booking, paid straight to you", "Varies; often needs a payment processor set up first"],
        ["Where the money goes", "To you, through your own payment link", "Varies by product"],
        ["WhatsApp", "One-tap messages written for you", "Varies; often email or SMS"],
        ["Client account or app", "Not needed", "Varies"],
        ["Trade-specific setup", "13 trades with starter services and the right wording", "Usually generic"],
        ["Double-booking protection", "Yes, with travel time between jobs", "Varies"],
      ],
      note: "Beadup sends WhatsApp and SMS messages from your own phone. It does not send automated reminders.",
    },
    faq: [
      ["How do clients pay the deposit?", "After they book, the confirmation shows your payment link or instructions. They pay you directly and can tell you it is sent. You mark it received in the app."],
      ["Does Beadup take a cut of my deposits?", "No. Beadup never handles the money and takes no cut of your bookings."],
      ["Are the WhatsApp reminders automatic?", "No. Beadup writes the message and opens WhatsApp with it ready, and you press send. There is no WhatsApp Business API and no extra cost."],
      ["Can clients cancel or change a booking?", "Clients get a private booking page where they can ask for a new time or ask to cancel. You approve the change in the app."],
      [
        "What kinds of businesses can use it?",
        "Car, boat and RV detailers, hair salons, barbers, nail and beauty technicians, makeup artists, pet groomers, house and window cleaners, pressure washers, mechanics and handymen.",
      ],
    ],
    related: ["car-detailing-booking-app", "ai-detailing-quote-calculator"],
  },
];

export const landingPage = (slug: string) => LANDING_PAGES.find((p) => p.slug === slug);
