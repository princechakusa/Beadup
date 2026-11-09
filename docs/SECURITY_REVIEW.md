# Security review: rules.md section 7 (2026-11-07)

Scope: `apps/web` (Next.js 16), `apps/mobile` (Expo SDK 58), `supabase/` (Postgres, RLS, functions).
Method: read every server route, server action and SECURITY DEFINER function; check each rule below
against the code and against automated tests (`npx supabase test db`, 160 pgTAP tests, run in CI).

| Rule (rules.md §7) | Status | Where it's enforced / tested |
|---|---|---|
| Card data never touches our servers (PCI SAQ-A) | Pass | Stripe-hosted Checkout only (`[handle]/actions.ts`, `api/bookings/[id]/balance`). No card fields anywhere. |
| RLS on every table, default deny, tests prove isolation | Pass | Every table has RLS and explicit grants; anon has no table privileges. `rls.test.sql` asserts RLS is on for **all** public tables and that detailer A can't read/write B. Storage: per-user folder policies, tested in `ai_quotes.test.sql`. |
| Secrets only in server code, never in the app bundle or `NEXT_PUBLIC_*` | Pass | Secret modules import `server-only`; no secret names in `.next/static` or client components; mobile ships only the public anon key and RevenueCat public keys (`EXPO_PUBLIC_*`). |
| Verify every webhook signature; idempotent handlers | Pass | Stripe `constructEvent` (two endpoint secrets), Twilio HMAC-SHA1 in constant time, RevenueCat shared secret in constant time, cron Bearer secret in constant time. Idempotency + effects in one transaction (`apply_stripe_event`, `apply_subscription_event`); stale RevenueCat events ignored. |
| Zod at the server boundary; parameterized queries only | Pass | Every route/action parses input with Zod; all DB access is supabase-js / PostgREST or SQL functions with typed parameters. No string-built SQL. |
| Rate limits on auth, booking, quote, AI; Turnstile on the booking page | Pass (auth: owner action) | Postgres limiter (`hit_rate_limit`) on booking, AI quotes, reviews, deletion requests, Connect, balance links, account deletion. Turnstile on booking and deletion forms (fails closed in production). **Fixed in this review:** rate-limit IPs now come from the host's own client-IP header (`lib/client-ip.ts`) instead of a client-settable `X-Forwarded-For`. Auth rate limits are Supabase settings, see below. |
| Sessions in secure storage; short-lived tokens; refresh rotation | Pass | Keychain/Keystore via chunked `secure-storage.ts` (`AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY`); 1 h access tokens; refresh-token rotation on (`config.toml`). PKCE for magic links; SHA-256 nonce for Sign in with Apple. |
| HTTPS, HSTS, strict CSP, secure headers, no inline secrets | Pass | HSTS (2 y, preload), `X-Frame-Options: DENY`, `frame-ancestors 'none'`, nosniff, strict referrer, Permissions-Policy, COOP, CORP. Nonce-based CSP with `default-src 'none'` and no `'unsafe-inline'`/`'unsafe-eval'` (2026-11-09): see "CSP (2026-11-09)". |
| Uploads: type/size checks, EXIF/GPS stripped, private buckets, expiring signed URLs | Pass | Bucket is private, JPEG only, 5 MB max; the app re-encodes photos (drops EXIF/GPS); the server only reads the caller's own folder. Stored photos are not displayed to anyone, so no URLs are issued; use `createSignedUrl` with a short expiry if that changes. |
| Dependency scanning, secret scanning in CI, lockfiles committed | Pass (repo settings: owner action) | `.github/workflows/ci.yml` (tests, types, lint, builds, `npm audit`, gitleaks), `.github/dependabot.yml`, both `package-lock.json` files committed. |
| Audit log of money and account events | Pass | `audit_log` (append-only for clients): bookings, payments, refunds, plan changes, consent, opt-outs, onboarding, account deletion. |
| Least-privilege service roles | Pass | Service role is used only in server code after auth/validation; money, plan, consent, review and AI fields are not client-writable (column grants, tested). |
| Security review of every PR touching auth or payments | Process | Run this checklist (and `/security-review`) on those PRs. |

## Fixed during this review
- Rate limiting trusted the left-most `X-Forwarded-For`, which a client can forge on hosts that append to it. Now `clientIp()` prefers `cf-connecting-ip`, `x-nf-client-connection-ip`, then `x-real-ip`.
- Refunds that failed after a detailer cancelled were only logged. The cron route now retries them with the original idempotency key (no double refunds), and gives up after 10 attempts with `refund.gave_up` for manual follow-up. Tested end to end.
- Account deletion now also removes the detailer's photos from storage (found while testing M5).

## CSP (2026-11-09): nonces with Cache Components, no 'unsafe-inline'
The earlier decision (below, superseded) kept `'unsafe-inline'` because Next documents nonces as
incompatible with Partial Prerendering. That only applies to scripts inside a *prerendered* shell, so
the fix is to make the shell (almost) empty:

