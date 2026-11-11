import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";
import { Suspense } from "react";
import { createHash } from "node:crypto";
import { getBookingPage } from "@/lib/booking-page";
import { clientIp } from "@/lib/client-ip";
import { loadClientBooking } from "@/lib/client-booking";
import { wallClock } from "@/lib/ics";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { ManageBooking, type Availability } from "./ManageBooking";

// Private: never indexed, and the token in the URL is never sent to other sites.
export const metadata: Metadata = {
  title: "Your booking",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main id="main" className="relative mx-auto flex min-h-dvh w-full max-w-md flex-col px-5 py-10">
      <div aria-hidden="true" className="pointer-events-none fixed inset-x-0 top-0 -z-10 h-[480px] bg-[radial-gradient(ellipse_70%_60%_at_50%_0%,rgba(77,216,255,0.16),transparent)]" />
      {children}
    </main>
  );
}

function Message({ title, body, href, cta }: { title: string; body: string; href?: string; cta?: string }) {
  return (
    <div className="glass glass-edge my-auto rounded-[32px] px-6 py-10 text-center">
      <h1 className="font-display text-3xl font-extrabold">{title}</h1>
      <p className="mt-3 text-steel">{body}</p>
      {href && cta && (
        <Link href={href} className="mt-6 inline-flex h-12 items-center rounded-full bg-bead px-6 font-semibold text-midnight">
          {cta}
        </Link>
      )}
    </div>
  );
}

async function Booking({ params }: { params: PageProps<"/b/[token]">["params"] }) {
  const { token } = await params;

  // Page views are rate-limited per IP, so tokens can't be guessed by brute force
  // (they're 192-bit random anyway). Invalid and unknown tokens look the same.
  const db = supabaseAdmin();
  if (db) {
    const ip = clientIp(await headers());
    const key = `client-page:ip:${createHash("sha256").update(ip).digest("hex").slice(0, 32)}`;
    const { data: allowed } = await db.rpc("hit_rate_limit", { p_key: key, p_limit: 60, p_window_seconds: 600 });
    if (allowed !== true) return <Message title="Too many requests" body="Please wait a few minutes and try again." />;
  }

  const booking = await loadClientBooking(token);
  if (!booking) return <Message title="Link not found" body="This booking link isn't valid. Check you copied all of it." />;
  if (booking.expired) {
    return (
      <Message
        title="This link has expired"
        body={`Booking links stop working 30 days after the appointment. You can book ${booking.businessName} again any time.`}
        href={`/${booking.handle}`}
        cta={`Book ${booking.businessName}`}
      />
    );
  }

  // Open times for "ask for a new time", from the same data as the public page,
  // without this booking's own time (it would be moving).
  let availability: Availability | null = null;
  const live = booking.status === "confirmed" || booking.status === "pending_payment";
  if (live && Date.parse(booking.startsAt) > Date.now()) {
    const page = await getBookingPage(booking.handle);
    if (page) {
      const own = wallClock(booking.startsAt, booking.timezone);
      const ownStart = `${own.date} ${own.time}`;
      let removed = false;
      availability = {
        weeklySlots: page.weeklySlots,
        busy: page.busy.filter((b) => {
          if (!removed && b.start === ownStart && b.minutes === booking.durationMin) return !(removed = true);
          return true;
        }),
        bufferMin: page.bufferMin,
        daysOff: page.daysOff,
      };
    }
  }

  // The booking id stays on the server; the browser only has its own token.
  const { bookingId, ...view } = booking;
  void bookingId;
  return <ManageBooking token={token} booking={view} availability={availability} />;
}

export default function ClientBookingPage({ params }: PageProps<"/b/[token]">) {
  return (
    <Shell>
      <Suspense fallback={<p className="my-auto text-center text-steel">Loading your booking…</p>}>
        <Booking params={params} />
      </Suspense>
    </Shell>
  );
}
