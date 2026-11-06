# Beadup

Quote, book and get paid app for solo **mobile car detailers**. Launch market: **USA** (then UK, CA, AU).
Repo: https://github.com/princechakusa/Beadup (public, by owner's choice). **Follow `rules.md`** (Apple/Google policy + security rules) for every feature.

## Product
- **Detailer app** (`apps/mobile`, Expo / React Native): Today dashboard, AI photo quote, calendar, clients, money.
- **Client booking link** (`apps/web`, Next.js 16): `beadup.app/<handle>`. Clients book in the browser, with no app or account. Flow: service → vehicle and add-ons → time → details (SMS consent) → review → pay deposit → "You're booked".
- Deposit 30%. **The client pays a booking fee covering card processing**, so the detailer and Beadup pay $0 (`src/lib/pricing.ts`).
- Receipts are automatic (not AI). AI is only used for photo → suggested quote, which the detailer approves.
- Pro plan $19/mo. Detailers subscribe on the web (allowed on the US App Store, see rules.md section 1).

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
- [ ] Rename add-on to "Pet hair removal (seats and carpets)"
- [ ] Premium pass: Skia-style glass bead on web (SVG/WebGL refraction), haptic-like micro-interactions, sound on "booked" (respect reduced motion)
### M2: Backend
- [ ] Supabase schema as SQL migrations in `supabase/migrations`: detailers, services, add_ons, availability, bookings, clients, payments, quotes, audit_log. **RLS default-deny on every table** + tests proving tenant isolation
- [ ] 🔑 Connect a real Supabase project (owner: free account → URL + anon key + service role key)
- [ ] Replace `src/lib/demo.ts` with DB reads. Proper 404 status for unknown handles
- [ ] Server-side booking creation (Zod-validated server action), slot double-booking protection, rate limiting, Turnstile
### M3: Payments
- [ ] Stripe Connect integration (Express accounts, "Stripe handles pricing"), deposit Checkout / Payment Element, client booking fee, idempotent signature-verified webhooks, refunds/cancellation policy
- [ ] 🔑 Stripe test keys from owner
- [ ] Balance payment link after job, automatic receipts (email + SMS)
### M4: Detailer mobile app (`apps/mobile`, Expo)
- [ ] Theme + design tokens, Sora/Inter, dark glass components, Skia liquid bead logo (wobble, tilt reflections), haptics
- [ ] Auth: Sign in with Apple + email magic link, secure session storage
- [ ] Screens from the design canvas: Today, Calendar, New quote (AI photo), Clients, Money, Paid + review, Settings (services/prices/availability, booking link share, **account deletion**)
- [ ] Push notifications (optional, works without), offline schedule cache
- [ ] Onboarding: business name, handle, services, prices, Stripe Connect onboarding link
### M5: AI quote
- [ ] Server endpoint: photos (system picker, EXIF stripped, private bucket) → Claude vision → itemized suggested quote from the detailer's own price list. Reject non-vehicle images. Detailer approves before sending. Third-party AI consent screen (Apple 5.1.2(i))
- [ ] 🔑 Anthropic API key
### M6: Messaging
- [ ] SMS confirmations, day-before reminders, review request (Twilio), STOP handling, consent logging
- [ ] 🔑 Twilio account + 10DLC registration
### M7: Business pages and subscriptions
- [ ] Marketing landing page (premium, animated), pricing, privacy policy, terms, support, `/delete-account`
- [ ] Pro subscription ($19/mo) on the web via Stripe Billing. Free plan limit of 5 bookings/month
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
- Unknown handles render not-found but return HTTP 200 under streaming. Revisit when the DB lands.
- CSP still allows `'unsafe-inline'` scripts. Move to nonces before launch.
