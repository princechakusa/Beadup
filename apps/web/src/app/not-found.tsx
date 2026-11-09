import type { Metadata } from "next";
import Link from "next/link";
import { GlassBead } from "@/components/GlassBead";
import { IconArrowRight } from "@/components/site/Icons";
import { SitePage } from "@/components/site/SiteChrome";

export const metadata: Metadata = { title: "Page not found", robots: { index: false } };

export default function NotFound() {
  return (
    <SitePage>
      <section className="mx-auto flex w-full max-w-2xl flex-col items-center px-5 pb-10 pt-20 text-center sm:pt-28">
        <div className="enter">
          <GlassBead size={120} />
        </div>
        <p className="enter d-1 mt-8 font-display text-sm font-bold tracking-[0.2em] text-bead">404</p>
        <h1 className="enter d-2 text-gradient mt-3 font-display text-[40px] font-extrabold leading-[1.05] tracking-[-0.04em] sm:text-6xl">
          This page rolled off
        </h1>
        <p className="enter d-3 mt-5 max-w-md text-lg leading-relaxed text-mist">
          We couldn&apos;t find that page. If you were looking for a detailer&apos;s booking link, check the spelling with
          them.
        </p>
        <div className="enter d-4 mt-9 flex flex-wrap justify-center gap-3">
          <Link
            href="/"
            className="btn-sheen inline-flex h-14 items-center gap-2 rounded-[18px] bg-bead px-6 font-bold text-bead-ink shadow-[0_14px_40px_-10px_rgba(77,216,255,0.6)]"
          >
            Go to the home page <IconArrowRight size={18} />
          </Link>
          <Link href="/support" className="inline-flex h-14 items-center rounded-[18px] border border-white/[0.12] bg-white/[0.04] px-6 font-semibold hover:bg-white/[0.08]">
            Get help
          </Link>
        </div>
      </section>
    </SitePage>
  );
}
