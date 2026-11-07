# Work for Cline (budget: about 1 million tokens)

Manager: Claude Code. Every task is reviewed before it counts: Claude Code reruns all checks,
reads the diff, and either accepts it, fixes it, or sends it back with notes in `docs/HANDOFF.md`.

Read `.clinerules`, `CLAUDE.md` and `rules.md` first. Do the tasks **in order**. Commit after each task
(only your files: `git add <paths>`), then write a `docs/HANDOFF.md` entry. Stop and write the
hand-off entry before your tokens run out.

## Do not touch
Anything outside the paths listed in your task, and in particular: `supabase/migrations/**`
(never edit a committed migration), `apps/web/src/app/**` route code, `apps/web/src/lib/**`,
`apps/mobile/src/**`, `CLAUDE.md` roadmap boxes, `.github/workflows/ci.yml` except the job you add,
any `.env*` file. If a task needs a change there, write it down in the hand-off instead.

---

## Task 1: Playwright end-to-end tests for the booking flow (M8)
**Paths:** `apps/web/e2e/**`, `apps/web/playwright.config.ts`, `apps/web/package.json`
(devDependency `@playwright/test` and a `test:e2e` script only), a new `e2e` job in
`.github/workflows/ci.yml`.

Run against `npm run build && npm run start` with the local Supabase stack (`npx supabase start`,
seeded demo detailer `marcus`). Stripe is not configured locally, so the app uses its dev path:
a successful booking shows "You're booked" without a card form (that is expected; don't mock Stripe).
Turnstile is not configured locally, so no captcha.

Tests to write (one spec file per area):
1. `booking.spec.ts`: on `/marcus` pick a service, vehicle size, an add-on, a time, enter
   name/phone/address, reach review, the total and deposit shown match `src/lib/pricing.ts` for
   the chosen items, click "Book & pay", see "You're booked". Run with `reducedMotion: 'reduce'`.
2. `booking-validation.spec.ts`: details step rejects an empty name, a bad phone and a short
   address with the visible error messages; Continue stays on the step.
3. `slot-taken.spec.ts`: book a slot, then in a new browser context load `/marcus` and confirm
   that time is no longer offered on that day.
4. `routing.spec.ts`: `/` 200, `/pricing` shows the free booking limit from the database (not a
   constant: read `get_public_config` via REST and compare), `/privacy`, `/terms`, `/support`,
   `/delete-account` 200; `/some-unknown-handle` returns HTTP **404**; `/marcus` 200.
5. `review.spec.ts`: create a completed booking through SQL (`docker exec ... psql`, see
   `supabase/tests/database/messaging.test.sql` for the shape), open `/r/<review_token>`,
   rate 5 stars with a comment, see "Thank you"; reopening shows "already reviewed".
6. `a11y.spec.ts`: run `@axe-core/playwright` on `/`, `/marcus` (each booking step) and
   `/pricing`; fail on serious or critical violations.

**Acceptance:** `npm run test:e2e` passes locally twice in a row (no flakes, no fixed `waitForTimeout`
sleeps: wait on roles/text), the CI job passes on GitHub, tests clean up anything they create.

## Task 2: Unit tests for money and time logic
**Paths:** `apps/web/vitest.config.ts`, `apps/web/src/**/*.test.ts` (new files only),
`apps/mobile/vitest.config.ts`, `apps/mobile/src/**/*.test.ts` (new files only), devDependency
`vitest` in each app and a `test` script, a step in the existing CI jobs that runs it.

1. `apps/web/src/lib/pricing.test.ts`: `depositCents`, `bookingFeeCents` for 0, 1, 5, 99, 6000,
   21000, 999999 and a sweep of 1..200000 checking `fee === ceil((deposit+30)/0.971) - deposit`
   using exact integer/rational math (the same check as `supabase/tests/database/booking.test.sql`).
2. `apps/mobile/src/lib/format.test.ts`: `startOfDay`, `mondayOf`, `weekdayIndex`,
   `minutesOfDay`, `dateKey` for `America/Chicago` across both 2026 DST changes (Mar 8, Nov 1) and
   for `Asia/Dubai`; `usd`, `usdParts`, `initials`.
3. `apps/web/src/lib/twilio.test.ts`: `validTwilioSignature` against Twilio's documented example
   values (find them in Twilio's docs, cite the URL in a comment) and a tampered body;
   `optOutIntent` for STOP/stop/Stop!, START, OptOutType, and a normal message.

**Acceptance:** all pass; no changes to the code under test (if you find a bug, write a failing test
marked `.fails` and describe it in the hand-off).

## Task 3: App Store and Google Play listing drafts
**Paths:** `docs/store-listing/*.md` (new files only). Drafts for the owner to review; nothing is
submitted anywhere.

Write, for **both** stores: app name (30 chars), subtitle / short description, full description,
keywords (Apple, 100 chars), "What's new" for 1.0, a screenshot plan (6 screens: which app screen,
the one-line caption on each), and App Review notes. Rules: follow `rules.md` section 6 (no prices or
keyword stuffing in name/subtitle, no other platforms named), say "AI photo quotes are estimates the
detailer approves", say texts are not used at launch, name OpenAI as the AI provider, and never state
a Pro price (it comes from the store). Leave `[DEMO EMAIL]`-style placeholders for unknown values.

**Acceptance:** character limits met (state the count next to each field), consistent with
`docs/store-submission.md` and `/privacy`.

## Task 4: Outreach drafts for US detailers (M8)
**Paths:** `docs/outreach/*.md` (new files only). Drafts only: **never send anything, never sign
up for any service, never visit social sites.**

Write: 3 short Instagram DM variants, 2 Facebook-group post variants (helpful, not spammy, follow
typical group rules), 1 cold email, 1 follow-up, and a reply sheet for the 10 most likely
objections. Offer: the first 20 detailers get 3 months of Pro free (this is the owner's offer; don't
invent others). Tone: one detailer to another, plain words, no hype, no emoji. Include a short
"how to find detailers" checklist the owner can do by hand.

**Acceptance:** each message under 120 words, no false claims (check features against `CLAUDE.md`).
