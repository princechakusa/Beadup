"use client";

import Link from "next/link";
import { useEffect } from "react";
import { BeadLogo } from "@/components/BeadLogo";

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main id="main" className="mx-auto flex min-h-dvh w-full max-w-lg flex-col items-center justify-center px-5 py-16 text-center">
      <BeadLogo size={56} animate={false} />
      <h1 className="text-gradient mt-8 font-display text-4xl font-extrabold tracking-[-0.04em] sm:text-5xl">Something slipped</h1>
      <p className="mt-4 text-lg leading-relaxed text-mist">
        That didn&apos;t load the way it should. Try again, and if it keeps happening, let us know.
      </p>
      {error.digest && <p className="mt-3 font-mono text-xs text-steel">Reference {error.digest}</p>}
      <div className="mt-9 flex flex-wrap justify-center gap-3">
        <button
          type="button"
          onClick={reset}
          className="btn-sheen inline-flex h-14 items-center rounded-[18px] bg-bead px-6 font-bold text-bead-ink shadow-[0_14px_40px_-10px_rgba(77,216,255,0.6)]"
        >
          Try again
        </button>
        <Link href="/support" className="inline-flex h-14 items-center rounded-[18px] border border-white/[0.12] bg-white/[0.04] px-6 font-semibold hover:bg-white/[0.08]">
          Contact support
        </Link>
      </div>
    </main>
  );
}
