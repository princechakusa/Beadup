# Beadup

Quote, book and get paid app for solo **mobile car detailers**. Launch market: **USA** (then UK, CA, AU).
Repo: https://github.com/princechakusa/Beadup (public, by owner's choice). **Follow `rules.md`** (Apple/Google policy + security rules) for every feature.

## Product
- **Detailer app** (`apps/mobile`, Expo / React Native): Today dashboard, AI photo quote, calendar, clients, money.
- **Client booking link** (`apps/web`, Next.js 16): `beadup.app/<handle>`. Clients book in the browser, with no app or account. Flow: service → vehicle and add-ons → time → details (SMS consent) → review → pay deposit → "You're booked".
- Deposit 30%. **The client pays a booking fee covering card processing**, so the detailer and Beadup pay $0 (`src/lib/pricing.ts`).
- Receipts are automatic (not AI). AI is only used for photo → suggested quote, which the detailer approves.
- Pro plan, bought in the app via in-app purchase on both stores (owner decision 2026-11-07, see M7). Price lives in the stores and `plan_config`, never in code.

## Decisions (approved by owner)
- Name **Beadup**. Palette: Midnight #0A0C10, Gunmetal #161A21, Bead Blue #4DD8FF, Carnauba Gold #FFB547 (money only), Paint White #F4F6FA, Brushed Steel #9AA3B2. Fonts: Sora (display), Inter (body).
- Look: **premium, modern, dark glass**. No emoji, no dated or flat blocks. Use line icons, glows, springs and liquid "bead" physics.
- Design canvas: https://claude.ai/artifact/JfVNr6DwF6s9KdZiRYBdqE
- Payments: **Stripe** (US, free to open, no monthly fee). Connect with "Stripe handles pricing" so the platform pays no Connect fees.
- Stack: Expo + Reanimated + Skia (mobile motion), Next.js + Motion (web), Supabase (DB/auth with RLS), Stripe, Twilio, Claude API for quotes.

## How to work (owner's standing instruction)
**Keep building until the app is finished. Do not stop after one task.** Work through the roadmap below in order. After each milestone: build + lint + test, commit, push, tick the box here, then move straight to the next one.
- If a step needs something only the owner can provide (marked 🔑), **skip it, build everything around it with mocks/env placeholders, and keep going**. List all blockers together in your final message, not one at a time.
- Only stop when every non-🔑 box is ticked, or to ask about a real product decision.
- Never commit secrets. Keys go in `.env.local` (git-ignored).
- Ask before anything outward-facing: sending emails/messages, publishing to stores, spending money.
- Keep the premium bar: dark glass, springs, liquid bead motion, line icons, no emoji.

