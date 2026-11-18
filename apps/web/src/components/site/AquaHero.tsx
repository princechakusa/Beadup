import type { ReactNode } from "react";

const TINTS = {
  aqua: "aqua-aqua",
  sky: "aqua-sky",
  gold: "aqua-gold",
  mint: "aqua-mint",
  lilac: "aqua-lilac",
} as const;
export type AquaTint = keyof typeof TINTS;

/**
 * Top of a marketing page: iridescent aqua glass with water beads and a swoosh, a dark headline,
 * and room for a search field or chips. It slides up under the sticky header (the header is 76px
 * tall) and fades into the dark page below. Tailwind classes only (the CSP forbids inline styles).
 */
export function AquaHero({
  tint = "aqua",
  title,
  children,
  below,
}: {
  tint?: AquaTint;
  title: ReactNode;
  /** The line under the title. */
  children?: ReactNode;
  /** Search field, chips or buttons. */
  below?: ReactNode;
}) {
  return (
    <section className={`${TINTS[tint]} relative -mt-[76px] overflow-hidden pb-24 pt-[150px] text-[#0A2A33] sm:pt-[170px]`}>
      <div aria-hidden="true" className="aqua-bead pointer-events-none absolute right-[6%] top-[18%] hidden h-20 w-20 sm:block" />
      <div aria-hidden="true" className="aqua-bead pointer-events-none absolute right-[15%] top-[58%] hidden h-10 w-10 sm:block" />
      <div aria-hidden="true" className="aqua-bead pointer-events-none absolute left-[4%] top-[70%] hidden h-6 w-6 sm:block" />
      <div aria-hidden="true" className="pointer-events-none absolute -inset-x-24 bottom-16 h-40 -rotate-[4deg] rounded-[50%] border-t-[3px] border-white/70 blur-[1px]" />
      <div className="relative mx-auto w-full max-w-4xl px-5 text-center sm:px-8">
        <h1 className="enter text-balance font-display text-[36px] font-bold leading-[1.08] tracking-[-0.035em] sm:text-[52px]">{title}</h1>
        {children && <p className="enter d-1 mx-auto mt-4 max-w-2xl text-balance text-[17px] leading-relaxed text-[#254852] sm:text-lg">{children}</p>}
        {below && <div className="enter d-2 mt-8">{below}</div>}
      </div>
      <div aria-hidden="true" className="absolute inset-x-0 bottom-0 h-28 bg-gradient-to-b from-transparent to-midnight" />
    </section>
  );
}

/** A frosted chip for the hero (links to a page or a filter). */
export const heroChip =
  "inline-flex h-11 items-center rounded-full border border-white/80 bg-white/55 px-5 text-[15px] font-medium text-[#0A2A33] backdrop-blur transition-colors hover:bg-white/80";
