# Beadup: store submission answers

Ready-to-paste answers for **App Store Connect** and **Google Play Console**. Written against `rules.md`.
Items in `[BRACKETS]` need a real value before submitting. Re-check Apple's and Google's current forms on submission day: the questions change.

**Status (2026-11-07):** Apple developer account exists (owner is signed in to App Store Connect). **Nothing is submitted.** Google Play account not yet created.

### App Store Connect progress
Done in the owner's account:
- [x] Bundle ID `com.beadup.app` registered (capabilities: In-App Purchase, Sign In with Apple)
- [x] App record "Beadup" created (Apple ID 6831768099, SKU `beadup-ios-001`, English U.S., iOS)
- [x] Version 1.0: description, keywords, promotional text entered and saved
- [x] App Information: subtitle, categories Business + Productivity, Content Rights = no third-party content
- [x] Age rating questionnaire: all "None/No" → **4+**
- [ ] App Privacy labels (section 1 table) and Privacy Policy URL: needs the live domain
- [ ] Support URL, Marketing URL, Copyright: needs domain and legal name
- [ ] App Review info: demo account, contact, review notes (section 1)
- [ ] Pricing and availability: Free, United States first
- [ ] Screenshots (6.9" iPhone): from the real build
- [ ] In-App Purchase: create subscription `beadup_pro_monthly`. **Price is set only here (and per country) and must never be hardcoded in the app**
- [ ] 🔑 Apple banner: the **Account Holder must accept the updated Apple Developer Program License Agreement** before new apps can be submitted. Also the EU trader status declaration if distributing in the EU
- [ ] Upload a build (EAS) and submit for review

---

## 0. Values used everywhere

| Item | Value |
|---|---|
| App name | Beadup |
| Bundle ID / package | `com.beadup.app` (permanent once published. Confirm before the first upload) |
| Primary category | Business |
| Secondary category (Apple) | Productivity |
| Price | Free to download. Pro plan sold on the web (see section 5) |
| Support email | `[SUPPORT EMAIL]` |
| Support URL | `https://[DOMAIN]/support` |
| Marketing URL | `https://[DOMAIN]` |
| Privacy policy URL | `https://[DOMAIN]/privacy` |
| Terms URL | `https://[DOMAIN]/terms` |
| Account deletion URL | `https://[DOMAIN]/delete-account` |
| Copyright | `© 2026 [OWNER OR COMPANY NAME]` |
| Audience | Adults 18+. Not for children |

---

## 1. App Store Connect

### Listing text
**Name (max 30):** `Beadup`
**Subtitle (max 30):** `Quotes, bookings, payments`
**Promotional text (max 170):**
`Send a priced quote from your phone, take a deposit before you drive out, and get paid the same day. Built for mobile detailers.`

**Keywords (max 100, comma separated, no spaces):**
`detailing,car wash,booking,quote,invoice,scheduler,deposit,mobile detailer,appointments,clients`

**Description (max 4000):**
```
Beadup is the quote, booking and payment app built for mobile car detailers.

QUOTE IN 60 SECONDS
Take photos of the vehicle and Beadup suggests an itemized price from your own price list. You review and approve every quote before it is sent.

STOP NO-SHOWS
Clients book through your personal link and pay a deposit up front. The card fee is added at checkout, so you receive the full deposit.

ONE LINK, NO APP FOR CLIENTS
Put your link in your Instagram bio or text it to customers. They pick a service and a time, and pay from their browser. No download, no account.

RUN YOUR DAY
See today's jobs, get directions to the next one, text or call the client, and mark jobs done. Receipts are sent automatically.

KNOW YOUR NUMBERS
Track earnings, payouts and your best clients in one place.

PRIVACY
Photos you choose for a quote are sent to a third-party AI service only after you give permission. Card details are handled by our payment provider and never stored by Beadup. You can delete your account and data in the app at any time.
```

**What's New (1.0):** `First release.`

### Screenshots (required: 6.9" iPhone, 1290×2796)
Use real app screens, not splash or login only (guideline 2.3.3). Order: 1 Today, 2 AI photo quote, 3 Calendar, 4 Money, 5 Clients, 6 Client booking page (browser). Source designs: the design canvas. Capture from the real build before submitting.

### Age rating questionnaire
Answer **None / No** to every item: violence, sexual content, profanity, horror, alcohol/tobacco/drugs, gambling, contests, medical info, unrestricted web access, user-generated content, messaging between users, ads, in-app controls. Expected rating **4+**.
Re-check: if reviews or user messaging are added later, answer again.

### App Privacy ("nutrition label")
**Tracking:** No. Beadup does not track users across other companies' apps or sites. No tracking permission prompt.

Data **collected and linked to the user**, all for **App Functionality** only (not advertising, not analytics unless added):

| Apple data type | Collected? | Why |
|---|---|---|
| Contact info: name, email, phone | Yes | Account, client records, confirmations |
| Contact info: physical address | Yes | Where to do the job (clients' addresses entered by the detailer or the client) |
| User content: photos | Yes | Vehicle photos for price quotes |
| Purchases: purchase history | Yes | Booking and payment records (card numbers are **not** collected by Beadup) |
| Identifiers: user ID | Yes | Account |
| Financial info | No | Handled by Stripe |
| Location | No (until a route feature is added. Update the label if it is) | |
| Health, contacts, browsing history, search history | No | |
| Diagnostics | No (change to Yes if crash reporting is added) | |

Third parties that receive data: Stripe (payments), Twilio (text messages), Anthropic (vehicle photos for quotes, with explicit in-app consent: guideline 5.1.2(i)), Supabase (hosting, acts as processor).

**Update 2026-11-07 (features added since this table):** optional booking alerts store an Expo push token per device. Declare **Identifiers: device ID = Yes** (App Functionality, linked to the user) in App Store Connect and **Device or other IDs = Yes** in Play Data safety. Add **Expo** (push delivery) and **Cloudflare** (Turnstile bot check on booking pages) to the third-party list. The live privacy policy at `/privacy` already lists them.

**Owner decision 2026-11-07: AI photo quotes use OpenAI** (`plan_config.ai_provider = "openai"`). Wherever this file says Anthropic for vehicle photos, declare **OpenAI** instead.

**Owner decision 2026-11-07: launch without text messages.** While `plan_config.sms_enabled` is false no data goes to Twilio, so do not list Twilio as a recipient or declare SMS. Clients get Stripe email receipts; detailers get push alerts. Update both store forms and `/privacy` when texts are turned on.

### App Review information
**Sign-in required:** Yes. Provide two demo accounts and keep the backend live:
- Detailer: `[DEMO DETAILER EMAIL]` / sign-in link or password `[ ]`
- Client booking page needs no account: `https://[DOMAIN]/marcus`

**Contact:** `[NAME]`, `[PHONE]`, `[EMAIL]`

**Notes for Review (paste):**
```
Beadup is a business tool for mobile car detailers (physical, on-site vehicle cleaning).

HOW TO TEST
1. Sign in with the demo detailer account. The Today screen shows jobs and earnings.
2. Tap + to create a quote. Pick photos (system picker). Before any photo leaves the device the app shows an AI disclosure and asks for permission. The quote is a suggestion the detailer edits and approves.
3. Open https://[DOMAIN]/marcus in Safari to see the client booking page (no account needed). It uses Stripe test mode for the review build: card 4242 4242 4242 4242, any future date, any CVC.

PAYMENTS (guideline 3.1.3(e))
Clients pay detailers for physical services consumed outside the app, so those payments use card/Apple Pay through Stripe, not in-app purchase. The client pays a small card-processing fee at checkout.

DETAILER SUBSCRIPTION
Beadup Pro is an auto-renewing subscription purchased with in-app purchase. Use a sandbox Apple ID to test the purchase and Restore Purchases. Client payments for detailing services are separate (physical services, guideline 3.1.3(e)).

ACCOUNT DELETION (5.1.1(v))
Settings › Delete account removes the account and its data in the app. Web: https://[DOMAIN]/delete-account

AI (5.1.2(i))
Vehicle photos are sent to a third-party AI provider (Anthropic) only after the user taps Allow on a consent screen. Quotes are never charged automatically.

PERMISSIONS
Camera and photo picker are used only when the user adds vehicle photos. Notifications are optional and the app works without them. Text messages to clients require their opt-in at booking, with STOP to opt out.
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
**App name (max 30):** `Beadup: Detailer Bookings`
**Short description (max 80):** `Quote, book and get paid from your phone. Built for mobile car detailers.`
**Full description (max 4000):** use the App Store description above, with the last paragraph unchanged.
**Category:** Business. **Tags:** Business, Productivity.
**Contact:** email `[SUPPORT EMAIL]`, website `https://[DOMAIN]`.
**Graphics:** icon 512×512 (render from `apps/mobile/assets/images/icon.png`), feature graphic 1024×500, at least 4 phone screenshots from the real app.

### App content declarations
| Declaration | Answer |
|---|---|
| Privacy policy | `https://[DOMAIN]/privacy` |
| App access | Restricted. Add demo credentials: `[DEMO DETAILER EMAIL]`, `[ ]`, plus client page `https://[DOMAIN]/marcus` |
| Ads | No ads |
| Content rating (IARC) | Category: Utility / Productivity. No violence, sex, language, controlled substances, gambling, user-to-user sharing. Expected: Everyone |
| Target audience | 18 and over. Not designed for children |
| News app | No |
| COVID-19 app | No |
| Government app | No |
| Financial features | Complete the declaration. Beadup does not offer loans, banking or crypto. It facilitates payments for physical services through a third-party processor. Pick the options that match at submission and re-read Google's current wording |
| Health | No |
| Advertising ID | Not used |
| Data safety | See below |
| Account deletion | In-app path: Settings › Delete account. Web link: `https://[DOMAIN]/delete-account` |

### Data safety form
**Data collected:** Yes. **Encrypted in transit:** Yes. **Users can request deletion:** Yes (in-app and web link above).

| Data type | Collected | Shared | Purpose | Optional? |
|---|---|---|---|---|
| Name, email address, phone number | Yes | Yes (Twilio sends texts, Stripe handles payments) | App functionality, account management | Required |
| Address (job location) | Yes | No | App functionality | Required |
| Photos | Yes | Yes (AI provider, with consent) | App functionality | Optional |
| Purchase history (bookings and payments) | Yes | Yes (Stripe) | App functionality | Required |
| User IDs | Yes | No | App functionality | Required |
| Financial info (card numbers) | No. Entered only on Stripe's hosted fields | | | |
| Location | No (update if a route feature is added) | | | |
| Contacts, messages, files, health, app activity, device IDs | No | | | |

Notes: data processed by Supabase for hosting is a service provider, not "sharing". Mark Stripe, Twilio and the AI provider as shared where Google's definition applies.

### Permissions declared
Camera and read media images/photo picker only. No location, contacts, SMS or phone permissions.

### Release track
New personal developer accounts must run a **closed test with enough testers for the required period** (currently 12 testers for 14 days: verify the current numbers in Play Console) before requesting production access. Plan 3 weeks for this. Recruit testers from the first detailers.

---

## 3. Payments disclosure (both stores)
- Client → detailer payments: physical services. Apple 3.1.3(e) and Google's physical-services exemption apply. No in-app purchase / Play Billing.
- Detailer → Beadup Pro subscription: see section 5.

## 4. Before pressing Submit
Run the checklist in `rules.md` section 8. Also confirm: Stripe is out of test mode for the production build, demo accounts work, `/privacy`, `/terms`, `/support` and `/delete-account` are live, screenshots come from the real build, and the privacy answers above still match what the app actually collects.

## 5. Decided: Pro subscription is in-app purchase on both stores
Owner decision 2026-11-07. Apple treats SaaS subscriptions as digital goods that need in-app purchase (3.1.1, 3.1.2) and Google requires Play Billing, so Pro ($19/month) is sold with **Apple IAP and Google Play Billing at the same price**. This is the lowest review risk. The stores take a commission (small developers are eligible for reduced rates: apply for Apple's App Store Small Business Program and check Google's current service-fee tiers).

Implementation: one auto-renewing subscription `beadup_pro_monthly` in each store, managed through RevenueCat (free at small revenue) so entitlements work across devices (3.1.2(a)). The Free plan (5 bookings a month) needs no purchase. Show the price, billing period, what is included and how to cancel before the purchase button (3.1.2(c)), plus Restore Purchases and links to Terms and Privacy.

Paste into the review notes in section 1: `DETAILER SUBSCRIPTION: Beadup Pro is an auto-renewing subscription purchased with in-app purchase. Use a sandbox Apple ID to test. Client payments for detailing services are separate (physical services, guideline 3.1.3(e)).`