## Roadmap
### M1: Web booking (client side)
- [x] Scaffold, rules.md, security headers (`apps/web/next.config.ts`)
- [x] Booking flow UI with demo data (`/marcus`). Payment is stubbed.
- [x] Rename add-on to "Pet hair removal (seats and carpets)"
- [x] Premium pass: Skia-style glass bead on web (SVG/WebGL refraction), haptic-like micro-interactions, sound on "booked" (respect reduced motion)
### M2: Backend
- [x] Supabase schema as SQL migrations in `supabase/migrations`: detailers, services, add_ons, availability, bookings, clients, payments, quotes, audit_log. **RLS default-deny on every table** + tests proving tenant isolation
- [ ] 🔑 Connect a real Supabase project (owner: free account → URL + anon key + service role key)
- [x] Replace `src/lib/demo.ts` with DB reads. Proper 404 status for unknown handles
- [x] Server-side booking creation (Zod-validated server action), slot double-booking protection, rate limiting, Turnstile
### M3: Payments
- [x] Stripe Connect integration (Express accounts, "Stripe handles pricing"), deposit Checkout / Payment Element, client booking fee, idempotent signature-verified webhooks, refunds/cancellation policy (built and tested with signed local events; run one real test-mode checkout once keys exist)
- [ ] 🔑 Stripe test keys from owner
- [x] Balance payment link after job, automatic receipts (email + SMS) (email via Stripe receipts; SMS via outbox, sends once Twilio keys exist)
### M4: Detailer mobile app (`apps/mobile`, Expo)
- [x] Theme + design tokens, Sora/Inter, dark glass components, Skia liquid bead logo (wobble, tilt reflections), haptics
- [x] Auth: Sign in with Apple + email magic link (no Google sign-in, owner's decision), secure session storage (email flows tested end to end on local Supabase; Apple needs a device + Apple Developer account)
- [x] Screens from the design canvas: Today, Calendar, New quote (AI photo), Clients, Money, Paid + review, Settings (services/prices/availability, booking link share, **account deletion**) (review request text ships with M6; AI photo scan with M5; Apple token revoke on deletion needs the Apple key)
- [x] Push notifications (optional, works without), offline schedule cache (token registration activates once an EAS project ID exists)
- [x] Onboarding: business name, handle, services, prices, Stripe Connect onboarding link
### M5: AI quote
- [x] Server endpoint: photos (system picker, EXIF stripped, private bucket) → Claude vision → itemized suggested quote from the detailer's own price list. Reject non-vehicle images. Detailer approves before sending. Third-party AI consent screen (Apple 5.1.2(i)) (dev uses a flagged sample suggestion; the live Claude call runs once ANTHROPIC_API_KEY is set)
- [ ] 🔑 Anthropic API key
### M6: Messaging
- [x] SMS confirmations, day-before reminders, review request (Twilio), STOP handling, consent logging (sends once Twilio keys and 10DLC exist)
- [ ] 🔑 Twilio account + 10DLC registration. **OWNER DECISION 2026-11-07: launch without texts** ($0 start; Twilio trial accounts can't register A2P and the owner isn't a US resident, so Sole Proprietor brands don't apply). `plan_config.sms_enabled = false` hides the SMS consent box and text copy; clients get Stripe email receipts, detailers get push. Flip to true after Twilio + 10DLC (Standard brand with home-country business registration) or toll-free verification
### M7: Business pages and subscriptions
- [x] Marketing landing page (premium, animated), pricing, privacy policy, terms, support, `/delete-account` (policies written to match the code; have a lawyer review; set `NEXT_PUBLIC_LEGAL_NAME` and `NEXT_PUBLIC_SUPPORT_EMAIL`)
- [x] Pro subscription ($19/mo) via **in-app purchase on both stores** (Apple IAP + Google Play Billing, same price, via RevenueCat). OWNER DECISION 2026-11-07: no web checkout or "buy on web" links in the app. Free plan limit of 5 bookings/month. Paywall shows price, period, features, cancel info, Restore Purchases, Terms/Privacy links (Apple 3.1.2)
- [x] **Never hardcode the Pro price.** The owner will lower it later. Price lives only in App Store Connect / Play Console (set per country there). The app displays the store's localized price string (`product.priceString` via RevenueCat), the free-plan limit and any plan limits come from a config table/remote config, not constants. Marketing copy on the website reads from config too
- [ ] 🔑 App Store Connect + Play Console: create the `beadup_pro_monthly` subscription products. Bundle ID / package `com.beadup.app` is FINAL (owner approved 2026-11-07)
### M8: Launch
- [ ] Security review against rules.md section 7 (OWASP ASVS/MASVS), CSP nonces, dependency audit
- [ ] E2E tests (Playwright) for the booking + payment flow
- [ ] 🔑 Domain (beadup.app or getbeadup.com), hosting (Vercel free tier), production keys
- [ ] 🔑 Apple Developer + Google Play accounts. Store listings, screenshots, privacy labels, demo accounts, review notes (rules.md section 8)
- [ ] 3D app icon render (Blender is installed on this PC)
- [ ] Outreach: draft messages to US detailers (owner approves before sending). First 20 get 3 months of Pro free

## Later (after ~100 paying detailers)
Add trades in this order: pressure washing → window cleaning → mobile pet grooming → boat/RV detailing.

## Notes
- `apps/web` uses Next.js 16 with Cache Components. Read `node_modules/next/dist/docs/` before using Next APIs.
- Local DB: `npx supabase start` (Docker), `npx supabase db reset` (migrations + seed), `npx supabase test db` (RLS tests). Every new table needs RLS, explicit grants and tests in `supabase/tests/database/`.
- anon has no table privileges. The public booking page reads only through `get_booking_page(handle)` (security definer). Money, plan, consent, review and audit writes go through server code with the service role.
- Web falls back to `src/lib/demo.ts` when Supabase env vars are unset (dev only; production throws). Booking page data is cached with tag `booking-page:<handle>`; revalidate it when a detailer edits their catalog.
- Real 404s for unknown handles come from `src/proxy.ts` (calls `booking_page_exists`), because a `notFound()` inside the streamed page can only send 200. Any new top-level route must still work with that matcher.
- Bookings: `createBooking` server action (`src/app/[handle]/actions.ts`) → Zod → Turnstile → Postgres rate limit → `create_booking()` (service role). Unpaid holds expire after 30 min. Pricing lives in both `pricing.ts` and SQL (`deposit_cents`, `booking_fee_cents`), same integer math, tested. Turnstile is skipped in dev without keys and fails closed in production.
- Stripe: direct charges on the detailer's Express account (`controller.fees.payer=account`, `losses.payments=stripe`), hosted Checkout, no application fee. Webhook `/api/stripe/webhook` accepts the platform and Connect endpoint secrets; effects + idempotency run in `apply_stripe_event()`. Policy lives in `cancel_booking()`. Failed refunds are logged as `refund.failed` in `audit_log`; add a retry job before launch. Detailer API routes authenticate with `Authorization: Bearer <supabase access token>` (`src/lib/auth.ts`).
- Customer texts go through the `messages` outbox: the DB queues them in the same transaction as the payment, `deliverQueued()` (`src/lib/messages.ts`) sends right after the webhook and from `/api/cron/messages` (Bearer `CRON_SECRET`). It checks consent and opt-out at send time and every text ends with "Reply STOP to opt out." Without Twilio env vars messages are recorded as `skipped`. Email receipts are Stripe's (`receipt_email` set after payment).
- Mobile: tokens in `src/theme/tokens.ts`, UI primitives in `src/components/ui` (Text, GlassCard, Button), `LiquidBead` (Skia, gravity-sensor tilt, Reduce Motion aware), `src/lib/haptics.ts`. React Compiler is on: write Reanimated shared values with `.set()` / read with `.get()`, never `.value`. Lint with `npm run lint` (eslint). Verify JS bundles with `npx expo export --platform ios --no-bytecode` (hermesc crashes on this Windows PC; real builds use EAS).
- Mobile auth: `src/lib/auth.tsx` (AuthProvider, Apple with SHA-256 nonce, PKCE magic link + 6-digit code fallback), session in Keychain/Keystore via chunked `secure-storage.ts`. Routes guarded with `Stack.Protected` in `src/app/_layout.tsx`. Magic link lands on `beadup://auth/callback` (allow-listed in `supabase/config.toml`; template in `supabase/templates/magic_link.html`). For App Review, plan a demo-account sign-in that works without email access (M8).
- Push: opt-in from Settings only (`src/lib/push.ts`), tokens in `push_tokens` (RLS, token is the primary key so it can't be hijacked), removed on sign-out. Server sends via Expo (`apps/web/src/lib/push.ts`) after payment webhooks; dead tokens pruned. Needs `extra.eas.projectId` in app.json (🔑 Expo/EAS account) before tokens can be issued.
- Offline: `useQuery(fn, deps, cacheKey)` saves the last good result in the app's documents folder (`src/lib/cache.ts`) and shows it with an "Offline" chip when the network fails; wiped on sign-out and account deletion.
- Onboarding: `create_detailer_profile()` (one transaction, runs as auth.uid()) + `handle_available()`. The root guard sends signed-in users without a `detailers` row to `/onboarding`; `useAuth().refreshProfile()` flips them into the app.
- AI quote: `POST /api/quotes/ai` (`apps/web/src/lib/ai-quote.ts`): claude-opus-5-5, effort medium, structured output (Zod) + `fallbacks: "default"`; model returns catalog ids only, the server prices from the DB and saves a draft quote via `create_ai_draft_quote()`. Requires `detailers.ai_consent_at` (set by `record_ai_consent()`). Photos: app re-encodes to ≤1568px JPEG (drops EXIF/GPS), private `quote-photos` bucket under `<uid>/`; account deletion removes them. No key: dev returns a flagged mock, production returns 503.
- Messaging (M6): `/api/cron/messages` every 15 min runs `enqueue_due_messages()` (day-before reminders 10:00-20:00 detailer time, review requests ~2h after completion) then delivers. Review links `/r/<48-hex token>` -> `submit_review()` (completed bookings only, once). Twilio Messaging Service inbound URL = `<site>/api/twilio/inbound` (signature-verified; STOP/START -> `record_sms_opt_out()` across all detailers for that phone). Production builds need `NEXT_PUBLIC_SITE_URL` at build time.
- Site: pages `/`, `/pricing`, `/privacy`, `/terms`, `/support`, `/delete-account` (listed in `src/lib/site-pages.ts`, which the proxy lets through; each is also a reserved handle). Plan limits and the marketing price come from `plan_config` via `get_public_config()` (`src/lib/site.ts`), never constants. Web deletion requests land in `deletion_requests` for support to process.
- Pro: `react-native-purchases` (`apps/mobile/src/lib/purchases.ts`, paywall `src/app/pro.tsx`, entitlement id `pro`, app user id = Supabase user id). Server plan comes only from `/api/revenuecat/webhook` (Authorization = `REVENUECAT_WEBHOOK_AUTH`; reads the subscriber from RevenueCat with `REVENUECAT_SECRET_KEY`) -> `apply_subscription_event()` (idempotent, ignores stale events). Free limit enforced in `create_booking()` (`plan_limit`) from `plan_config.free_bookings_per_month`; `plan_usage()` for the app. Seed demo detailer is Pro. Needs a dev/EAS build (native module).
- Accounts (2026-11-07): Expo project `@princechakusa/beadup` (EAS projectId in app.json, owner pinned to `princechakusa`; the owner also has a `businessos1` account). Supabase project ref `bczhuwibozwsynrlfqrq` (org "Beadup", us-west-2, Free), already connected to the GitHub repo; migrations reach it through the GitHub integration's "Deploy to production" (migrations only; auth settings and seed are not synced, so set redirect URLs, Apple provider and the magic-link template in the dashboard). Owner has Apple Developer and Google Play accounts. AI quotes use **OpenAI** (owner decision): provider is `plan_config.ai_provider` (`openai` | `anthropic`); `apps/web/src/lib/ai-quote.ts` calls OpenAI Responses (`OPENAI_MODEL`, default gpt-6-luna, `store: false`) or Claude. Consent is per provider (`detailers.ai_consent_provider`, `ai_consent_status()`), so a provider switch re-asks.
- CSP still allows `'unsafe-inline'` scripts. Move to nonces before launch.
