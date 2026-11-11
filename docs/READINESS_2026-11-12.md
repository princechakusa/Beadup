# Beadup production readiness audit, Stages 1–4 (2026-11-12)

Independent re-check of `docs/AUDIT_2026-11-11.md` against the repository, the local Supabase stack and (read-only)
production. Secrets are not reproduced here.

## 1. Executive summary
Stages 1–4 are present and behave as reported, with one real defect found and fixed: **a client whose page was
out of date (a service or add-on changed after they opened it) got "Something in the booking didn't check out" and
could not recover** (F-1). This was the "unexplained" E2E failure in the Stage 4 report; it is now explained,
reproduced, fixed and covered by a test. Three smaller items were fixed before deploying (F-2 to F-4).
Concurrency of the overlap lock was verified with two real database connections. Stages 1–2 were confirmed live in
production; Stage 4 was not yet deployed at audit time. Owner approved fixing, deploying and the OTA update
(messages of 2026-11-12), so the "audit-only" stop in the brief was lifted by the owner.

## 2. Git and repository state (at audit start)
| Check | Status | Evidence |
|---|---|---|
| Branch / HEAD | PASS | `main` at `45b5a21`, 1 commit ahead of `origin/main` (`6ba1d48`); working tree clean |
| Stage 1–4 changes present | PASS | 7 commits since `6d57a90`; 44 files; 3 migrations `20261111000000`, `20261111000100`, `20261112000000`, in order, no duplicates |
| Stage 4 unpushed as reported | PASS | `45b5a21` local only |
| Deployment without approval | PARTIAL | Stages 1–3 were pushed on 2026-11-11 under the CLAUDE.md standing instruction ("commit, push after each milestone"); Cloudflare Workers Builds deployed them (check runs `success`). The audit brief's own "APPROVE" step was not waited for. Stage 4 was held. |
| CI on last pushed commit | PASS | run 43039864991 (`6ba1d48`) success on attempt 2; attempt 1 and run 43034779060 failed only on runner DNS (`Temporary failure resolving security.ubuntu.com`) while installing Playwright browsers |

## 3–6. Stage verification
| Stage | Item | Status | Evidence |
|---|---|---|---|
| 1 | Overlap prevention incl. buffer | PASS | pgTAP `booking_integrity` (26); race test: session B blocked 2.4 s on A's advisory lock, then `23P01`, only A's row remained |
| 1 | Status guard / reschedule audited | PASS | privilege matrix: `authenticated` has no UPDATE on `starts_at`/`duration_min`; trigger order guard → overlap verified |
| 1 | Detailer-zone dates, busy ranges | PASS | `slots.test.ts` (Auckland/LA boundaries) |
| 2 | Days off, contact phone, deposit "sent" ≠ received | PASS | pgTAP (22); E2E checks DB `deposit_received_at is null` after report |
| 2 | `client_token` hidden from app | PASS | `has_column_privilege('authenticated', bookings.client_token, select) = f` |
| 3 | Needs attention from real rows | PASS | PostgREST script as a detailer (19/19 earlier; request queries 10/10) |
| 4 | `/b/<token>` page, requests, auto-close | PASS | pgTAP (32), E2E (3), request queries (10/10) |

## 7. Database and migration security
| Finding | Status | Sev | Evidence / action |
|---|---|---|---|
| All SECURITY DEFINER functions pin `search_path` | PASS | – | query: 0 without `search_path` |
| New functions callable only by intended roles | PASS | – | `client_booking`, `request_booking_change`, `report_deposit_sent`: service_role only; `reschedule_booking`, `dismiss_booking_request`: authenticated (owner-checked inside) |
| New tables RLS + grants | PASS | – | `days_off` S/I/D own rows; `booking_requests` select only; anon nothing |
| Account deletion cascades to new tables | PASS | – | rolled-back delete of the seed user: bookings, requests, days off → 0 |
| No dynamic SQL / injection surface | PASS | – | all parameters typed; no `EXECUTE` of built strings |
| Migrations safe on existing production data | PASS | – | overlap check only on new/moved rows; Stage 2 backfills the token via a volatile default; Stage 4 only adds objects |
| FK `booking_requests → bookings` had no covering index | FIXED (F-2) | P2 | added `booking_requests_booking_idx` to the not-yet-applied Stage 4 migration |
| `set_completed_at`, `set_updated_at` executable by anon | PARTIAL | P2 | pre-existing trigger helpers; calling them directly errors ("trigger functions can only be called as triggers"); revoke in a later cleanup |
| Existing overlapping rows in production | PARTIAL | P2 | production demo page shows two past demo bookings that overlap (created before Stage 1). Expected: existing rows aren't re-checked |
| `reschedule_booking` onto the exact start of an expired unpaid hold | PARTIAL | P2 | the unique index still counts it → `overlap`. Stripe mode only (off) |

