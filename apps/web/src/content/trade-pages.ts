import type { TradeId } from "@/lib/trades";

/**
 * One landing page per trade at /for/<slug>: what each kind of business
 * searches for ("booking app for barbers"), answered first, then specifics.
 * Example prices are in US dollars and labelled as examples.
 */
export type TradePage = {
  slug: string;
  trade: TradeId;
  /** <title> and H1 keyword phrase. */
  title: string;
  h1: string;
  description: string;
  /** Short answer first (answer engines quote it). */
  answer: string;
  pains: string[];
  fits: string[];
  examples: { name: string; price: string }[];
  faq: [string, string][];
};

const NO_APP = "Clients book from your link in any browser, with no app and no account.";

export const TRADE_PAGES: TradePage[] = [
  {
    slug: "car-detailers",
    trade: "detailing",
    title: "Booking app for mobile car detailers",
    h1: "The booking link for mobile car detailers",
    description: "Prices by vehicle size, AI photo quotes, 30% deposits and WhatsApp reminders. Clients book in a browser, no app needed.",
    answer: "Beadup gives mobile detailers one booking link with prices by sedan, SUV and truck, open times only, a 30% deposit and reminders you send on WhatsApp. " + NO_APP,
    pains: ["Quoting the same jobs over and over in DMs", "Driving out to a no-show", "Double-booking long jobs like ceramic coatings"],
    fits: ["Prices by vehicle size, add-ons like pet hair and odor", "AI photo quotes from your own price list", "Travel time between jobs so you never overlap", "Before-and-after gallery on your page"],
    examples: [{ name: "Express wash", price: "$60" }, { name: "Full detail", price: "$180" }, { name: "Ceramic coating", price: "$650" }],
    faq: [
      ["Can clients choose their vehicle size?", "Yes. They pick sedan, SUV or truck and see that exact price before they book."],
      ["Does Beadup stop long jobs overlapping?", "Yes. A 6-hour coating blocks every start time inside it, plus your travel time."],
    ],
  },
  {
    slug: "boat-rv-detailers",
    trade: "boat_rv",
    title: "Booking app for boat and RV detailers",
    h1: "Boat and RV detailing, booked by length",
    description: "Price by boat or RV length, show your work, take a deposit and confirm on WhatsApp. Clients book online in a minute.",
    answer: "Beadup lets boat and RV detailers price by length (up to 20 ft, 20 to 30 ft, over 30 ft), take a 30% deposit and fill their calendar from one link. " + NO_APP,
    pains: ["Every quote needs the length first", "Big jobs blocked out with no deposit", "Photos of past work scattered across chats"],
    fits: ["Three length bands with your own prices", "Long jobs block the whole day automatically", "Gallery of your best work", "Receipts the owner can print"],
    examples: [{ name: "Exterior wash", price: "$120" }, { name: "Wash and wax", price: "$250" }],
    faq: [["Can I price by length?", "Yes. Clients pick their length band and see your price for it."]],
  },
  {
    slug: "pressure-washing",
    trade: "pressure_washing",
    title: "Booking app for pressure washing businesses",
    h1: "Pressure washing jobs, booked and paid upfront",
    description: "Small, medium or large job pricing, deposits, reminders and receipts for pressure washing pros. Clients book from one link.",
    answer: "Beadup gives pressure washing businesses a booking link with small, medium and large job prices, a 30% deposit and WhatsApp reminders. " + NO_APP,
    pains: ["Site visits just to give a price", "Rain-day reschedules lost in messages", "No-shows on weekend slots"],
    fits: ["Job size pricing you set", "Reschedule in two taps and text the new time", "Days off for weather", "Before-and-after photos"],
    examples: [{ name: "Driveway", price: "$120" }, { name: "House wash", price: "$250" }],
    faq: [["Can I close days for bad weather?", "Yes. Tap the day off in the app and clients can't book it."]],
  },
  {
    slug: "window-cleaners",
    trade: "window_cleaning",
    title: "Booking app for window cleaners",
    h1: "Window cleaning bookings without the back-and-forth",
    description: "Price by home size, take deposits and send reminders on WhatsApp. Clients book window cleaning in a minute.",
    answer: "Beadup lets window cleaners price by home size (1 to 2, 3, or 4+ bedrooms), fill open slots from one link and remind clients the day before. " + NO_APP,
    pains: ["Pricing every house by message", "Clients forgetting the appointment", "Gaps in the route"],
    fits: ["Home-size pricing", "Reminder template for tomorrow's jobs", "Travel time between homes", "Receipts after each job"],
    examples: [{ name: "Outside windows", price: "$120" }, { name: "Inside and out", price: "$200" }],
    faq: [["Do clients get reminded?", "Yes. Today shows tomorrow's jobs with a one-tap reminder on WhatsApp or Messages."]],
  },
  {
    slug: "house-cleaners",
    trade: "house_cleaning",
    title: "Booking app for house cleaners",
    h1: "House cleaning, booked by home size",
    description: "Standard, deep and move-out cleans priced by bedrooms, with deposits, reminders and receipts. Clients book online.",
    answer: "Beadup gives house cleaners a booking link with cleans priced by home size, a 30% deposit and reminders. " + NO_APP,
    pains: ["Last-minute cancellations", "Guessing how long a clean takes", "Chasing payment after the job"],
    fits: ["Prices by 1 to 2, 3 and 4+ bedrooms", "Durations that block the right time", "Extras like oven and fridge", "Printable receipts"],
    examples: [{ name: "Standard clean", price: "$120" }, { name: "Deep clean", price: "$220" }],
    faq: [["Can I offer extras?", "Yes. Add-ons like inside the oven or laundry are ticked by the client and added to the total."]],
  },
  {
    slug: "pet-groomers",
    trade: "pet_grooming",
    title: "Booking app for mobile pet groomers",
    h1: "Mobile pet grooming, booked by dog size",
    description: "Small, medium and large dog pricing, photos of your grooms, deposits and reminders. Owners book online in a minute.",
    answer: "Beadup lets mobile pet groomers price by dog size, show photos of each groom and take a 30% deposit from one link. " + NO_APP,
    pains: ["Size questions before every quote", "No-shows on full days", "Owners asking to see your work"],
    fits: ["Small, medium and large dog prices", "A photo on each groom so owners pick the look", "Gallery of happy dogs", "Reminders the day before"],
    examples: [{ name: "Full groom", price: "$70" }, { name: "Bath and tidy", price: "$50" }],
    faq: [["Can owners see the groom style?", "Yes. Add a photo to each service and owners choose by what they see."]],
  },
  {
    slug: "hair-salons",
    trade: "hair_salon",
    title: "Booking app for hair salons and braiders",
    h1: "Your styles, with photos, booked in a minute",
    description: "Show each hairstyle with a photo and price, take a deposit and confirm on WhatsApp. Clients pick the style they want and book.",
    answer: "Beadup lets hair salons and braiders list each style with a photo and one price, so clients pick exactly the look they want, choose a time and pay a deposit. " + NO_APP,
    pains: ["Clients sending screenshots asking 'how much for this?'", "Long braiding appointments with no deposit", "Your best work buried in Instagram"],
    fits: ["A photo on every style", "Clients come to your salon: no address asked", "Long styles block the right hours", "Confirm and remind on WhatsApp"],
    examples: [{ name: "Knotless braids", price: "$180" }, { name: "Silk press", price: "$80" }],
    faq: [
      ["Can clients book a style from its photo?", "Yes. Each style shows its photo and price; the client taps it and books."],
      ["Do clients need to give an address?", "No. Choose 'Clients come to me' and the booking asks for name and number only."],
    ],
  },
  {
    slug: "barbers",
    trade: "barber",
    title: "Booking app for barbers",
    h1: "The booking link for barbers",
    description: "List cuts with photos and prices, fill your chair from one link, cut no-shows with deposits and WhatsApp reminders.",
    answer: "Beadup gives barbers one link where clients pick a cut (with a photo), choose an open time and pay a deposit, plus one-tap WhatsApp reminders. " + NO_APP,
    pains: ["DMs all day asking for a slot", "No-shows on Saturdays", "Clients not sure which cut to ask for"],
    fits: ["Photo for every cut and design", "Short slots that never overlap", "Clients come to your shop", "Reviews after each cut"],
    examples: [{ name: "Haircut", price: "$30" }, { name: "Cut and beard", price: "$40" }],
    faq: [["Can I take walk-ins too?", "Yes. Your link only offers the times you open; keep the rest for walk-ins."]],
  },
  {
    slug: "nail-technicians",
    trade: "nails_beauty",
    title: "Booking app for nail technicians and beauty salons",
    h1: "Nails and beauty, chosen from your photos",
    description: "Show each set with a photo and price, take deposits, and send reminders. Clients pick the look and book in a minute.",
    answer: "Beadup lets nail technicians and beauty pros list each set or treatment with a photo and price, take a deposit and fill their book from one link. " + NO_APP,
    pains: ["'How much for this design?' messages", "Late cancellations", "Long sets booked into short gaps"],
    fits: ["A photo on each set", "Add-ons like nail art", "Clients come to you or you go to them", "Receipts and reviews"],
    examples: [{ name: "Gel manicure", price: "$40" }, { name: "Acrylic full set", price: "$60" }],
    faq: [["Can I add nail art as an extra?", "Yes. Add-ons are ticked by the client and added to the total."]],
  },
  {
    slug: "makeup-artists",
    trade: "makeup",
    title: "Booking app for makeup artists",
    h1: "Makeup bookings with your looks on show",
    description: "Event and bridal looks with photos and prices, deposits that hold the date, and WhatsApp confirmations.",
    answer: "Beadup lets makeup artists show each look with a photo, take a deposit to hold the date and confirm on WhatsApp. " + NO_APP,
    pains: ["Dates held without a deposit", "Brides asking for your portfolio", "Travel between bookings"],
    fits: ["Photo for each look", "Deposit before the date is yours", "Travel time between jobs", "Trial sessions as a service"],
    examples: [{ name: "Event makeup", price: "$90" }, { name: "Bridal makeup", price: "$250" }],
    faq: [["Can I travel to clients?", "Yes. Choose 'I go to my clients' and they give the address when they book."]],
  },
  {
    slug: "mobile-mechanics",
    trade: "mechanic",
    title: "Booking app for mobile mechanics",
    h1: "Mobile mechanic jobs, booked and confirmed",
    description: "List services with fixed prices, block the right time, take a deposit and confirm on WhatsApp. No photos needed.",
    answer: "Beadup gives mobile mechanics a booking link with fixed-price services, the right time blocked for each job and a 30% deposit. " + NO_APP,
    pains: ["Calls while you're under a car", "Customers not home when you arrive", "Quotes lost in messages"],
    fits: ["Clear fixed prices per service", "Job length blocks your day correctly", "'On my way' message in one tap", "Printable receipts"],
    examples: [{ name: "Oil and filter change", price: "$80" }, { name: "Diagnostics", price: "$60" }],
    faq: [["Do I need photos for my services?", "No. Photos are optional; many mechanics list services with a price only."]],
  },
  {
    slug: "handymen",
    trade: "handyman",
    title: "Booking app for handymen",
    h1: "Handyman jobs, booked without phone tag",
    description: "Hourly and fixed jobs with clear prices, deposits, reminders and receipts. Clients book online in a minute.",
    answer: "Beadup gives handymen a booking link with clear job prices, the time blocked for each job, a deposit and reminders. " + NO_APP,
    pains: ["Phone tag to agree a time", "No-shows on booked half days", "Paper receipts"],
    fits: ["Small job, half day and fixed jobs", "Travel time between jobs", "Reschedule and text the new time", "Receipts clients can print"],
    examples: [{ name: "Small job (1 hour)", price: "$60" }, { name: "Half day", price: "$220" }],
    faq: [["Can I sell half-day blocks?", "Yes. Set the duration and your calendar blocks the whole time."]],
  },
];

export const tradePage = (slug: string) => TRADE_PAGES.find((p) => p.slug === slug) ?? null;
