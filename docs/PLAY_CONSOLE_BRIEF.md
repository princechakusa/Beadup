# Google Play Console: answers to enter (updated 2026-11-17)

Supersedes the Google Play parts of `docs/store-submission.md`, which still described a car-detailer-only app. Beadup is now for 13 kinds of appointment business (detailers, barbers, salons, groomers, cleaners, mechanics and more), in English, Spanish, French and Portuguese. Every answer below is true of the code today. If a form asks something not listed here, do NOT guess: stop and ask the owner.

Console: https://play.google.com/console/u/0/developers/8257127577906479212/app/4972929583593981942 (app id 4972929583593981942, developer account of Prince Chakusa). Package name `com.beadup.app`.

## Rules for whoever fills this in
- Save drafts only. NEVER press "Send for review", "Publish", "Submit for review" or create a release.
- Do not accept legal agreements, do not set up payments profiles, do not declare trader status (owner does those).
- The Play Console page is heavy: open your OWN tab, use `read_page`/`find` instead of many screenshots, and reload the tab if it stops responding.
- Never type passwords or keys. Demo login credentials for "App access" are NOT available: leave that item for the owner.
- Report exactly what you saved and what you left, per section.

## Store listing (default language: English, United States)
- **App name (30):** `Beadup: Bookings & Quotes` (replace the old "Beadup: Detailer Bookings")
- **Short description (80):** `Your booking link, calendar and quotes. Clients book in a browser, no app needed.`
- **Full description (4000):**
```
Beadup is the booking and quote app for independent service businesses: car detailers, barbers, hair salons, nail and makeup artists, pet groomers, cleaners, mobile mechanics, handymen and more.

YOUR BOOKING LINK
Put one link in your Instagram bio, WhatsApp or on a card. Clients pick a service and an open time and book from their browser. No app, no account. The page appears in your client's language (English, Spanish, French or Portuguese) and avoids double bookings, including your travel time between jobs.

GET PAID YOUR WAY
Every booking shows a 30% deposit. Clients pay it straight to you with your own payment link or details: PayPal, Zelle, PayShap, PayNow, bank transfer, cash and more. Beadup never touches your money and takes no cut. Receipts come with a private link and a quick rating.

YOUR DAY AT A GLANCE
Today, a weekly calendar, regular clients and who is due back. Ready-written WhatsApp messages for confirmations and reminders. Teams with their own calendars, days off and weekly availability.

AI PHOTO QUOTES (CAR DETAILING)
Take photos of a vehicle and get a suggested quote from your own price list. You review and approve every quote before it goes to a client. Photos are sent to an AI provider only if you agree, and you can turn it off any time.

BEADUP PRO
The free plan includes a monthly number of bookings. Beadup Pro is an optional monthly subscription that removes the limit. It renews automatically until you cancel in your Google Play subscription settings.

PRIVACY
You can delete your account and data in the app at any time.
```
- **Category:** Business. **Tags:** Business, Productivity (pick what the console offers).
- **Contact:** email `support@beadup.app`, website `https://beadup.app`, phone: leave empty unless the owner gives one.
- **Privacy policy URL:** `https://beadup.app/privacy`.
- **Graphics** (files on the owner's PC, upload with the file tool): `C:\Users\Dev Prince\Projects\beadup\apps\mobile\assets\store\android\`
  - App icon: `icon-512.png` (512x512)
  - Feature graphic: `feature-1024x500.png`
  - Phone screenshots, in order: `phone-1-today.png`, `phone-2-quote.png`, `phone-3-calendar.png`, `phone-4-booking.png`, `phone-5-money.png`, `phone-6-payment.png` (1080x2160)
- **Translations** (Store presence > Store listings > Manage translations > add Spanish (es-419 or es-ES), French (fr-FR), Portuguese (pt-BR)). Use the texts in `docs/STORE_LISTINGS_I18N.md` (name `Beadup`, short and full description). Use the same graphics.

## App content declarations
| Declaration | Answer |
|---|---|
| Privacy policy | `https://beadup.app/privacy` |
| App access | All or some functionality is restricted. Needs login credentials: OWNER PROVIDES (leave as is) |
| Ads | No, the app contains no ads |
| Content rating (IARC questionnaire) | Category: Utility, Productivity or Other (not a game). Answer No to everything: violence, sexual content, language, controlled substances, gambling, user-generated content shared between users, location sharing, digital purchases of random items. Note: the app has an optional paid subscription (a digital purchase, not random items). Expected rating: Everyone / 3+ |
| Target audience and content | Target age group: 18 and over only. Not designed for children. No appeal to children |
| News app | No |
| COVID-19 contact tracing or status | No |
| Data safety | See below |
| Government apps | No |
| Financial features | None of the listed (not a payments, loan, banking, crypto or trading app). Clients pay businesses directly outside the app |
| Health apps | No |
| Advertising ID | The app does not use it |
| Account deletion | In-app: Settings > Delete account. Web: `https://beadup.app/delete-account` |
| Trader status | OWNER does this (legal declaration). Skip |

## Data safety form
- Does the app collect or share required user data types: **Yes**.
- Is all user data encrypted in transit: **Yes**.
- Can users request that data be deleted: **Yes** (in-app path and the web link above).
- Committed to follow the Play Families policy: No (not a children's app).
- Independent security review: No.

| Data type (Play category) | Collected | Shared | Purpose | Optional |
|---|---|---|---|---|
| Name | Yes | No | App functionality, Account management | Required |
| Email address | Yes | No | App functionality, Account management | Required |
| Phone number | Yes | No | App functionality | Required (clients' booking phone) |
| Address (physical address, where the job is) | Yes | No | App functionality | Required for on-site jobs |
| Photos | Yes | Yes (AI provider, only with the user's consent) | App functionality | Optional |
| Purchase history | Yes | No | App functionality (subscription status, bookings) | Required |
| User IDs | Yes | No | App functionality, Account management | Required |
| Device or other IDs (push token) | Yes | No | App functionality | Optional (booking alerts) |
| Crash logs / Diagnostics (error message and stack trace, no personal details) | Yes | No | App functionality (fixing bugs) | Required |
| Financial info, location, contacts, messages, files, health, web browsing, app activity | No | | | |

Notes: Supabase (database and sign-in), Cloudflare (hosting and bot check), Brevo (client emails), Expo (push delivery) and RevenueCat (subscription status) act as service providers for Beadup. Google does not count service providers as "sharing". The AI provider (OpenAI) receives photos the user picks, after an in-app consent screen: declare Photos as shared.

## Permissions (for reference)
Camera and photo picker only when adding photos. Notifications optional. No location, contacts, SMS or phone permissions.

## Not possible yet (needs the owner or a build)
- Android build and release: no Android app bundle exists. Do not create a release.
- App access credentials, trader status, payments profile, tax and merchant info.
