# Beadup marketing kit

For the owner and anyone helping with launch marketing. Every claim here matches the app today (`CLAUDE.md`): no
card payments in the app (deposits go to the detailer directly), no texts to clients, AI quotes are estimates the detailer
approves. Re-check before posting if any of that changes. **Nothing here is posted or sent by an agent**: the owner
approves and posts.

**Files:** `launch-checklist.md` (day-by-day, first 30 days), `week-1-content.md` (videos, captions, replies),
`accounts.md` (which social and search accounts to create).

## Countries

**Market in the USA only at launch.** The app is set to be available in the US, Canada, UK and Australia, but the booking
page only accepts US/Canadian phone numbers (+1) and shows prices in US dollars. A UK or Australian detailer could sign up
and their clients could not book. So:
- **USA:** launch market, all marketing.
- **Canada:** works (same +1 numbers, "$" prices), no active marketing yet.
- **UK and Australia:** remove from App Store availability until local phone numbers and currency (GBP/AUD) are supported.
  Then add them in the roadmap order: UK, Canada, Australia.

## 1. Positioning (use these words everywhere)

- **One line:** Quote, book and get paid, built for mobile car detailers.
- **The hook:** Snap photos of a car, get a priced quote from your own price list, send your booking link. Booked in a minute.
- **Three proof points:**
  1. **One link, no app for clients.** Bio link, texts, a QR code on the van.
  2. **Deposits that cut no-shows.** A 30% deposit, paid straight to the detailer. Beadup takes no cut.
  3. **AI photo quotes.** Priced only from the detailer's own prices, and approved before sending.
- **Who it's for:** solo US mobile detailers with 500 to 10k followers, booking through DMs today.
- **What we never say:** "get paid in the app", "automatic texts", "AI sets your prices", "#1", or any stat we haven't measured.

## 2. What's live for marketing (web, 2026-11-09)

| Asset | URL | Use it for |
|---|---|---|
| Landing page | `/` | Bio link, ads, press |
| Guides | `/blog` | SEO/AEO, answering questions in groups ("here's how I'd set deposits: link") |
| Sample booking page | `/beadup-demo-detailing` | "See what your clients see" in every DM |
| Booking link previews | `/<handle>` | Each link pasted in a DM/iMessage shows a branded card with name, area, rating and "from $" prices |
| `llms.txt` | `/llms.txt` | Facts for ChatGPT, Claude, Perplexity and other assistants |
| QR code (in app) | Today > booking link > QR | Van decals, cards, flyers. Screenshot it |
| "Powered by beadup" | Bottom of every booking page | Free referral traffic, tagged `utm_source=booking_page&utm_campaign=<handle>` |

**SEO/AEO built in:** sitemap (site pages, guides and every published booking page), robots that welcome AI crawlers,
canonical URLs, schema.org microdata (SoftwareApplication, Organization, FAQPage, Article, and AutoWash/LocalBusiness with
services, prices and rating on each booking page). It's microdata, not JSON-LD, because the strict CSP forbids inline scripts.

**Next for SEO:** submit the sitemap in Google Search Console and Bing Webmaster Tools (owner, needs the domain). Write one guide a
week (ideas in section 6). City pages ("mobile detailing app Houston") only once there are real detailers there to show.

## 3. App Store listing (ASO)

Change **Promotional text** any time (no review). Changing the subtitle and keywords needs the next app version.

- **Subtitle (30):** `Booking app for car detailers` [29]. Clearer than "Quotes and bookings, detailers".
- **Keywords (100):** Apple already indexes the name, subtitle and category, so don't repeat "booking", "car" or "detailers":
  `detailing,mobile detail,quote,estimate,deposit,scheduler,appointment,ceramic,auto,wash,clients` [94]
- **Promotional text (170):**
  `Snap a car, send a priced quote, get booked from one link. Deposits go straight to you. Built for mobile detailers. Free to start.` [130]
- **Screenshot order:** lead with the photo-to-quote screen (2), then the booking page (4), then Today (1). The first two
  screenshots decide most installs.
- **Ratings:** ask the first 20 detailers personally for an App Store rating once they've had a real booking. (A built-in
  rating prompt needs `expo-store-review`, a native module, so it ships with the next store build: see `docs/HANDOFF.md`.)

## 4. 30-day launch plan

