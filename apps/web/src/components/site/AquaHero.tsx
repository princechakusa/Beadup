import type { ReactNode } from "react";

/**
 * Top of every marketing page: one clean aqua gradient, a dark headline and room for a search field or
 * chips. It slides up under the sticky header (76px tall) and ends in a clean rounded edge above the dark page.
 * Tailwind classes only (the CSP forbids inline styles).
 */
export function AquaHero({
  title,
  children,
  below,
}: {
  title: ReactNode;
  /** The line under the title. */
  children?: ReactNode;
  /** Search field, chips or buttons. */
  below?: ReactNode;
}) {
  return (
    <section className="aqua-hero relative -mt-[76px] overflow-hidden rounded-b-[40px] pb-14 pt-[150px] text-[#0A2A33] sm:pt-[170px]">
      {/* Our own water photo (generated for Beadup); the gradient above is the fallback while it loads. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/hero/aqua-water.webp" alt="" fetchPriority="high" className="pointer-events-none absolute inset-0 h-full w-full object-cover object-[72%_center]" />
      {/* Phones: a light veil so the dark text stays readable over the splash. */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-white/30 sm:bg-transparent" />
      <div className="relative mx-auto w-full max-w-4xl px-5 text-center sm:px-8">
        <h1 className="enter text-balance font-display text-[36px] font-bold leading-[1.08] tracking-[-0.035em] sm:text-[52px]">{title}</h1>
        {children && <p className="enter d-1 mx-auto mt-4 max-w-2xl text-balance text-[17px] leading-relaxed text-[#254852] sm:text-lg">{children}</p>}
        {below && <div className="enter d-2 mt-8">{below}</div>}
      </div>
    </section>
  );
}

/** A frosted chip for the hero (links to a page or a filter). */
export const heroChip =
  "inline-flex h-11 items-center rounded-full border border-white/80 bg-white/55 px-5 text-[15px] font-medium text-[#0A2A33] backdrop-blur transition-colors hover:bg-white/80";
