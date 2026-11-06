import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BookingFlow } from "@/components/booking/BookingFlow";
import { demoHandles, getDetailer } from "@/lib/demo";

const HANDLE_RE = /^[a-z0-9][a-z0-9-]{1,39}$/i;

export function generateStaticParams() {
  return demoHandles().map((handle) => ({ handle }));
}

export async function generateMetadata({ params }: PageProps<"/[handle]">): Promise<Metadata> {
  const { handle } = await params;
  const d = HANDLE_RE.test(handle) ? getDetailer(handle) : null;
  if (!d) return { title: "Not found" };
  return { title: `Book ${d.businessName}`, description: `${d.tagline}. Book and pay a deposit in under a minute.` };
}

export default async function BookingPage({ params }: PageProps<"/[handle]">) {
  const { handle } = await params;
  if (!HANDLE_RE.test(handle)) notFound();
  const detailer = getDetailer(handle);
  if (!detailer) notFound();
  return <BookingFlow detailer={detailer} />;
}
