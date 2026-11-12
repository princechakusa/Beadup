# Hand-off log

Each agent (Cline, Claude Code) appends an entry when it stops: date, agent, what is finished, what is
half-done (file paths), what was tested, what failed. Newest at the bottom.

## 2026-11-07, Claude Code
- Done: M1 to M7 (see CLAUDE.md roadmap). AI quotes on OpenAI, launch without SMS.
- Next for Claude Code: M8 security review (rules.md section 7), CSP nonces, dependency audit.
- Good for Cline: M8 Playwright E2E tests for the booking flow (`apps/web`, new files only), outreach
  drafts for US detailers (drafts only, owner approves before anything is sent).
- Waiting on the owner: Supabase "Deploy to production" toggle, OPENAI_API_KEY in apps/web/.env.local.

## 2026-11-07 (later), Claude Code
- Done: M8 security review (`docs/SECURITY_REVIEW.md`), CI + Dependabot + gitleaks, IP trust fix, refund retries.
- **Cline: start with `docs/CLINE_TASKS.md`** (Tasks 1-4 in order). Claude Code reviews each one.
- Claude Code next: 3D app icon (Blender), App Review demo sign-in, deployment setup.

## 2026-11-07 (evening), Claude Code reviewing Cline
- Cline stopped (out of credits) partway through Task 2 with nothing committed. Reviewed and kept:
  vitest setup in both apps, `pricing.test.ts`, `twilio.test.ts`, `format.test.ts` (42 tests).
- Fixed: one wrong test expectation (07:30Z on 2026-03-08 is 01:30 CST, not 02:30; 02:00-03:00 does
  not exist that day). Tests now run in CI.
- Not started by Cline: Task 1 (Playwright E2E), Task 3 (store listing), Task 4 (outreach). Claude Code takes them over.

## 2026-11-07 (night), Claude Code
- Payments: launch without Stripe (UAE platform can't pay US detailers). External payments mode, see CLAUDE.md.
- Done: Playwright E2E (9 tests, CI), store submission answers rewritten for the launch setup
  (`docs/store-submission.md`, covers Cline Task 3), outreach drafts (`docs/outreach/README.md`, Cline Task 4),
  privacy policy names RevenueCat and Netlify.
- Live: https://beadup.netlify.app (Netlify free), Supabase production migrated (payments_mode = external).
- Waiting on the owner: Apple agreement, Supabase auth settings, demo account, TestFlight build, listing text update
  in App Store Connect.
- Claude Code next: 3D app icon (Blender).

## 2026-11-08, Claude Code: first iOS build FAILED, fix needed before building again
**Build:** EAS `f84baf62-65bb-4714-ae5d-f5bedee17e04` (iOS, profile `production`, SDK 58), failed in the
**INSTALL_PODS** phase. Credentials were created fine (distribution certificate, provisioning profile).

**Exact error (from the EAS log):**
```
[!] CocoaPods could not find compatible versions for pod "PurchasesHybridCommon":
  RNPurchases (from `../node_modules/react-native-purchases`) was resolved to 11.0.1, which depends on
    PurchasesHybridCommon (= 20.4.0)
None of your spec sources contain a spec satisfying the dependency: `PurchasesHybridCommon (= 20.4.0)`.
```

**Cause (checked 2026-11-08):** every `react-native-purchases` 11.x release depends on a
`PurchasesHybridCommon` 20.x pod, and **no 20.x version is published on CocoaPods trunk**
(`https://trunk.cocoapods.org/api/v1/pods/PurchasesHybridCommon`, newest is 19.17.0). Not a cache problem,
so `--clear-cache` alone won't fix it.

**Fix (do this):**
1. `cd apps/mobile && npm install react-native-purchases@10.16.0 --save-exact`
   (10.16.0 depends on PurchasesHybridCommon 19.17.0, which is published; peer deps OK: RN >= 0.73).
   Re-check the trunk URL first: if a 20.x pod has since been published, staying on 11.x is fine instead.
2. Check the API we use still exists in 10.x (it should): `Purchases.configure`, `logIn`, `logOut`,
   `getOfferings`, `purchasePackage`, `restorePurchases`, `getCustomerInfo`, types `CustomerInfo`,
   `PurchasesPackage` (`apps/mobile/src/lib/purchases.ts`, paywall `src/app/pro.tsx`).
3. `npx tsc --noEmit && npm run lint && npx vitest run && npx expo export --platform ios --no-bytecode`
   (hermesc crashes on this Windows PC, hence `--no-bytecode`; real builds use EAS).
4. Commit + push, then the owner runs (needs Apple login, so not from an agent):
   `cd apps/mobile && npx eas-cli@latest build --platform ios --profile production --auto-submit --clear-cache`
5. If another pod conflict appears, read the INSTALL_PODS section of the log:
   `npx eas-cli@latest build:view <id> --json` gives `logFiles` URLs (brotli-encoded: use `curl --compressed`).

**Also pending (unrelated to the failure):** RevenueCat isn't set up yet (owner creates the account; keys go in
`eas.json` / Netlify), so Pro purchases will show "not available" in this first TestFlight build. That's expected.

