# Beadup: Build Rules

Every feature must pass this file before it ships. Sources were fetched on 2026-11-06:
- Apple App Review Guidelines: https://developer.apple.com/app-store/review/guidelines/
- Google Play Payments: https://support.google.com/googleplay/android-developer/answer/9858738
- Google Play Account deletion: https://support.google.com/googleplay/android-developer/answer/13327111
- Google Play AI-generated content: https://support.google.com/googleplay/android-developer/answer/14094294

Re-check these pages before each store submission. The policies change.

---

## 1. Payments (the most common rejection reason)

| Money flow | Rule | What we do |
|---|---|---|
| Customer pays the detailer for a detail | Apple 3.1.3(e): physical services consumed outside the app **must not** use in-app purchase. Google Play exempts physical services (it names "cleaning services"). | Card / Apple Pay / Google Pay through the payment processor. Never IAP. |
| Detailer pays Beadup for Pro | Apple 3.1.1 and 3.1.2: SaaS subscriptions sold in the app need IAP. Google Play: business software needs Play Billing unless an exception applies. | **Option A (default):** the app has no purchase screen. Detailers subscribe on beadup.app (web). On the **US storefront only**, Apple 3.1.3 allows linking to an outside purchase method. **Option B:** offer IAP too, priced the same. If web purchases unlock features in the app, Apple 3.1.3(b) requires the same subscription to be buyable as IAP. |
| Android, Pro subscription | Google may not allow steering to web. | Android app ships with Play Billing for Pro, or as a free companion with sign-in only (no "buy" link or text). Decide before the Android submission. |

- Subscriptions must last at least 7 days and work on all of the user's devices (3.1.2(a)).
- Before the purchase, state clearly what the user gets for the price (3.1.2(c)).
- Never use license keys or codes to unlock features (3.1.1).
- Recurring plans sold through Apple Pay must show the renewal term, what is included, the price and how to cancel (4.9).

## 2. Accounts and login
- **Account deletion in the app** (Apple 5.1.1(v), Google User Data), in Settings › Account › Delete account. It deletes the account and its data, with only legally required records kept and disclosed in the privacy policy.
- **Web deletion page** at beadup.app/delete-account, linked in the Play Console Data safety form.
- If we offer Google sign-in, we must also offer an equivalent private option (Apple 4.8). We ship **Sign in with Apple + email magic link**.
- App review needs **demo accounts** (detailer and customer) and a **live backend** (2.1(a)). Write the review notes in specific detail (2.3.1(a)).

## 3. Privacy and data
- Privacy policy linked in the store listing **and** inside the app (5.1.1(i)).
- **Third-party AI:** before customer photos go to the AI provider, show a clear disclosure and get explicit consent (Apple 5.1.2(i)). Name the provider in the privacy policy.
- Photos: use the system photo picker, never full library access (5.1.1(iii)).
- Location: only for directions and travel radius. Explain why before asking, and always allow manual address entry (5.1.1(iv), 5.1.5).
- Paid features must never depend on granting a permission (5.1.1(ii)).
- No repurposing data, no profiling, and no messaging a user's contacts (5.1.2).
- Fill in Apple Privacy Nutrition Labels and the Google Data safety form accurately. Update them whenever data use changes.

## 4. Notifications and messages
- The app must work fully with push turned off (4.5.4).
- Booking and payment alerts are fine. **Marketing pushes and texts need explicit opt-in and an opt-out in the app.**
- Text messages to customers: get consent at booking, include "Reply STOP to opt out" and follow US TCPA rules and 10DLC registration (Twilio).

## 5. Content and AI
- AI quotes are **suggestions the detailer approves** and are labelled as estimates. Never auto-charge from an AI price.
- Content sent to the AI is filtered. Reject non-vehicle images.
- No offensive generated content (Google AI policy).
- Reviews and photos from users: offer report, block and filtering, and publish contact info (Apple 1.2). Never manipulate ratings.

## 6. Store listing
- Screenshots show the real app in use, not only a splash or login screen (2.3.3).
- No prices or keyword stuffing in the name or subtitle, and no mention of other platforms (2.3.7, 2.3.10).
- Category: **Business**. Answer the age rating questions honestly.
- A support contact link is required in the app and in the listing (1.5).
- One multi-tenant app for all detailers. **Never** a white-labelled app per shop (4.2.6).
- The app must offer more than a wrapped website (4.2): native camera, animations, offline schedule and push.

## 7. Security (maximum, non-negotiable)
- **Card data never touches our servers.** Use only the processor's hosted fields or checkout (PCI SAQ-A).
- **Supabase Row Level Security on every table**, default deny, with tests that prove one detailer can't read another's data.
- Secrets (processor, AI and SMS keys) live **only** in server functions, never in the app bundle or `NEXT_PUBLIC_*`.
- Verify every webhook signature, and make handlers idempotent.
- Validate all input with Zod at the server boundary. Use parameterized queries only.
- Rate limits on auth, booking, quote and AI endpoints. Bot protection (Turnstile) on the public booking page.
- Sessions in secure storage (Keychain / Keystore via expo-secure-store). Short-lived access tokens and refresh token rotation.
- HTTPS only, HSTS, strict CSP, secure headers, no inline secrets.
- Uploads: type and size checks, EXIF/GPS stripped, private buckets, signed URLs that expire.
- Dependency scanning (npm audit and Dependabot), secret scanning in CI, and lockfiles committed.
- Audit log of money and account events. Least-privilege service roles.
- Pre-launch: OWASP MASVS / ASVS checklist pass and a security review of every PR that touches auth or payments.

## 8. Before every submission
- [ ] Demo accounts work, and the backend is up
- [ ] Account deletion works in the app and on the web
- [ ] Privacy policy, terms and support URL are live
- [ ] Privacy labels and Data safety are up to date
- [ ] No in-app purchase button for physical services, and the Pro purchase path follows section 1
- [ ] Push and location permissions are optional, with clear explanations
- [ ] The AI disclosure and consent screen is present
- [ ] Screenshots come from the real build
