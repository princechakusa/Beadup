import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { z } from "zod";
import { BookedCelebration } from "@/components/booking/BookedCelebration";
import { formatUsd } from "@/lib/pricing";
import { stripe } from "@/lib/stripe";
import { supabaseAdmin } from "@/lib/supabase-admin";

export const metadata: Metadata = { title: "Booking confirmation", robots: { index: false, follow: false } };

const receiptSchema = z.object({
  bookingId: z.uuid(),
  status: z.string(),
  paymentStatus: z.string(),
  businessName: z.string(),
  serviceName: z.string(),
  timezone: z.string(),
  startsAt: z.string(),
  paidCents: z.number().int(),
  stripeAccountId: z.string().nullable(),
});

const query = z.object({ b: z.uuid(), session_id: z.string().regex(/^cs_[A-Za-z0-9_]{10,250}$/) });

function formatWhen(iso: string, timeZone: string) {
  const d = new Date(iso);
  const day = d.toLocaleDateString("en-US", { timeZone, weekday: "long", month: "short", day: "numeric" });
  const time = d.toLocaleTimeString("en-US", { timeZone, hour: "numeric", minute: "2-digit" });
  return `${day} · ${time}`;
}

async function Receipt({ searchParams }: { searchParams: PageProps<"/[handle]/booked">["searchParams"] }) {
  const parsed = query.safeParse(await searchParams);
  const db = supabaseAdmin();
  if (!parsed.success || !db) return <NotFound />;

  const { data } = await db.rpc("booking_receipt", { p_booking_id: parsed.data.b, p_session_id: parsed.data.session_id });
  const r = receiptSchema.safeParse(data);
  if (!r.success) return <NotFound />;
  const receipt = r.data;

  // The webhook usually lands first. If not, ask Stripe directly so the
  // client never sees "pending" for a payment that already went through.
  let paid = receipt.paymentStatus === "succeeded";
  const s = stripe();
  if (!paid && s && receipt.stripeAccountId) {
    const session = await s.checkout.sessions.retrieve(parsed.data.session_id, undefined, {
      stripeAccount: receipt.stripeAccountId,
    });
    paid = session.payment_status === "paid";
  }

  if (!paid) {
    return (
      <Shell>
        <h1 className="font-display text-3xl font-extrabold">Payment not finished</h1>
        <p className="mt-3 text-steel">We haven&apos;t received your deposit yet. Your time is held for 30 minutes.</p>
      </Shell>
    );
  }

  return (
    <BookedCelebration
      businessName={receipt.businessName}
      serviceName={receipt.serviceName}
      when={formatWhen(receipt.startsAt, receipt.timezone)}
      paid={formatUsd(receipt.paidCents)}
      celebrate
    />
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col items-center justify-center px-5 text-center">{children}</main>;
}

function NotFound() {
  return (
    <Shell>
      <h1 className="font-display text-3xl font-extrabold">Booking not found</h1>
      <p className="mt-3 text-steel">This confirmation link isn&apos;t valid. Check the text or email we sent you.</p>
      <Link href="/" className="mt-6 text-bead underline-offset-4 hover:underline">
        Go to Beadup
      </Link>
    </Shell>
  );
}

export default function BookedPage(props: PageProps<"/[handle]/booked">) {
  return (
    <Suspense fallback={<Shell><p className="text-steel">Confirming your booking…</p></Shell>}>
      <Receipt searchParams={props.searchParams} />
    </Suspense>
  );
}
