# Route inventory and Burp Suite checklist (2026-11-16)

Scope: every `route.ts` under `apps/web/src/app/api`, every server action, and the middleware. Generated from the code on 2026-11-16; re-run the inventory when a route is added.

Auth kinds: **Bearer** = detailer's Supabase access token (`detailerFromRequest`, `src/lib/auth.ts`, no cookies, so no CSRF). **Admin cookie** = httpOnly SameSite=Strict session (`src/lib/admin.ts`). **Secret** = shared secret header. **Signature** = provider-signed webhook. **Token** = unguessable capability in the URL. **None** = public.

## API routes

| Route (file) | Method | Auth | Existing controls | Gaps / notes |
|---|---|---|---|---|
| `/api/account` (`account/route.ts`) | DELETE | Bearer | `hit_rate_limit` 5/h per user | OK |
| `/api/admin/auth` (`admin/auth/route.ts`) | POST, DELETE | None (OTP login) / cookie | `sameOrigin`, `hit_rate_limit`, allow-list `ADMIN_EMAILS` | Check OTP brute force and email enumeration (same response for allowed and unknown emails) |
| `/api/admin` (`admin/route.ts`) | GET, POST | Admin cookie | re-verified each call, `sameOrigin` on POST | GET has no Origin check (read only, SameSite=Strict covers it). Every write must hit `audit_log` |
| `/api/bookings/[id]/balance` | POST | Bearer | `hit_rate_limit`, uuid check | IDOR: id must belong to caller (test with another detailer's id) |
| `/api/bookings/[id]/cancel` | POST | Bearer | uuid check, `cancel_booking(p_detailer_id)` | **No rate limit**; ownership enforced in SQL only (test IDOR) |
| `/api/cron/messages` | GET | Secret (`CRON_SECRET`, timing-safe) | Bearer compare | Check missing/short/empty secret, wrong scheme |
| `/api/log` | POST | None | `hit_rate_limit` per IP, scrub, size caps, 2% prune | Public write surface: test oversize body, wrong types, log flooding from many IPs |
| `/api/media/[handle]/[item]` | GET | None (published only) | `HANDLE_RE`, uuid, `media_path()` RPC | **No rate limit** (serves a storage download per hit; cached 1h). Test unpublished handle, other detailer's item id under another handle |
| `/api/quotes/ai` | GET, POST | Bearer | `hit_rate_limit`, consent check | Cost abuse: test limit, image count/size, non-image payloads, prompt injection in photos |
| `/api/revalidate` | POST | Bearer | only the caller's own tag | **No rate limit** |
| `/api/revenuecat/webhook` | POST | Secret (`REVENUECAT_WEBHOOK_AUTH`, timing-safe) | reads subscriber from RevenueCat, idempotent, ignores stale events | Replay, wrong user id, forged body with right secret absent |
| `/api/stripe/balance` | GET | Bearer | none visible | **No rate limit** (calls Stripe) |
| `/api/stripe/connect` | POST | Bearer | `hit_rate_limit` | Stripe mode is off at launch |
| `/api/stripe/webhook` | POST | Signature (`constructEvent`) | idempotent `apply_stripe_event()` | Replay old signed event, wrong secret, tampered body |
| `/api/twilio/inbound` | POST | Signature (`validTwilioSignature`) | size cap 20k, E.164 check | SMS is off at launch; test signature with changed host/URL |

## Server actions (POST to the page URL with a `Next-Action` header)

| Action (file) | Controls | Test |
|---|---|---|
| `createBooking` (`[handle]/actions.ts`) | Zod, Turnstile (when keys set), Postgres rate limit, `create_booking()`, overlap trigger | Double booking race, price tampering (client sends only ids), huge strings, other detailer's service ids, plan limit |
| `reportDepositSent` (`[handle]/actions.ts`) | `report_deposit_sent(id, client_token)` | Wrong token, enumerating ids |
| `reportSentByToken`, `requestChange` (`b/[token]/actions.ts`) | rate limit per IP and per token | Token guessing (48 hex), repeat requests, other booking's data never rendered |
| `submitReview` (`r/[token]/actions.ts`) | completed bookings only, once | Replay, second review, bad rating range, HTML in text |
| `requestDeletion` (`delete-account/actions.ts`) | rate limit | Spam, email enumeration, injection into the support queue |

## Other surfaces

- `src/middleware.ts` (edge): handle check via `booking_page_exists`; test odd handles (`%2e`, unicode, very long), `/b/<token>`, `/api/*` matching.
- `/admin` page: noindex, robots-disallowed; test unauthenticated render shows nothing but the login.
- `/r/<token>` receipt, `/b/<token>` client page: token-only access, `Cache-Control` should be private/no-store.
- Static: `/llms.txt`, `/sitemap.xml`, `/manifest.webmanifest`.

## Burp checklist per route (apply to every row)

1. **Auth bypass:** no header, empty Bearer, expired token, token of a non-detailer user, token with `alg:none`, admin cookie on a Bearer route and the reverse.
2. **IDOR:** swap ids (booking, item, handle) for another tenant's; compare status codes and bodies (must be identical 404 style, no existence leak).
3. **Rate limits:** Intruder 100 requests in 10 s; confirm 429 and that limit keys can't be bypassed with `X-Forwarded-For`, `CF-Connecting-IP` or case changes (`src/lib/client-ip.ts`).
4. **CSRF / Origin:** cookie-auth routes (admin) with a foreign `Origin`, missing `Origin`, `null` Origin; Bearer routes need no CSRF but must reject cookie-only requests.
5. **Injection:** SQL (`'`, `%`, `\`) in handles, ids, search; JSON type confusion (arrays/objects for strings, huge numbers, negative cents); header injection (CRLF) in any value echoed; stored XSS in names, notes, review text, error log messages (check `/admin` rendering).
6. **CSP and headers:** every HTML response has a per-request nonce CSP, no `unsafe-inline`; API responses carry the deny-all CSP, `X-Content-Type-Options`, `Referrer-Policy`, HSTS; no CORS `*` on authenticated routes; check `Cache-Control` on token pages.
7. **Webhooks:** missing signature, wrong secret, valid signature with modified body, replay of a valid event (must be idempotent), timestamp tolerance.
8. **Cookies (admin):** `HttpOnly`, `Secure`, `SameSite=Strict`, `Path`, short expiry, cleared on logout (DELETE), no session fixation after login.
9. **Errors:** responses never include stack traces, SQL errors, env names or user ids.
10. **Method and content-type:** unexpected methods return 405, wrong `Content-Type` rejected, body size caps enforced.

## Fixes recommended from this inventory

1. DONE 2026-11-16: `hit_rate_limit` added to `/api/bookings/[id]/cancel`, `/api/revalidate` and `/api/stripe/balance` (per user).
2. Add an IP rate limit to `/api/media/[handle]/[item]` or rely on the CDN cache with a longer `s-maxage`.
3. Send `Cache-Control: private, no-store` on `/b/<token>` and `/r/<token>` if not already.
4. Rebuild `/admin` (navigation, pages, audit trail view, session list and revoke, idle timeout). Not started.
