# Why clients and detailers stay on calls and WhatsApp, and what Beadup does about it (2026-11-12)

Desk research (web search). Most figures come from booking-software vendors, so treat numbers as directional.

## What the evidence says
1. **People want it fast and confirmed by a person.** Surveys report most consumers prefer booking online (GetApp 2025:
   67%; Solutionreach: 67% vs 22% phone), but in a business-travel poll about half of those who left the online
   system did so because they wanted a real person to confirm. Messaging is where that confirmation happens; in
   markets like Singapore, Lebanon and South Africa that means WhatsApp.
2. **Friction loses bookings.** Forced account creation (24%) and long or complicated checkouts (22%) are top
   reasons people abandon online purchases (Baymard, cited via hotel-industry coverage); surprise costs at the last
   step are another.
3. **Trust in a stranger.** For a service that comes to your home, people want to know who is coming and see their
   work before committing; on WhatsApp they ask for photos and a face.
4. **No-shows are the cost.** Vendor data: reminders cut no-shows ~29-39%; deposits ~29-70%; a confirmation +
   24 h + 2 h sequence is reported at ~5% no-shows vs ~23% without.
5. **WhatsApp alone has no structure.** No prices, no calendar, no deposit record, no receipt; details get lost in
   the thread and the detailer double-books.

## What Beadup does (implemented)
| Need | Beadup |
|---|---|
| Fast, no account | 5 steps, no app, no sign-up; total shown before booking |
| Confirmed by a person | Detailer's push alert + one-tap **Confirm on WhatsApp** with the client's booking link |
| Trust | **Detailer photo** and **Recent work** gallery on the booking page; rating average |
| Keep WhatsApp | WhatsApp buttons on the booking page, confirmation, client page and receipt (prefilled, free `wa.me` links) |
| No-shows | 30% deposit; **Reminder** template and a "Remind" row for tomorrow's jobs on Today |
| After the job | **Receipt** (print / save PDF) + rating on one link, sent on WhatsApp or Messages |
| Local money | Currency follows the business country everywhere, onboarding starts in the phone's country |

## Positioning
"Beadup is the booking link that works with WhatsApp, not against it": clients book in seconds and chat where they
already are; detailers get prices, a calendar, deposits, reminders, receipts and reviews without typing.

## Sources
- https://fieldcamp.ai/blog/whatsapp-booking-system-for-service-companies
- https://www.energise.co.nz/blog/online-booking-vs-phone-calls-nz/
- https://dev.to/alessandrobinda114/online-booking-vs-phone-booking-why-you-are-losing-40-of-appointments-2cgb
- https://www.cxnetwork.com/cx-service-support/articles/use-of-whatsapp-by-smes-for-better-customer-service
- https://voxire.pages.dev/blog/online-booking-system-lebanon-2026/
- https://travelmole.com/news/problems-with-self-booked-travel
- https://www.travelport.com/blog/abandonment-issues
- https://www.hotel-online.com/press_releases/release/why-do-guests-abandon-hotel-bookings-what-every-hotelier-needs-to-know/
- https://www.kitomba.com/blog/reduce-no-shows-in-your-salon-proven-strategies-that-actually-work/
- https://heygoldie.com/blog/digital-booking-and-deposits-for-stylists
- https://simplybook.me/en/reduce-salon-clinic-no-shows
- https://bird.com/explained/whatsapp/what-is-a-whatsapp-click-to-chat-link
