import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { BookingFlow } from "@/components/booking/BookingFlow";
import { getBookingPage } from "@/lib/booking-page";
import { getPublicConfig } from "@/lib/site";

// Cache Components needs at least one param. "marcus" is the seeded demo
// detailer used for App Review; other handles render on first visit.
export function generateStaticParams() {
  return [{ handle: "marcus" }];
}

export async function generateMetadata({ params }: PageProps<"/[handle]">): Promise<Metadata> {
  const { handle } = await params;
  const d = await getBookingPage(handle);
  if (!d) return { title: "Not found" };
  return { title: `Book ${d.businessName}`, description: `${d.tagline}. Book and pay a deposit in under a minute.` };
}

// The handle lookup runs inside <Suspense>: handles that aren't prerendered
// are rendered on first visit, and Cache Components refuses to read `params`
// outside a Suspense boundary there (NEXT_STATIC_GEN_BAILOUT -> 500 on
// Netlify). Unknown handles still get a real 404 from src/proxy.ts.
async function Booking({ params }: { params: PageProps<"/[handle]">["params"] }) {
  const { handle } = await params;
  const detailer = await getBookingPage(handle);
  // A detailer with no active services has nothing to book yet.
  if (!detailer || detailer.services.length === 0) notFound();
  const { sms_enabled } = await getPublicConfig();
  return <BookingFlow detailer={detailer} smsEnabled={sms_enabled} />;
}

export default function BookingPage({ params }: PageProps<"/[handle]">) {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-dvh items-center justify-center" aria-busy="true">
          <p className="text-steel">Loading…</p>
        </main>
      }
    >
      <Booking params={params} />
    </Suspense>
  );
}