- `app/layout.tsx` wraps the whole app in `<Suspense>` around a component that awaits `connection()`.
  Every route is still built as Partial Prerendering, but its static shell is just `<html>`, `<head>`
  (metadata, CSS and font links, `<script src>` chunks) and one inline script React always emits:
  `requestAnimationFrame(function(){$RT=performance.now()});`. That constant is allowed by its
  SHA-256 hash (`src/lib/csp-hashes.json`).
- Everything else renders at request time. `src/proxy.ts` (now matching every page) creates a
  128-bit random nonce per request, puts the policy on the request (Next reads the nonce from it and
  stamps every inline script it streams) and on the response.
- Data is still cached with `"use cache"` (`getPublicConfig`, `getBookingPage`), so pages cost a
  render, not database calls, and `plan_config` changes still appear without a redeploy.
- Guard rails: `scripts/verify-csp.mjs` runs after `next build` (so on every Netlify deploy) and fails
  if any prerendered shell has an un-hashed inline script, an un-nonced `<style>` or a `style=""`
  attribute. `src/lib/csp.test.ts` pins the policy. Exception: `_global-error.html`, Next's built-in
  static 500 page, which the framework generates from its own component and cannot be customised; if it is
  ever served (rendering itself crashed), the CSP blocks its inline styles and it shows as plain text.

Policy for pages (`src/lib/csp.ts`):
`default-src 'none'; script-src 'self' 'nonce-…' 'sha256-…' https://challenges.cloudflare.com;
style-src 'self' 'nonce-…'; img-src 'self' data: blob:; font-src 'self';
connect-src 'self' https://challenges.cloudflare.com; frame-src https://challenges.cloudflare.com;
manifest-src 'self'; media-src 'self'; worker-src 'self' blob:; frame-ancestors 'none';
base-uri 'none'; form-action 'self'; object-src 'none'; upgrade-insecure-requests`.
Static files and API routes (everything the proxy skips) get
`default-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'` from `next.config.ts`,
so no response carries two policies.

Styles without `'unsafe-inline'`: CSP only blocks `style=""` attributes that arrive in HTML and
un-nonced `<style>` elements; styles set from JavaScript through the CSSOM (React's `style` prop after
hydration, Motion animations) are allowed. So server HTML never contains a `style` attribute:
Motion start states (`initial`) are passed only after hydration (`useHydrated()`), entrances above the
fold are CSS keyframes, next/image is used through `getImageProps()` without its `style`, and Motion's
`popLayout` `<style>` gets the nonce via `<MotionConfig nonce>` (`useCspNonce()` reads it from an inline
script; browsers keep the `nonce` property readable to same-page scripts). Client-side Zod runs
`jitless` so it never probes `new Function`.

Trade-offs: every page view is a server render (Netlify function) instead of a CDN hit; at launch
traffic this is well inside the free tier, and the shell (head, CSS, fonts, JS) is still static. A cached
per-handle shell can carry an old nonce on its external `<script src>`/`<link>` tags; those load through
`'self'`, the stale value is never accepted again, and inline scripts always carry the current nonce.

Other header changes: `Cross-Origin-Resource-Policy: same-origin`, `X-Permitted-Cross-Domain-Policies:
none`, `Origin-Agent-Cluster`, and a Permissions-Policy that turns off every powerful feature except
`payment` and the motion sensors (`accelerometer`/`gyroscope` for our own pages: the glass bead follows
phone tilt). The site sets no cookies.

## Superseded decision (2026-11-07): CSP nonces
Next.js documents that nonce-based CSP requires dynamic rendering for every page and is
"incompatible with Partial Prerendering", which this app uses (Cache Components). SRI is
experimental and does not cover Next's inline bootstrap scripts. So the site keeps
`script-src 'self' 'unsafe-inline'`. Risk is contained: React escapes all output, there is no
`dangerouslySetInnerHTML`, `innerHTML`, `eval` or `new Function` anywhere in our code (checked),
third-party script origins are limited to Cloudflare Turnstile, and `frame-ancestors`, `base-uri`,
`form-action` and `object-src` are locked down. Revisit if Next supports nonces with PPR.

## Accepted findings
- `npm audit` (mobile): 5 moderate advisories in `glob`/`minimatch` inside Expo's build-time CLI
  (`@expo/cli`, `@expo/fingerprint`). They are not in the shipped app; the only automatic fix is a
  downgrade to Expo 52. Re-check on the next Expo SDK upgrade.
- Web: `npm audit --omit=dev` reports 0 vulnerabilities.

## Owner actions before launch
1. GitHub repo settings: turn on **Dependabot alerts**, **secret scanning** and **push protection** (free for public repos).
2. Supabase dashboard (production): keep refresh-token rotation on, review **Auth rate limits**, set **custom SMTP** before real users (the built-in sender is heavily rate limited).
3. Set `CRON_SECRET` (32+ random chars), Turnstile keys, `NEXT_PUBLIC_SITE_URL`, and the Stripe/RevenueCat/OpenAI keys only in the host's secret settings.
4. Schedule `/api/cron/messages` every 15 minutes on the host.

## Not covered yet
- OWASP MASVS items that need a device build: verify no sensitive data in logs on device and that
  screenshots of sensitive screens are acceptable. Do this on the first EAS build.
- A penetration test by a third party (recommended once there is revenue).
