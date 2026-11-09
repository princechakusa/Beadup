import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { BookingFlow } from "@/components/booking/BookingFlow";
import { BusinessMicrodata } from "@/components/booking/BusinessMicrodata";
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
  const title = `Book ${d.businessName}${d.serviceArea ? ` · Mobile detailing in ${d.serviceArea}` : ""}`;
  const description = `${d.tagline ? `${d.tagline}. ` : ""}See prices and open times, then book online in under a minute. No app needed.`;
  const url = `/${d.handle}`;
  return {
    title: { absolute: title },
    description,
    alternates: { canonical: url },
    openGraph: { type: "website", title, description, url },
    twitter: { card: "summary_large_image", title, description },
  };
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
  return (
    <>
      <BusinessMicrodata detailer={detailer} />
      <BookingFlow detailer={detailer} smsEnabled={sms_enabled} />
    </>
  );
}

export default function BookingPage({ params }: PageProps<"/[handle]">) {
  return (
    <Suspense
      fallback={
        <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col gap-4 px-4 pt-6" aria-busy="true">
          <p className="sr-only">Loading…</p>
          <div className="flex items-center gap-3.5">
            <div className="h-14 w-14 animate-pulse rounded-[18px] bg-white/[0.06]" />
            <div className="flex flex-1 flex-col gap-2">
              <div className="h-4 w-2/3 animate-pulse rounded-full bg-white/[0.06]" />
              <div className="h-3 w-1/2 animate-pulse rounded-full bg-white/[0.04]" />
            </div>
          </div>
          <div className="mt-6 h-1.5 animate-pulse rounded-full bg-white/[0.06]" />
          <div className="mt-6 h-8 w-3/4 animate-pulse rounded-xl bg-white/[0.06]" />
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-20 animate-pulse rounded-[22px] bg-white/[0.04]" />
          ))}
        </main>
      }
    >
      <Booking params={params} />
    </Suspense>
  );
}
