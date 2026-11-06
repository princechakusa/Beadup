import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BookingFlow } from "@/components/booking/BookingFlow";
import { getBookingPage } from "@/lib/booking-page";

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

export default async function BookingPage({ params }: PageProps<"/[handle]">) {
  const { handle } = await params;
  const detailer = await getBookingPage(handle);
  // A detailer with no active services has nothing to book yet.
  if (!detailer || detailer.services.length === 0) notFound();
  return <BookingFlow detailer={detailer} />;
}