| Week | Do | Goal |
|---|---|---|
| 1 | Post 3 short videos (section 5). DM 20 detailers a day using `docs/outreach/README.md`. Set up your own booking page as a demo. | First 10 sign-ups |
| 2 | Help each new detailer finish setup by DM (services, hours, payment link, link in bio). Ask for one screen recording of a real booking. | 5 detailers with a live link in their bio |
| 3 | Post in 3 Facebook groups on their promo day (feedback angle). Share a guide that answers a question someone asked. Reach out to 5 detailing micro-creators (free Pro for life for an honest review). | 1 creator video |
| 4 | Turn the best testimonial and screen recording into the landing hero and the App Store promo text. Collect App Store ratings. | 20 detailers, 5+ ratings |

**Offer:** the first 20 detailers get 3 months of Pro free (`docs/outreach/README.md` says how to grant it).

## 5. Short video scripts (Reels / TikTok / Shorts, 9:16, 15 to 25 s)

Screen-record on the phone (Settings > Screen Recording), add captions, no music with lyrics. Show the real app.

1. **"Quote in 30 seconds"**. Hook text: *"Client asks 'how much?' Watch this."* Snap 3 photos, the quote appears, tap send.
   End card: *"Beadup. Link in bio."*
2. **"No more DM ping-pong"**. Split screen: a 14-message DM thread vs. a client booking from the link in 20 seconds.
3. **"The no-show fix"**. Hook: *"I lost 3 Saturdays to no-shows."* Show the 30% deposit step and the "Pay deposit" button.
   Caption: *"Deposit goes straight to you. The app takes no cut."*
4. **"QR on the van"**. Film a neighbor scanning the van decal and booking on the spot.
5. **"What clients see"**. Scroll the booking page: services, SUV pricing, add-ons, pick a time, "You're booked", add to calendar.

Hashtags: `#mobiledetailing #mobiledetailer #autodetailing #detailingbusiness #ceramiccoating` plus a city tag.

## 6. Guide ideas (one a week, `apps/web/src/content/guides.tsx`)

Answer one real question per guide, with a short answer up top, no invented statistics, and 2 or 3 FAQs at the end.

- How to start a mobile detailing business (licenses, insurance, first 10 clients)
- What to put on a mobile detailing price list (with a sample layout)
- Ceramic coating deposits and aftercare instructions to send clients
- How to handle cancellations for rain
- Square vs PayPal vs Venmo vs Zelle for detailing deposits (fees and holds, checked on the day you write it)
- How to get Google reviews as a mobile detailer

## 7. Measure every week

New sign-ups · finished onboarding · links shared (QR + share taps) · booking-page visits → bookings · detailers hitting
the free limit · Pro subscribers (RevenueCat) · `utm_source=booking_page` visits to the landing page.
Visits and UTM numbers need analytics, which isn't installed yet (privacy labels would need updating first). Until then,
count from Supabase (`bookings`, `detailers`) and RevenueCat.

## 8. Tracked App Store links (use these, not the plain listing link)

Each link shows up as its own campaign in App Store Connect → Analytics → Campaigns (numbers appear once at least 5 different
Apple Accounts install through it). Provider token `129220014` is public and safe to share.

| Where | Link |
|---|---|
| website | https://apps.apple.com/app/apple-store/id6831768099?pt=129220014&ct=website&mt=8 |
| instagram-bio | https://apps.apple.com/app/apple-store/id6831768099?pt=129220014&ct=instagram-bio&mt=8 |
| instagram-dm | https://apps.apple.com/app/apple-store/id6831768099?pt=129220014&ct=instagram-dm&mt=8 |
| tiktok | https://apps.apple.com/app/apple-store/id6831768099?pt=129220014&ct=tiktok&mt=8 |
| youtube | https://apps.apple.com/app/apple-store/id6831768099?pt=129220014&ct=youtube&mt=8 |
| facebook-groups | https://apps.apple.com/app/apple-store/id6831768099?pt=129220014&ct=facebook-groups&mt=8 |
| reddit | https://apps.apple.com/app/apple-store/id6831768099?pt=129220014&ct=reddit&mt=8 |
| email | https://apps.apple.com/app/apple-store/id6831768099?pt=129220014&ct=email&mt=8 |
| qr-flyer | https://apps.apple.com/app/apple-store/id6831768099?pt=129220014&ct=qr-flyer&mt=8 |
| van-decal | https://apps.apple.com/app/apple-store/id6831768099?pt=129220014&ct=van-decal&mt=8 |
| creator | https://apps.apple.com/app/apple-store/id6831768099?pt=129220014&ct=creator&mt=8 |
| referral | https://apps.apple.com/app/apple-store/id6831768099?pt=129220014&ct=referral&mt=8 |

New channel? Copy any link and change the `ct=` value (max 40 characters, letters, numbers and dashes).
