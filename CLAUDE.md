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

## Status
- [x] Scaffold, rules.md, security headers (`apps/web/next.config.ts`)
- [x] Web booking flow UI with demo data (`/marcus`). Payment is stubbed.
- [ ] Supabase schema + RLS, real detailer data
- [ ] Stripe Connect deposit checkout + webhooks
- [ ] Detailer mobile app screens
- [ ] AI photo quote endpoint
- [ ] Twilio SMS, receipts, reminders
- [ ] Landing page, privacy, terms, account deletion page

## Notes
- `apps/web` uses Next.js 16 with Cache Components. Read `node_modules/next/dist/docs/` before using Next APIs.
- Unknown handles render not-found but return HTTP 200 under streaming. Revisit when the DB lands.
- CSP still allows `'unsafe-inline'` scripts. Move to nonces before launch.
