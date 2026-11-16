# SEO checklist: steps only the owner can do

What the code already does (sitemap, robots, canonical + Open Graph + Twitter tags on every public page, schema.org microdata, `/llms.txt`,
three keyword landing pages, App Store metadata) is described in `CLAUDE.md` and `docs/ASO.md`. These are the outside steps. Nothing is
posted for you; every account is created and logged in by the owner.

## 1. Google Search Console (first, 15 minutes)
1. search.google.com/search-console > Add property > **Domain** > `beadup.app`.
2. Google shows a TXT record. In Cloudflare > beadup.app > DNS > add record: type TXT, name `@`, content as given. Click Verify.
3. Sitemaps > add `https://beadup.app/sitemap.xml` (robots.txt already links it).
4. URL inspection > paste each URL > **Request indexing**: `https://beadup.app/`, `/pricing`, `/for`, `/for/car-detailers`,
   `/car-detailing-booking-app`, `/ai-detailing-quote-calculator`, `/booking-link-with-deposits`, `/blog`, `/support`.
   (About 10 requests a day are allowed; do the rest on the next days.)
5. After a week: Pages report (any "Crawled, not indexed"?), Performance report (queries, clicks).

## 2. Bing Webmaster Tools
bing.com/webmasters > Import from Google Search Console (one click), then submit the sitemap. Bing also feeds ChatGPT search and Copilot.

### IndexNow (instant pings to Bing, Yandex and others; optional)
1. Make a random key (8 to 128 letters, numbers, dashes), for example in PowerShell: `-join ((48..57)+(97..122) | Get-Random -Count 32 | % {[char]$_})`.
2. Set `INDEXNOW_KEY` in the Cloudflare Workers build/runtime variables and redeploy. The key file is then served at
   `https://beadup.app/indexnow/<key>.txt` (any other key returns 404).
3. After you publish or change pages, submit them (replace `<key>`):
   `curl -X POST https://api.indexnow.org/IndexNow -H "Content-Type: application/json" -d '{"host":"beadup.app","key":"<key>","keyLocation":"https://beadup.app/indexnow/<key>.txt","urlList":["https://beadup.app/car-detailing-booking-app"]}'`
   Google does not use IndexNow; it still needs Search Console.

## 3. Universal Links and the App Store link
- Set `NEXT_PUBLIC_APPLE_TEAM_ID` (Apple Developer > Membership details) in Cloudflare and redeploy; verify with
  `curl -i https://beadup.app/.well-known/apple-app-site-association` (200, `application/json`). The iOS Associated Domains entitlement
  (`applinks:beadup.app`) needs the next native store build: see `docs/ASO.md`.
- Confirm `NEXT_PUBLIC_APP_STORE_URL` is `https://apps.apple.com/us/app/beadup/id6831768099` in the Cloudflare build variables. It turns on the
  Smart App Banner on marketing pages (open `https://beadup.app` in Safari on an iPhone without the app: a banner should appear at the top)
  and the real App Store buttons.
- Paste the App Store metadata from `docs/ASO.md` into App Store Connect at the next version (name, subtitle, keywords need a new version;
  promotional text does not).

## 4. Check structured data
- Rich Results Test (search.google.com/test/rich-results): test `https://beadup.app/` and `/for/car-detailers` (FAQ) and the three landing pages.
  The site uses microdata, which Google reads the same as JSON-LD. Expect: SoftwareApplication, FAQ, Organization. Warnings about missing
  `aggregateRating` are normal: Beadup does not publish ratings it does not have.
- Schema Markup Validator (validator.schema.org) shows the full tree.
- Search Console > Enhancements shows problems after a few days.

## 5. Backlinks and listings (do these in this order; real, honest descriptions)
Use the one-line description "Beadup: booking app for service businesses (car detailers, salons, barbers, groomers): booking link,
30% deposits paid to you, WhatsApp reminders". Always link `https://beadup.app` (not the App Store directly) so the site earns the link.
- Apple App Store product page: link it from the website (done) and from every social bio.
- **Product Hunt** (one launch day; prepare the gallery from `apps/mobile/assets/store`).
- **AlternativeTo** (list as an alternative to general booking and detailing software), **G2** and **Capterra** (free vendor listings; reviews only from real users).
- **Indie Hackers** and Hacker News "Show HN": the story of building for solo pros.
- Communities (answer questions, no spam, disclose you built it): r/AutoDetailing, r/sweatystartup, detailing and barber Facebook groups
  on their promo days, hair and beauty business groups. See `docs/marketing/README.md` and `docs/outreach/README.md`.
- Ask the first happy detailers to add their `beadup.app/<handle>` link to their Google Business Profile and Instagram bio; every booking page
  links back with "Powered by beadup".
- A Google Business Profile for Beadup itself is not needed (it is for businesses that serve people in person).
- Social profiles: none are recorded in the repo, so the website's Organization data lists only the App Store page. When the Instagram, TikTok,
  YouTube and Facebook accounts exist (`docs/marketing/accounts.md`), send the URLs so they can be added to `sameAs` in
  `apps/web/src/components/site/Structured.tsx`.

## 6. Ongoing (monthly, 30 minutes)
- Search Console: top queries and pages; write one guide for a query that already shows impressions (`apps/web/src/content/guides.tsx`).
- Add a city or trade page only when real businesses there can be shown.
- Re-run the Rich Results Test after any change to page markup. Keep Android out of the structured data and store copy until it is released.
