# Going live (Netlify free + Supabase + TestFlight)

Owner decisions 2026-11-07: host on **Netlify free** (commercial use allowed), free
`*.netlify.app` address until a domain is bought, launch without SMS.

## 1. Netlify site (owner, ~5 minutes)
1. netlify.com → Sign up with GitHub → "Add new project" → "Import an existing project" →
   GitHub → `princechakusa/Beadup`. Netlify reads `netlify.toml` (base `apps/web`), so
   leave the build settings as they are.
2. Site name: `beadup` (gives `https://beadup.netlify.app`). If taken, pick another and tell
   Claude Code: the app's `EXPO_PUBLIC_API_URL` in `apps/mobile/eas.json` must match.
3. Before the first deploy, add these under Site configuration → Environment variables.
   Secrets are pasted there only, never in chat or in git.

| Variable | Value | Needed for |
|---|---|---|
| `NEXT_PUBLIC_SITE_URL` | `https://beadup.netlify.app` | links in receipts, reviews |
| `NEXT_PUBLIC_SUPABASE_URL` | `https://bczhuwibozwsynrlfqrq.supabase.co` | everything |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase → Settings → API Keys → publishable key | everything |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → API Keys → secret key (**secret**) | bookings, payments, deletion |
| `CRON_SECRET` | 40 random characters (**secret**) | reminders, refund retries |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET_KEY` | Cloudflare dashboard → Turnstile → add site `beadup.netlify.app` (free) | **booking form (fails closed without them)** |
| `OPENAI_API_KEY` (**secret**) | platform.openai.com | AI photo quotes |
| `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_CONNECT_WEBHOOK_SECRET` (**secret**) | Stripe, test mode first | deposits, payouts |
| `REVENUECAT_SECRET_KEY`, `REVENUECAT_WEBHOOK_AUTH` (**secret**) | RevenueCat | Pro plan |
| `EXPO_ACCESS_TOKEN` (**secret**, optional) | expo.dev → Access tokens | push alerts |
| `NEXT_PUBLIC_LEGAL_NAME`, `NEXT_PUBLIC_SUPPORT_EMAIL` | your business name and support email | privacy policy, terms |

| `NEXT_PUBLIC_APP_STORE_URL` (optional) | the App Store listing URL once the app is live | website "Download on the App Store" buttons (until set they say "Coming soon") |

Not needed while texts are off: `TWILIO_*`. The 15-minute job is
`apps/web/netlify/functions/cron-messages.mts` (runs on its own once `CRON_SECRET` is set).

### Security headers and the CSP (no action needed)
- `npm run build` runs `next build` and then `scripts/verify-csp.mjs`, which fails the deploy if a
  prerendered page shell would need `'unsafe-inline'`. If a Next/React upgrade trips it, the
  message names the new inline script; add its hash to `src/lib/csp-hashes.json` only if it is a
  framework constant (see `docs/SECURITY_REVIEW.md`).
- Every page is rendered per request (for the CSP nonce) but data is still cached, so a change in
  `plan_config` (Pro price, free booking limit) shows on the website within the cache lifetime
  (about an hour) **without a redeploy**, as before. `NEXT_PUBLIC_*` values (site URL, App Store
  URL, legal name, support email) are build-time and need a redeploy.
- After a deploy, check https://developer.mozilla.org/en-US/observatory and
  https://securityheaders.com: both should show A+.

## 2. Supabase dashboard (owner, production project)
- Authentication → URL Configuration: Site URL `https://beadup.netlify.app`; Redirect URLs
  `beadup://auth/callback` and (for Expo Go testing) `exp://**`.
- Email: Supabase only lets you edit templates **after custom SMTP is set up**, and its built-in sender
  only delivers to members of your Supabase team. So until custom SMTP exists, email sign-in works for the
  owner (testing) but **not for real detailers**. iPhone detailers use Sign in with Apple (no email
  needed); App Review uses the password demo account. Before Android or any email users: set up custom
  SMTP (needs a sending domain, e.g. Resend's free tier once a domain is bought), then paste
  `supabase/templates/magic_link.html` (adds the 6-digit code) with subject `Your Beadup sign-in`.
- Authentication → Sign In / Providers → Apple: enable, Client IDs `com.beadup.app`.
- Before real users: custom SMTP (the built-in sender allows only a few emails per hour).
- App Review account: Authentication → Users → Add user → email + password, "Auto confirm".
  Sign in once in the app to complete onboarding, then give those details to Apple in
  App Store Connect → App Review Information. Never commit the password.

## 3. Stripe webhooks (after keys exist)
Endpoint `https://beadup.netlify.app/api/stripe/webhook`, added twice in Stripe → Developers →
Webhooks: once for "Your account" and once for "Connected accounts". Events:
`checkout.session.completed`, `checkout.session.async_payment_succeeded`,
`checkout.session.async_payment_failed`, `checkout.session.expired`, `charge.refunded`,
`account.updated`. Each endpoint's signing secret goes in its own variable above.

## 4. TestFlight (owner runs, Claude Code prepares)
```
cd apps/mobile
npx eas-cli@latest build --platform ios --profile production
npx eas-cli@latest submit --platform ios --latest
```
EAS asks you to sign in to your Apple Developer account and creates the certificates.
Put the App Store Connect app id into `apps/mobile/eas.json` (`submit.production.ios.ascAppId`).
Builds use the live Supabase project and the API at `EXPO_PUBLIC_API_URL` (public values only).