## 8. Customer token security
| Check | Status | Evidence |
|---|---|---|
| 192-bit `gen_random_bytes(24)`, unique | PASS | column default; unique index; 0 malformed |
| Exact match only, format-checked first | PASS | `^[0-9a-f]{48}$` in SQL and TS; pattern-token test |
| Never reaches the detailer app | PASS | column grant |
| Booking id not sent to the browser | PASS | stripped in `page.tsx`; only a short ref (8 hex) shown |
| No client phone/address/surname | PASS | pgTAP regex check + E2E |
| Expired view limited | PASS | `{expired, businessName, handle}` only |
| Referrer / indexing | PASS | `<meta name="referrer" content="no-referrer">`, `noindex`; no analytics or third-party scripts (CSP `default-src 'none'`) |
| Rate limits | PASS | page 60/10 min/IP; actions 10/10 min/IP + 6/h/token; E2E per-token limit |
| Tokens in hosting access logs | PARTIAL (P2) | path segment → Cloudflare request logs. Acceptable for view/request-only access |
| 30-day expiry, no manual revocation | PARTIAL (P2) | acceptable for launch: the token can't move, cancel or pay anything; revocation is a later feature |

## 9. Mobile application
| Check | Status | Evidence |
|---|---|---|
| OTA-safe (no native change since 1.0.1 build) | PASS | `git diff 6d57a90..HEAD -- apps/mobile` touches only `src/`; last native-relevant commit `36775fc` (1.0.1, 2026-11-10); iOS 1.0.1 production build FINISHED |
| Needs attention survives a failed requests query | FIXED (F-3) | the requests query is now non-fatal |
| Reschedule screen ignores jobs that start the previous day | PARTIAL (P2) | only that day's bookings are greyed out; the server still refuses the overlap |
| Physical device test | NOT VERIFIED (P1 for launch) | no device or simulator on this PC |

## 10. Payment workflow
PASS: `payments_mode = external` (local and production page); `payment_link` https-only (DB check + Zod); opening the
link marks nothing; `report_deposit_sent` sets only `deposit_reported_at` (audited); only `mark_deposit_received`
(owner) sets `deposit_received_at`; no Stripe activation or new payment dependency.

## 11. Regression testing (commands run on this PC)
| Command | Result |
|---|---|
| `npx supabase test db` | 301/301 (fresh and used database) |
| `apps/web: npx tsc --noEmit; npm run lint; npx vitest run` | clean; clean; 57/57 |
| `apps/web: npm run build` (next build + verify-csp) | success; 0 inline scripts/styles |
| `apps/web: npx playwright test` | before F-1/F-4: 2 failures after every `db reset`; after: **13/13** after a reset and **13/13** again on a used database |
| `apps/mobile: npx tsc --noEmit; npm run lint; npx vitest run` | clean; clean; 26/26 |
| `apps/mobile: npx expo export --platform ios/android --no-bytecode` | both exported |
| `npm audit --omit=dev` | web 0; mobile 5 moderate (`glob`/`minimatch` inside `@expo/cli`, build tooling, not in the app bundle) |
| `npm audit` (all, web) | 11 (4 high) in dev/build tooling (`glob`, `minimatch`); not shipped |

## 12. Production deployment risks
- Migrations are forward-only. Rollback of Stage 4 = drop `booking_requests`, the three functions, the trigger and
  the two enum types; the web/mobile code tolerates their absence (F-3; the page shows "Link not found").
- No error monitoring service is wired in (no Sentry in code); Cloudflare logs only. P2.
- Production needs `SUPABASE_SERVICE_ROLE_KEY` on Cloudflare for `/b/<token>` (without it every link shows
  "Link not found", safely). Already required by booking creation, so present.

## 13. Outstanding external dependencies
Unchanged from CLAUDE.md 🔑: Stripe (company), Twilio 10DLC, App Store/Play subscription products, OpenAI key,
Android build. Supabase CLI access token on this PC is invalid (production checked through the public API instead).

## 14. Fixes made after this audit (owner-approved)
| # | Sev | Fix | Files | Test |
|---|---|---|---|---|
| F-1 | P1 | Stale catalog: `create_booking` errors `add_on`/`service` now return `catalog_changed`; the page refreshes, explains "This detailer just updated their services or prices", and restarts the choice (details kept). `not_found` → `unavailable`. Root cause of the "unexplained" E2E failure: seed add-on ids change on `db reset` while the dev server's data cache kept the old ids | `app/[handle]/actions.ts`, `components/booking/BookingFlow.tsx` | new `e2e/zz-catalog-change.spec.ts` |
| F-2 | P2 | FK index on `booking_requests (booking_id, detailer_id)` | Stage 4 migration (unapplied at the time) | pgTAP suite |
| F-3 | P2 | Needs attention tolerates a failed requests query | `apps/mobile/src/lib/data.ts` | tsc/lint/unit |
| F-4 | P2 (test infra) | Playwright dev server starts with an empty `.next/cache` | `apps/web/playwright.config.ts` | 13/13 after reset |

## 15. Deployment sequence (followed)
1. Push `main` → Supabase applies `20261112000000` → Cloudflare deploys the web app.
2. Verify production read-only: `client_booking`/`request_booking_change` exist (anon refused, not "not found");
   `beadup.app/b/<bad token>` shows "Link not found".
3. Only then publish the OTA (`eas update --channel production --environment production --platform ios`), so the app
   never queries tables that don't exist yet.

## Final decision
**APPROVE AFTER REQUIRED FIXES**: the one P1 code defect (F-1) is fixed and tested; the remaining P1 (physical device
test) is a launch check that an OTA does not block. Deployment proceeds in the order above.
