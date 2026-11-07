# Outreach to US mobile detailers (drafts)

**Drafts only. Nothing here is sent by anyone but the owner.** Offer (owner's, don't invent others): the **first
20 detailers get 3 months of Pro free**. Tone: plain words, person to person (the owner builds the app; never claim to be a detailer), no hype, no emoji.

Before sending anything, check every claim still matches the app (`CLAUDE.md`): AI photo quotes are estimates the
detailer approves; clients book from a link with no app; deposits are paid to the detailer directly through their
own payment link (Beadup never touches the money); no text messages yet. Replace `[YOUR NAME]` and `[HANDLE]`.

## How to find detailers (by hand)
1. Instagram: search `#mobiledetailing`, `#mobiledetailer`, `#ceramiccoating` plus a city (`#austindetailing`,
   `#houstondetailing`). Pick solo operators (one person, a van, posting their own work), 500 to 10k followers.
2. Facebook groups: "Mobile Detailing Business Owners", "Auto Detailing Business", city detailing groups. Read each
   group's rules first; many only allow promotion on a set day.
3. Google Maps: search "mobile detailing" in a city, look for 1 to 30 reviews (small, growing). Their website or
   Instagram is usually linked.
4. Keep a simple sheet: name, city, where found, date contacted, reply, follow-up date. Max 20 new messages a day so
   it stays personal and doesn't look like spam.
5. Personalize the first line every time (a recent job, their area). Never copy-paste the same message to a whole list.

## Instagram DMs (3 variants)

**A. Compliment first** (74 words)
> Hey [NAME], that [CAR] you posted last week came out clean. Quick question: how do you handle quotes and
> bookings right now? I built an app called Beadup for solo mobile detailers.
> Snap photos, get a priced quote from your own price list, and clients book from one link in your bio with a
> deposit that goes straight to you. First 20 detailers get 3 months of Pro free. Want me to send it?

**B. Problem first** (65 words)
> Hey [NAME], do no-shows ever burn a whole morning for you? That's why I made Beadup. Clients book from a link in
> your bio, pick a time, and see a 30% deposit to pay you directly before the job. You also get photo-based quotes
> priced from your own list. I'm giving the first 20 detailers 3 months of Pro free. Happy to send the link.

**C. Short** (41 words)
> Hey [NAME], I made a free booking and quote app for solo mobile detailers called Beadup. One link in your bio,
> clients book themselves, deposits go straight to you. First 20 detailers get 3 months of Pro free. Want the link?

## Facebook group posts (2 variants; check the group's promo rules first)

**A. Ask for feedback** (101 words)
> I'm building a tool for solo mobile detailers and would like honest feedback from people doing the work.
> Beadup gives you a booking link for your bio. Clients pick the service, vehicle size, add-ons and a time from
> their phone, then see a 30% deposit to pay you directly (your Square, PayPal, Venmo or Zelle). You can also snap
> photos of a car and get a suggested quote from your own prices, which you check before sending.
> It's free to start. The first 20 detailers who try it get 3 months of Pro free. What would make it useful for you?

**B. Deposits** (97 words)
> Detailers keep telling me the same thing: asking for a deposit at booking cuts no-shows. I built a free app around
> that for mobile detailers. You get one link for your Instagram bio, clients book a time without downloading anything, and they
> see your payment link for a 30% deposit right after booking. The money goes straight to you; the app takes no cut.
> There's also a photo quote tool that prices from your own list. If anyone wants to try it, the first 20 here
> get 3 months of Pro free. Comment and I'll send it.

## Cold email (104 words)
**Subject:** Fewer no-shows for [BUSINESS NAME]

> Hi [NAME],
>
> I came across [BUSINESS NAME] on [WHERE] and liked your [SPECIFIC JOB/REVIEW].
>
> I built Beadup, a quote and booking app for solo mobile detailers. You get one booking link for your bio or
> website. Clients choose a service and a time on their phone and then see a 30% deposit to pay you directly
> through your own payment link. You can also take photos of a car and get a suggested quote from your own prices.
>
> It's free to start, and the first 20 detailers get 3 months of Pro free. Want me to send you the link?
>
> [YOUR NAME]
> Beadup, https://beadup.netlify.app

## Follow-up (one only, 4 to 5 days later; 51 words)
> Hi [NAME], just bumping this in case it got buried. If quotes and bookings already run smoothly for you, no
> worries at all. If not, Beadup is free to try and the 3 months of Pro offer is still open for a few more spots.
> Happy to answer anything.
>
> [YOUR NAME]

If there's no reply after the follow-up, stop. Don't message the same person again.

## Reply sheet: the 10 most likely objections

| They say | Reply (short, honest) |
|---|---|
| "I already use [Square / Calendly / Jobber]." | Fair. Beadup is built only for mobile detailing: vehicle sizes, add-ons and photo quotes are built in. You can keep Square for payments; just paste your Square link into Beadup. |
| "How much is it?" | Free to start with a monthly booking limit. Pro is a monthly subscription in the app; the price shows before you buy. You'd get 3 months of Pro free. |
| "Do you take a cut of my money?" | No. Clients pay you directly through your own link. Beadup never touches the money. |
| "My clients won't download an app." | They don't need to. They book from a link in their browser. Only you use the app. |
| "Is the AI quote accurate?" | It's a starting point priced from your own list. You check and change it before it's sent. |
| "Does it text my clients?" | Not yet. You get a booking alert on your phone, and you have the client's number to call or text. |
| "What about Android?" | iPhone first; Android is coming soon. The booking link works on any phone. |
| "I'm too busy to set it up." | Setup is about 5 minutes: business name, services and prices, hours, and your payment link. |
| "What if a client doesn't pay the deposit?" | The booking still shows in your calendar, and you can cancel it. Many detailers only confirm once the deposit lands. |
| "Is my data safe?" | Each detailer's data is locked to their account, and you can delete everything from the app any time. |

## Giving the 3 free months (owner)
When one of the first 20 signs up, run in Supabase → SQL Editor (production), with their email:
```sql
update public.detailer_accounts
   set plan = 'pro', plan_renews_at = now() + interval '3 months'
 where detailer_id = (select id from auth.users where email = '[THEIR EMAIL]');
```
Pro ends by itself after 3 months unless they subscribe in the app. Keep a list of who got it (max 20).
