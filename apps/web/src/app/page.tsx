import Link from "next/link";
import { BeadLogo } from "@/components/BeadLogo";

export default function Home() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center px-6">
      <div className="flex items-center gap-3">
        <BeadLogo size={56} />
        <span className="font-display text-5xl font-extrabold tracking-[-0.04em]">beadup</span>
      </div>
      <p className="mt-5 text-xl leading-relaxed text-[#c9d0dc]">
        Quote, book and get paid from your phone. Built for mobile detailers.
      </p>
      <Link
        href="/marcus"
        className="mt-10 inline-flex h-14 items-center justify-center rounded-[18px] bg-bead px-6 font-bold text-bead-ink shadow-[0_10px_30px_rgba(77,216,255,0.35)]"
      >
        See a demo booking page
      </Link>
    </main>
  );
}