**Done this session:** App Store Connect listing text, 6 screenshots (Asset Library), Pricing (Free) and
Availability (US, CA, UK, AU; no EU, DSA "not a trader"), App Privacy (9 types, App Functionality, linked,
no tracking; owner presses Publish), subscription `beadup_pro_monthly` ($19, all countries). See
`docs/store-submission.md` for the checklist.

## 2026-11-08, Claude Code: iOS build FIXED and succeeded
- `react-native-purchases` pinned to 10.16.0 (PurchasesHybridCommon 19.17.0 is on CocoaPods; 20.x still isn't).
  Move back to 11.x only once a 20.x pod is published on trunk.
- `apps/mobile/app.json` `web.output` changed `server` -> `single`: the server export in EAS's EAGER_BUNDLE phase ran
  Supabase + SecureStore in Node and crashed. Check locally with `npx expo export:embed --eager --platform ios --dev false`.
- Build `2bc169fe-a45d-47d1-a5f8-29066893e53f` FINISHED (1.0.0, build 4). Not submitted yet: owner runs
  `cd apps/mobile && npx eas-cli@latest submit --platform ios --latest` to send it to TestFlight.

## 2026-11-09, Claude Code: RevenueCat live, build 5 on TestFlight
- RevenueCat project "Beadup" (`18ad6efa`): App Store app `com.beadup.app` with In-App Purchase key 8HKLGT77L9 (valid),
  product `beadup_pro_monthly` -> entitlement `pro`, offering `default` (current) with a Monthly package.
  Public iOS SDK key in `apps/mobile/eas.json` (`EXPO_PUBLIC_REVENUECAT_IOS_KEY`). No Android app in RevenueCat yet.
- Webhook -> `https://beadup.netlify.app/api/revenuecat/webhook`; RevenueCat test event returns 200.
  Netlify has `REVENUECAT_WEBHOOK_AUTH` (bare token, no "Bearer " prefix, same value as in RevenueCat) and `REVENUECAT_SECRET_KEY`.
- Build 5 (1.0.0) submitted to TestFlight. Version 1.0 has six 6.3" screenshots.
- Still needed before App Review: paywall screenshot on the subscription's Review Information (from TestFlight build 5).

## 2026-11-09 (evening), Claude Code: marketing, SEO/AEO, QR code (OTA)
- Web (ships on push via Netlify): 4 guides at `/blog`, schema.org microdata on home/support/guides/booking pages,
  sitemap with booking pages, AI-crawler-friendly robots, `/llms.txt`, per-detailer link preview image, booking page
  titles "Book X · Mobile detailing in <area>", "Add to calendar" on the booked screen, "Powered by beadup" referral link,
  Smart App Banner hook (`NEXT_PUBLIC_APP_STORE_URL`). `scripts/verify-csp.mjs` fixed for Windows paths.
- Mobile (OTA, JS only): QR code sheet for the booking link (Today > booking link card > QR button).
- Marketing kit: `docs/marketing/README.md` (positioning, ASO text, 30-day plan, video scripts, guide ideas).
- Tested: web tsc/lint/vitest (incl. `ics.test.ts`), `next build` + CSP check, smoke test of every new route on
  `next start` against production Supabase; mobile tsc/lint/vitest, `expo export --platform ios`.
- Local Supabase: the API gateway on :54321 didn't answer (another project's Supabase containers are restart-looping on this
  PC), so the web build was run with the production public URL/key instead of `.env.local`.
- Next store build (native, not OTA): add `expo-store-review` and ask for a rating after a job is marked paid (once every
  few months at most); bump `version` in app.json when adding it.

