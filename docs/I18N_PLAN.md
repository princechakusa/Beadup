# Translations plan (written 2026-11-16)

## Status 2026-11-16
- DONE (web): infrastructure in `apps/web/src/lib/i18n/` (typed catalogs `en/es/fr/pt`, `negotiate()` from Accept-Language or the `bd_lang` cookie, `fmt()`, `I18nProvider`/`useI18n`), the client booking flow and the confirmation screen are translated into Spanish, French and Portuguese (dates follow the language; trade wording via `phrases`). Tests: `i18n.test.ts` (every key, same placeholders) and `e2e/i18n.spec.ts`.
- Drafts are machine-assisted: a native speaker must review before launch.
- NOT done: `/b/<token>` manage page, `/[handle]/booked`, the review form, emails, the mobile app, Arabic (right-to-left), localized store listings, marketing pages.


## Languages
- **Wave 1:** Spanish, French, Portuguese. Wave 2: Arabic with right-to-left layout (UAE is a launch country). Afrikaans dropped: English already works in South Africa.
- No store policy blocks any of these. Rules: the app and the store listing must match the language they are shown in; privacy policy, terms and the account deletion page can stay English at first but must be linked from each localized listing; no machine-translated legal text without a native review.

## Mobile (Expo)
- `expo-localization` for the device language; `src/lib/i18n/` with one catalog per language (`en.ts` is the source of truth, typed keys, so a missing key is a compile error) and a tiny `t(key, vars)` plus plural helper. No heavy library needed.
- Extract strings screen by screen: about 7,500 lines of UI today, roughly 900 strings. Order: tabs and Today, booking/new quote, clients, money, settings, onboarding, paywall, errors.
- Keep in English: brand name Beadup, plan name Pro, currency codes, the legal links, anything the server returns (service names the business typed).
- Arabic: `I18nManager.allowRTL(true)` and `forceRTL` need a native rebuild, so RTL ships with a store build, not OTA. Spanish, French and Portuguese catalogs are JS only (OTA safe).
- Dates and money already use `Intl` with the country; locale for dates should follow the device language, currency stays the business's country.

## Web (Next.js, nonce CSP)
- Pick the language per request on the server: `?lang=` then a cookie then `Accept-Language`. The page renders per request already, so no inline script is needed.
- Catalogs in `src/lib/i18n/messages/<lang>.ts`; server components call `t()`, client components (BookingFlow, ManageBooking, BookedCelebration) receive the messages for their page as a prop. About 350 strings in the client booking flow (about 1,750 lines).
- `<html lang>` and `dir` set from the language; add `hreflang` alternates for the marketing pages only. Booking pages are per business, so the client's browser language decides.
- Keep English: legal pages, admin, blog guides (wave 2 for guides).
- Emails (Brevo outbox) and the receipt need the same catalogs; store the client's language on the booking.

## Store listings
- App Store Connect and Play Console: localized name (keep Beadup), subtitle, description, keywords, screenshots with translated captions (generate from the same device frames).

## Estimate
- Infrastructure plus English extraction: 2 days. Each language: 1 day for AI draft plus 0.5 day review pass. RTL: 2 days (layout audit, icons that must flip, number alignment) plus a store build. Store listings: 0.5 day per language.
- Total: about 9 working days for ES, FR, PT, AR.

## First slice when started
1. Web client booking flow in Spanish, French and Portuguese (the highest value: a client in Madrid or Lisbon sees their language).
2. Mobile infrastructure plus tabs, Today and the booking sheet.
3. Everything else, then Arabic.
