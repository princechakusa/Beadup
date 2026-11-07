import Link from "next/link";
import type { ReactNode } from "react";
import { BeadLogo } from "@/components/BeadLogo";

export function SiteHeader() {
  return (
    <header className="relative z-10 mx-auto flex w-full max-w-6xl items-center justify-between px-5 py-6 sm:px-10">
      <Link href="/" className="flex items-center gap-2.5" aria-label="Beadup home">
        <BeadLogo size={34} animate={false} />
        <span className="font-display text-2xl font-extrabold tracking-[-0.04em]">beadup</span>
      </Link>
      <nav className="flex items-center gap-5 text-[15px] font-medium text-[#c9d0dc] sm:gap-8">
        <Link href="/#features" className="hidden hover:text-paint sm:inline">
          Features
        </Link>
        <Link href="/pricing" className="hover:text-paint">
          Pricing
        </Link>
        <Link href="/support" className="hidden hover:text-paint sm:inline">
          Support
        </Link>
        <Link
          href="/#get-the-app"
          className="inline-flex h-11 items-center rounded-full bg-bead px-5 font-bold text-bead-ink shadow-[0_8px_24px_rgba(77,216,255,0.3)]"
        >
          Get the app
        </Link>
      </nav>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="mx-auto mt-24 flex w-full max-w-6xl flex-col gap-4 border-t border-white/[0.06] px-5 py-10 text-[13px] text-steel sm:flex-row sm:items-center sm:justify-between sm:px-10">
      <span>© Beadup</span>
      <nav className="flex flex-wrap gap-x-6 gap-y-2 text-steel">
        <Link href="/privacy" className="hover:text-paint">
          Privacy
        </Link>
        <Link href="/terms" className="hover:text-paint">
          Terms
        </Link>
        <Link href="/support" className="hover:text-paint">
          Support
        </Link>
        <Link href="/delete-account" className="hover:text-paint">
          Delete account
        </Link>
      </nav>
    </footer>
  );
}

/** Long-form page layout for policies and help. */
export function DocPage({ title, updated, children }: { title: string; updated?: string; children: ReactNode }) {
  return (
    <>
      <SiteHeader />
      <main className="mx-auto w-full max-w-3xl px-5 pt-8 sm:px-10">
        <h1 className="font-display text-4xl font-extrabold tracking-[-0.03em] sm:text-5xl">{title}</h1>
        {updated && <p className="mt-3 text-sm text-steel">Last updated {updated}</p>}
        <div className="doc mt-10 space-y-5 text-[16px] leading-relaxed text-[#c9d0dc]">{children}</div>
      </main>
      <SiteFooter />
    </>
  );
}
