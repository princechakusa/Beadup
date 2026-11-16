# App Store and Google Play optimization (ASO)

Draft metadata for the English listings. Nothing here is submitted by an agent: the owner pastes it in App Store Connect / Play Console.
Rules: never put the Pro price in a listing (it lives in the stores, Apple 3.1.2); no invented ratings, awards or review counts;
Android is in testing, so the App Store text says nothing about Android and the Play text goes live only when Android is released.
Other languages: `docs/STORE_LISTINGS_I18N.md` (Spanish, French, Portuguese).

Beadup is the booking app for service businesses, so say so: "Beadup" alone could be read as a beading or craft app.

## Apple App Store (English, US)

| Field | Limit | Text | Length |
|---|---|---|---|
| Name | 30 | `Beadup: Booking & Quotes` | 24 |
| Subtitle | 30 | `Deposits & Schedule for Pros` | 28 |
| Keywords | 100 | `detailing,mobile,crm,invoice,whatsapp,client,appointment,barber,salon,groomer,cleaning,estimate` | 95 |
| Promotional text (editable any time, no review) | 170 | `Snap a car, get a suggested quote from your own prices, share one booking link. Clients book with no app. Deposits go straight to you. Free to start.` | 149 |

Keyword field rules followed: comma separated, no spaces, no word already in the name or subtitle (Apple indexes those:
booking, quotes, deposits, schedule, pros), no category or "app" words, singular only (Apple matches plurals). The first brief asked for
`booking,quotes,deposits,schedule` in the keyword field too; they are dropped because they are already indexed from the title and subtitle, and
the space went to `appointment,barber,salon,groomer,cleaning,estimate` (other trades Beadup now serves). Re-check the keyword field's length
in App Store Connect when pasting (it shows a live counter). Changing name, subtitle or keywords needs a new app version.

### Description (4000 limit, about 2,400 used)

```
Beadup is the booking app for service businesses that work for themselves: mobile car detailers, boat and RV detailers, hair salons, barbers, nail and beauty technicians, makeup artists, pet groomers, house and window cleaners, pressure washers, mobile mechanics and handymen.

YOUR BOOKING LINK
- One link (beadup.app/yourname) for your Instagram bio, WhatsApp status or a van decal QR code.
- Clients pick a service and an open time in any browser. No app and no account for them.
- No double bookings: overlapping jobs, days off and travel time are blocked for you.
- Your page appears in your client's language: English, Spanish, French or Portuguese.

DEPOSITS THAT CUT NO-SHOWS
- Every booking shows a 30% deposit that your client pays straight to you, with your own payment link or instructions.
- Beadup never touches your money and takes no cut.
- Printable receipts and a rating link after the job.

WHATSAPP, IN ONE TAP
- Ready-written messages to confirm, remind the day before and say you are on your way. Beadup opens WhatsApp or Messages with the text filled in and you press send.

YOUR DAY AT A GLANCE
- Today, a weekly calendar, repeat clients and who is due back.
- Teams with their own schedules, days off and weekly availability.

AI PHOTO QUOTES FOR CAR DETAILING
- Take photos of a vehicle and get a suggested quote priced only from your own price list. You review and approve every quote before it goes out.
- Photos are sent to an AI provider only if you agree in the app, and you can turn it off any time.

BEADUP PRO
- The free plan includes every feature up to a monthly booking limit.
- Beadup Pro is an optional monthly subscription that removes the limit. It renews automatically until cancelled and is managed in your Apple Account settings. The price is shown in the App Store.

Terms of Use: https://beadup.app/terms
Privacy Policy: https://beadup.app/privacy
Support: https://beadup.app/support
```

(Edit to match the live app before submitting: if a feature above has changed, drop it. Facts come from `CLAUDE.md` and `docs/STORE_LISTINGS_I18N.md`.)

Also set: Support URL `https://beadup.app/support`, Marketing URL `https://beadup.app`, Privacy Policy URL `https://beadup.app/privacy`,
category Business (secondary: Productivity).

## Google Play (English)

| Field | Limit | Text | Length |
|---|---|---|---|
| App name | 30 | `Beadup: Booking & Quotes` | 24 |
| Short description | 80 | `Booking link, deposits and quotes for pros. Clients book in a browser, no app.` | 78 |
| Full description | 4000 | the App Store description above, minus the Apple wording (replace "Apple Account settings" with "Google Play subscription settings" and "App Store" with "Play Store") | |

Play has no keyword field: it indexes the full description, so the trades and phrases above (car detailing booking app, booking link,
deposit, WhatsApp, barber, salon, groomer) are already in it. Keep them in the first paragraphs. Go live with the Play text only
when Android is released; the website says "iOS and Web" until then.

## Where the words come from (search intent)

| Query | Where Beadup answers it |
|---|---|
| mobile detailing booking software, best car detailing apps | `/car-detailing-booking-app`, `/for/car-detailers`, App Store name and keywords |
| AI detailing quote | `/ai-detailing-quote-calculator` |
| booking link with deposits | `/booking-link-with-deposits` |

## Universal Links (deep links from beadup.app into the app)

- The site serves `/.well-known/apple-app-site-association` (`apps/web/src/app/.well-known/apple-app-site-association/route.ts`).
  It returns 404 until **`NEXT_PUBLIC_APPLE_TEAM_ID`** is set (10 characters: Apple Developer > Membership details > Team ID; the Team ID is
  not recorded anywhere in this repo). Set it in the Cloudflare Workers build variables and redeploy. The app id it publishes is
  `<TEAMID>.com.beadup.app`.
- Paths: everything is **excluded** (client booking pages `/<handle>`, `/b/*`, `/r/*`, `/api/*` and `/admin` must open in the browser:
  clients have no app) except `/app/*`, a reserved handle kept for future in-app deep links. The app does not handle any https path today, so
  nothing opens in the app yet; auth uses the `beadup://auth/callback` scheme.
- **Native build needed:** Universal Links also need the Associated Domains entitlement `applinks:beadup.app` in the iOS app
  (app.json `ios.associatedDomains`). That is a native change, so it is NOT part of an OTA update and must ship with the next store build
  together with a bumped `version` (see the OTA note in `CLAUDE.md`). app.json was deliberately not edited now.
- Check after deploy: `curl -i https://beadup.app/.well-known/apple-app-site-association` returns 200 `application/json`, no redirect.
  Apple's CDN caches the file; changes take a few days to reach devices.
- Smart App Banner on marketing pages comes from `NEXT_PUBLIC_APP_STORE_URL` (`appStoreMetadata()` in `src/lib/seo.ts`), not from this file.
