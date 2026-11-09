# Beadup: store submission answers

Ready-to-paste answers for **App Store Connect** and **Google Play Console**. Written against `rules.md`.
Items in `[BRACKETS]` need a real value before submitting. Re-check Apple's and Google's current forms on submission day: the questions change.

**Launch setup (owner decisions 2026-11-07), reflected everywhere below:**
- **No in-app client payments.** Clients book free and pay the 30% deposit to the detailer directly, through the
  detailer's own payment link (Square, PayPal, Venmo, Cash App) or instructions (e.g. Zelle). Beadup never touches
  client money (`plan_config.payments_mode = "external"`). No Stripe at launch.
- **No text messages** (`sms_enabled = false`): nothing goes to Twilio. Detailers get push alerts.
- **AI photo quotes use OpenAI**, after an in-app consent screen.
- **Hosting:** https://beadup.netlify.app until a domain is bought. Legal name: Prince Chakusa.

**Status (2026-11-09):** **Approved and live on the US App Store**: https://apps.apple.com/us/app/beadup/id6831768099 (Apple ID 6831768099). `NEXT_PUBLIC_APP_STORE_URL` is set on Netlify (site buttons say "Download", Safari Smart App Banner on marketing pages). Google Play: not submitted yet.

### App Store Connect progress
Done in the owner's account:
- [x] Bundle ID `com.beadup.app` registered (capabilities: In-App Purchase, Sign In with Apple)
- [x] App record "Beadup" created (Apple ID 6831768099, SKU `beadup-ios-001`, English U.S., iOS)
- [x] Version 1.0: description, keywords, promotional text entered. **Replace them with the section 1 text below**: the saved version promises card deposits and automatic receipts, which the launch build doesn't have
- [x] App Information: subtitle, categories Business + Productivity, Content Rights = no third-party content
- [x] Age rating questionnaire: all "None/No" → **4+**
- [ ] App Privacy labels (section 1 table) and Privacy Policy URL `https://beadup.netlify.app/privacy`
- [ ] Support URL `https://beadup.netlify.app/support`, Marketing URL `https://beadup.netlify.app`, Copyright `© 2026 Prince Chakusa`
- [ ] App Review info: demo account, contact, review notes (section 1)
- [ ] Pricing and availability: Free, United States first
- [ ] Screenshots (6.9" iPhone): from the real build
- [x] In-App Purchase (2026-11-08): group "Beadup Pro", subscription `beadup_pro_monthly` (Apple ID 6832323640), 1 month, US $19.00 (Apple set the other 174 countries), available everywhere the app is, display name "Beadup Pro" / "Unlimited bookings for your detailing business". **Price lives only here and must never be hardcoded in the app.** Still to add before review: the paywall screenshot (from the TestFlight build). Paid Apps Agreement: Active
- [x] Screenshots (2026-11-08): six 6.9" images uploaded to Asset Library (`apps/mobile/assets/store/`); arrange in order when adding to the version
- [x] Screenshots (2026-11-09): App Store Connect now asks for the 6.1"/6.3" iPhone slot (1206×2622); six resized copies `apps/mobile/assets/store/ios-6.3-*.png` added to version 1.0 in order
- [ ] RevenueCat: project, App Store connection (In-App Purchase key), entitlement `pro`, offering with the monthly package; public iOS key into `eas.json` (`EXPO_PUBLIC_REVENUECAT_IOS_KEY`); webhook to `https://beadup.netlify.app/api/revenuecat/webhook` with `REVENUECAT_WEBHOOK_AUTH`
- [ ] 🔑 Apple banner: the **Account Holder must accept the updated Apple Developer Program License Agreement** (deadline Nov 14, 2026). Also the EU trader status declaration if distributing in the EU
- [ ] Upload a build (EAS, see `docs/DEPLOY.md`) and submit for review

---

## 0. Values used everywhere

| Item | Value |
|---|---|
| App name | Beadup |
| Bundle ID / package | `com.beadup.app` (final, owner approved 2026-11-07) |
| Primary category | Business |
| Secondary category (Apple) | Productivity |
| Price | Free to download. Optional Beadup Pro subscription via in-app purchase (section 5) |
| Support email | `[SUPPORT EMAIL]` (same as `NEXT_PUBLIC_SUPPORT_EMAIL` on Netlify) |
| Support URL | `https://beadup.netlify.app/support` |
| Marketing URL | `https://beadup.netlify.app` |
| Privacy policy URL | `https://beadup.netlify.app/privacy` |
| Terms URL | `https://beadup.netlify.app/terms` |
| Account deletion URL | `https://beadup.netlify.app/delete-account` |
| Copyright | `© 2026 Prince Chakusa` |
| Audience | Adults 18+. Not for children |

Swap `beadup.netlify.app` for the real domain everywhere when one is bought.

---

## 1. App Store Connect

### Listing text
Character counts are in brackets; all are within the limits.

**Name (max 30):** `Beadup` [6]
**Subtitle (max 30):** `Quotes and bookings, detailers` [30]
**Promotional text (max 170):**
`Send a priced quote from your phone and get booked from one link, with a deposit that cuts no-shows. Built for mobile car detailers.` [132]

**Keywords (max 100, comma separated, no spaces after commas):**
`detailing,car wash,booking,quote,scheduler,deposit,mobile detailer,appointments,clients,calendar` [96]

**Description (max 4000):**
```
Beadup is the quote and booking app built for mobile car detailers.

QUOTE IN 60 SECONDS
Take photos of the vehicle and Beadup suggests an itemized price from your own price list. AI photo quotes are estimates: you review, edit and approve every quote before it is sent.

ONE LINK, NO APP FOR CLIENTS
Put your booking link in your Instagram bio or send it to customers. They pick a service, vehicle size, add-ons and a time from their browser. No download, no account.

DEPOSITS THAT CUT NO-SHOWS
Every booking shows a 30% deposit. Clients pay it straight to you through your own payment link or instructions, such as Square, PayPal, Venmo or Zelle. Beadup never touches your money and takes no cut.

RUN YOUR DAY
See today's jobs, get directions to the next one, call the client, and mark jobs done. Get an alert the moment someone books (optional).

KNOW YOUR NUMBERS
See what you earned this week and this month, what is still booked, and your best clients.

BEADUP PRO
The free plan includes a monthly booking limit. Beadup Pro is an optional auto-renewing subscription for more bookings, bought in the app. The price is shown before you buy.

PRIVACY
Vehicle photos are sent to our AI provider, OpenAI, only after you give permission in the app. Beadup never sees card or bank details. You can delete your account and data in the app at any time.
```
[1,351 characters]

**What's New (1.0):** `First release.` [14]

### Screenshots (required: 6.9" iPhone, 1290×2796)
Ready: `apps/mobile/assets/store/ios-6.9-1-today.png` to `-6-payment.png` (1290×2796, real app screens in demo mode, how they're made: `apps/mobile/assets/source/screenshots/README.md`). Upload them in number order. One caption per screen:

| # | Screen | Caption |
|---|---|---|
| 1 | Today | Your day, your jobs, your money |
| 2 | New quote (AI photo) | Photos in, priced quote out |
| 3 | Calendar | Every job, every hour, at a glance |
| 4 | Client booking page (Safari) | One link. Clients book in a minute |
| 5 | Money | Know what this month brought in |
| 6 | Settings > Payment link | Deposits go straight to you |

### Age rating questionnaire
Answer **None / No** to every item: violence, sexual content, profanity, horror, alcohol/tobacco/drugs, gambling, contests, medical info, unrestricted web access, user-generated content, messaging between users, ads, in-app controls. Expected rating **4+**.
Re-check: client reviews are text shown only to the detailer and on their booking page as an average; if public review text is added later, answer again.

### App Privacy ("nutrition label")
**Tracking:** No. Beadup does not track users across other companies' apps or sites. No tracking permission prompt.

Data **collected and linked to the user**, all for **App Functionality** only (not advertising, not analytics):

| Apple data type | Collected? | Why |
|---|---|---|
| Contact info: name, email, phone | Yes | Detailer account; client name and phone on bookings |
| Contact info: physical address | Yes | Where to do the job |
| User content: photos | Yes | Vehicle photos for AI price quotes (optional) |
| User content: other | Yes | Reviews clients choose to leave; the detailer's payment link/note |
| Purchases: purchase history | Yes | Pro subscription status, and booking records (no card data) |
| Identifiers: user ID | Yes | Account |
| Identifiers: device ID | Yes | Push token, only if booking alerts are turned on |
| Financial info | No | Clients pay detailers outside Beadup; Beadup never receives card or bank details |
| Location | No | |
| Health, contacts, browsing history, search history | No | |
| Diagnostics | No (change to Yes if crash reporting is added) | |

Third parties that receive data: **OpenAI** (vehicle photos for quotes, with explicit in-app consent: guideline 5.1.2(i)), **Expo** (push delivery), **Cloudflare** (Turnstile bot check on booking pages), **RevenueCat** (subscription status), **Supabase** and **Netlify** (hosting, processors). Not at launch: Stripe, Twilio. Update this table, Play Data safety and `/privacy` before either is turned on.

### App Review information
**Sign-in required:** Yes. Create the demo account in Supabase (Authentication → Users → Add user, email + password, Auto confirm), sign in once and finish onboarding, then enter it here. The sign-in screen has "Sign in with a password" for it.
- Detailer: `[DEMO DETAILER EMAIL]` / `[DEMO PASSWORD]`
- Client booking page needs no account: `https://beadup.netlify.app/[DEMO HANDLE]`

**Contact:** Prince Chakusa, `[PHONE]`, `[EMAIL]`

**Notes for Review (paste):**
```
Beadup is a business tool for mobile car detailers (physical, on-site vehicle cleaning).

HOW TO TEST
1. On the sign-in screen tap "Sign in with a password" and use the demo detailer account above. The Today screen shows jobs and earnings.
2. Tap + to create a quote. Pick photos (system picker). Before any photo leaves the device the app shows an AI disclosure naming OpenAI and asks for permission. The quote is an estimate the detailer edits and approves.
3. Open https://beadup.netlify.app/[DEMO HANDLE] in Safari to see the client booking page (no account needed). Book a time; the confirmation shows the detailer's own payment instructions.

CLIENT PAYMENTS (guideline 3.1.3(e))
Clients pay detailers for physical services performed at the vehicle. Beadup does not process these payments: after booking, the client is shown the detailer's own payment link or instructions and pays the detailer directly, outside the app.

DETAILER SUBSCRIPTION
Beadup Pro is an auto-renewing subscription purchased with in-app purchase. Use a sandbox Apple ID to test the purchase and Restore Purchases.

ACCOUNT DELETION (5.1.1(v))
Settings > Delete account removes the account and its data in the app. Web: https://beadup.netlify.app/delete-account

AI (5.1.2(i))
Vehicle photos are sent to a third-party AI provider (OpenAI) only after the user taps Allow on a consent screen, and consent can be withdrawn in Settings. Quotes are suggestions the detailer approves.

PERMISSIONS
Camera and photo picker are used only when the user adds vehicle photos. Notifications are optional and the app works without them. The app sends no text messages.
```

### Other App Store Connect answers
- **Export compliance:** the app uses only standard HTTPS/TLS. `ITSAppUsesNonExemptEncryption = false` is already set in `app.json`. Answer: uses encryption but exempt.
- **Content rights:** No third-party content.
- **Advertising Identifier (IDFA):** No.
- **Sign in with Apple:** offered (guideline 4.8).
- **Availability:** United States first. Add UK, Canada, Australia later.
- **Pricing:** Free.
- **App Store version release:** Manual release.

---

## 2. Google Play Console

### Store listing
**App name (max 30):** `Beadup: Detailer Bookings` [25]
**Short description (max 80):** `Quotes and bookings for mobile car detailers. Clients book from one link.` [73]
**Full description (max 4000):** use the App Store description above unchanged.
**Category:** Business. **Tags:** Business, Productivity.
**Contact:** email `[SUPPORT EMAIL]`, website `https://beadup.netlify.app`.
**Graphics:** icon 512×512 (render from `apps/mobile/assets/images/icon.png`), feature graphic 1024×500, at least 4 phone screenshots from the real app (same six as Apple).

### App content declarations
| Declaration | Answer |
|---|---|
| Privacy policy | `https://beadup.netlify.app/privacy` |
| App access | Restricted. Add demo credentials: `[DEMO DETAILER EMAIL]`, `[DEMO PASSWORD]` ("Sign in with a password" on the sign-in screen), plus client page `https://beadup.netlify.app/[DEMO HANDLE]` |
| Ads | No ads |
| Content rating (IARC) | Category: Utility / Productivity. No violence, sex, language, controlled substances, gambling, user-to-user sharing. Expected: Everyone |
| Target audience | 18 and over. Not designed for children |
| News app | No |
| COVID-19 app | No |
| Government app | No |
| Financial features | None. Beadup does not process payments, offer loans, banking or crypto. Clients pay detailers directly outside the app |
| Health | No |
| Advertising ID | Not used |
| Data safety | See below |
| Account deletion | In-app path: Settings › Delete account. Web link: `https://beadup.netlify.app/delete-account` |

### Data safety form
**Data collected:** Yes. **Encrypted in transit:** Yes. **Users can request deletion:** Yes (in-app and web link above).

| Data type | Collected | Shared | Purpose | Optional? |
|---|---|---|---|---|
| Name, email address, phone number | Yes | No | App functionality, account management | Required |
| Address (job location) | Yes | No | App functionality | Required |
| Photos | Yes | Yes (OpenAI, with consent) | App functionality | Optional |
| Purchase history (subscription status, bookings) | Yes | No | App functionality | Required |
| User IDs | Yes | No | App functionality | Required |
| Device or other IDs (push token) | Yes | No | App functionality | Optional |
| Financial info | No. Clients pay detailers outside Beadup | | | |
| Location, contacts, messages, files, health, app activity | No | | | |

Notes: Supabase, Netlify, Expo, Cloudflare and RevenueCat act as service providers, which Google doesn't count as "sharing". OpenAI receives photos the user chooses, with consent: declare as shared.

### Permissions declared
Camera and read media images/photo picker only. No location, contacts, SMS or phone permissions.

### Release track
New personal developer accounts must run a **closed test with enough testers for the required period** (currently 12 testers for 14 days: verify the current numbers in Play Console) before requesting production access. Plan 3 weeks for this. Recruit testers from the first detailers.

---

## 3. Payments disclosure (both stores)
- Client → detailer payments: physical services, paid **directly to the detailer outside the app** (their own link or instructions). Beadup processes no client payments. Apple 3.1.3(e) / Google's physical-services exemption apply; no in-app purchase / Play Billing for them.
- Detailer → Beadup Pro subscription: in-app purchase on both stores (section 5).
- If Stripe is switched on later (`payments_mode = "stripe"`), update the description, privacy labels, Data safety and review notes before that build ships.

## 4. Before pressing Submit
Run the checklist in `rules.md` section 8. Also confirm: the demo account works with "Sign in with a password", the demo handle's booking page loads and books, `/privacy`, `/terms`, `/support` and `/delete-account` are live, screenshots come from the real build, the listing text in App Store Connect matches section 1, and the privacy answers above still match what the app actually collects.

## 5. Decided: Pro subscription is in-app purchase on both stores
Owner decision 2026-11-07. Apple treats SaaS subscriptions as digital goods that need in-app purchase (3.1.1, 3.1.2) and Google requires Play Billing, so Pro is sold with **Apple IAP and Google Play Billing at the same price**. This is the lowest review risk. The stores take a commission (small developers are eligible for reduced rates: apply for Apple's App Store Small Business Program and check Google's current service-fee tiers).

Implementation: one auto-renewing subscription `beadup_pro_monthly` in each store, managed through RevenueCat (free at small revenue) so entitlements work across devices (3.1.2(a)). The Free plan (monthly booking limit from `plan_config`) needs no purchase. Show the price, billing period, what is included and how to cancel before the purchase button (3.1.2(c)), plus Restore Purchases and links to Terms and Privacy. The price is never written in the app or this file: it comes from the store.