## 2026-11-09 (night), Claude Code: opening animation, next store build checklist
- Opening animation `apps/mobile/src/components/LaunchIntro.tsx`, mounted over the app in `src/app/_layout.tsx`
  (cold start only; the native splash hides once the intro's first frame, identical to it, is on screen, or after 0.6 s).
  Design preview: https://claude.ai/artifact/VqHakbuschmewmFTPoFk21
- Version A (bead from the launch screen) plays on runtime 1.0.0. Version B (falling drop) plays on any later runtime.
- **Next store build (1.0.1) must:**
  1. Bump `expo.version` in `apps/mobile/app.json` to `1.0.1` (runtimeVersion policy appVersion; old binaries keep getting 1.0.0 OTAs only).
  2. Make the launch screen plain Midnight for B: in the `expo-splash-screen` plugin, replace `image` with a fully transparent PNG
     (e.g. `./assets/images/splash-blank.png`, 1x1 transparent) and keep `backgroundColor: "#0A0C10"`.
  3. `npx expo install expo-store-review` and ask for a rating after a job is marked paid (at most once every few months).
  4. EAS build + submit (owner).

## 2026-11-10 (scheduled 2:10 AM run), Claude Code: New Zealand, UAE, South Africa, Singapore
- Migration `20261110000000_more_countries.sql` (check constraint, country_from_timezone, country_currency; grants/RLS
  unchanged), web phone rules + currencies (`src/lib/countries.ts`), mobile currencies + local decimal mark, Settings
  country picker redesigned as a single glass list (code tile, name, currency, check).
- Tests: DB 221 pass (countries.test.sql 25), web 44, mobile 21, web build + CSP check, iOS export.
- Ireland deferred (EU trader status declaration needed in App Store Connect).
- CRASH after the "New countries" OTA (7538e481): rolled production back to update 8cd4b50e (republished as
  90bd1cac). Suspected cause: `Intl.NumberFormat.prototype.formatToParts` (moneyParts on Today, currencySymbol)
  is unreliable in Hermes on iOS. Fixed in format.ts (no NumberFormat.formatToParts, every currency format wrapped
  so it can't throw) + a root ErrorBoundary in _layout.tsx. Fix is committed but NOT published as an OTA until the
  owner confirms the rollback stopped the crash (that confirms the cause). Then: `eas update ... --message "New
  countries (fixed)"`.

## 2026-11-11, Claude Code: product audit (owner's brief)
- Report: `docs/AUDIT_2026-11-11.md` (inventory, security, tests per stage).
- Done: overlap-proof bookings + travel buffer + status guard + reschedule (P0); days off, client contact phone,
  "I've sent the deposit", detailer-zone dates; Today "Needs attention"; landing contrast fix (CI had been red).
- Mobile changes are JS-only: they reach installed builds with an OTA update (`eas update ... --environment production`),
  **not run yet: needs the owner's go-ahead**. Not device-tested (no simulator on this PC).

## 2026-11-12, Claude Code: Stage 4 + readiness audit, deployed (owner-approved)
- Live: `b4f131e` on Cloudflare; Supabase migration `20261112000000` applied in production (checked through the
  public API: Stage 4 functions exist and refuse anon); `beadup.app/b/<token>` serves.
- OTA published: iOS, channel `production`, runtime 1.0.1, update group `2be7666a-fd92-4bee-bf98-59fd62c1a66e`.
  No Android build exists yet, so no Android update.
- CI green on `b4f131e`. Report: `docs/READINESS_2026-11-12.md` (fixes F-1..F-4).
- Still open: test the new screens on a real iPhone; Supabase CLI token on this PC is invalid (`npx supabase login`).

## STATUS 2026-11-12 (items 2-6 of the gap list; item 1 Android excluded by owner)
Done in code, all checks green locally (DB tests PASS, web tsc/eslint/vitest 66/66/build + CSP check, mobile tsc/vitest/eslint):
- 2 Client emails via Brevo outbox (`client_emails`, `apps/web/src/lib/email.ts`). Sends once `BREVO_API_KEY` (+ optional `EMAIL_FROM`) is set on Cloudflare; until then rows are `skipped`.
- 3 Directory `/find`, `/find/<trade>` (`get_directory`), opt-out switch in app Settings > Business profile, "Get found on Google" guide (app Settings).
- 4 Teams: `staff_members`, `bookings.staff_id`, staff-aware overlap trigger, client picks a person or Anyone, app Settings > Team. Migration `20261112000800_teams.sql`.
- 5 Book again, recurring visits (`detailer_book`), due-back nudges (`rebookWeeks` per trade), remembered client details.
- 6 12/24-hour times (GB/ZA 24h), 4 trade guides in `content/guides.tsx`, error monitoring (`error_log` table, `/api/log`, `instrumentation.ts`, web error pages + app ErrorBoundary report, list in /admin). Arabic/Afrikaans NOT done on purpose (English works in those markets; full i18n is a big separate project).

REMAINING STEPS (next agent):
1. `git add -A && git commit` (if not already committed) then `git push origin main` (Cloudflare + Supabase deploy migrations 000500-000900).
2. Optional before push: `npx supabase db reset` then full Playwright E2E in apps/web (last full run 26/26 was before teams + error log).
3. Wait for check-runs: `gh api repos/princechakusa/Beadup/commits/<sha>/check-runs` (cloudflare + supabase green) and CI.
4. Verify prod: beadup.app/find 200, /find/barbers 200, /find/nope 404, /blog lists 8 guides, POST /api/log returns 204.
5. iOS OTA (JS only, no package.json/app.json change): `cd apps/mobile && npx eas-cli@latest update --channel production --environment production --platform ios --non-interactive --message "Teams, book again, due-back, directory switch, Google guide, 24h times, crash reports"`.
6. Add CLAUDE.md notes for emails, directory, teams, repeat bookings, 24h, error_log.
Owner actions: set `BREVO_API_KEY` on Cloudflare; fill `plan_config.pro_price_by_country`.
UPDATE: steps 1, 3, 4, 5 DONE (pushed e09e458, Cloudflare + Supabase green, prod verified, iOS OTA e6fba081 published). Only the full E2E rerun is still open.
