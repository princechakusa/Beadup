"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { Phone, type ScreenName } from "./Phone";

export type WalkStep = {
  n: string;
  icon: ReactNode;
  title: string;
  body: string;
  screen: ScreenName;
};

/**
 * Scroll-driven walkthrough: on large screens the phone stays pinned while
 * the steps scroll past and its screen swaps; on small screens each step
 * carries its own phone. State changes only toggle data attributes, so the
 * server HTML has no inline styles (CSP).
 */
export function Walkthrough({ steps }: { steps: WalkStep[] }) {
  const [active, setActive] = useState(0);
  const refs = useRef<(HTMLLIElement | null)[]>([]);

  useEffect(() => {
    if (typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (!e.isIntersecting) continue;
          const i = Number((e.target as HTMLElement).dataset.step);
          if (!Number.isNaN(i)) setActive(i);
        }
      },
      // A step becomes active when it crosses the middle band of the viewport.
      { rootMargin: "-45% 0px -45% 0px", threshold: 0 },
    );
    refs.current.forEach((el) => el && io.observe(el));
    return () => io.disconnect();
  }, []);

  return (
    <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-20">
      {/* Pinned phone (large screens) */}
      <div className="hidden lg:block">
        <div className="sticky top-28 flex h-[calc(100dvh-8rem)] max-h-[760px] items-center justify-center">
          <div className="relative w-[300px]">
            <div aria-hidden="true" className="animate-drift pointer-events-none absolute -inset-20 rounded-full bg-[radial-gradient(closest-side,rgba(77,216,255,0.2),rgba(77,216,255,0))]" />
            <div className="relative aspect-[922/2010]">
              {steps.map((s, i) => (
                <div
                  key={s.n}
                  data-active={i === active ? "true" : "false"}
                  className="walk-screen absolute inset-0"
                  aria-hidden={i !== active}
                >
                  <Phone screen={s.screen} glow={false} sizes="300px" />
                </div>
              ))}
            </div>
            {/* Step dots */}
            <ol aria-hidden="true" className="absolute -right-10 top-1/2 flex -translate-y-1/2 flex-col gap-2.5">
              {steps.map((s, i) => (
                <li key={s.n} data-active={i === active ? "true" : "false"} className="walk-dot h-2 w-2 rounded-full bg-white/20" />
              ))}
            </ol>
          </div>
        </div>
      </div>

      {/* Steps */}
      <ol className="flex flex-col gap-6 lg:gap-[22vh] lg:py-[14vh]">
        {steps.map((s, i) => (
          <li
            key={s.n}
            data-step={i}
            data-active={i === active ? "true" : "false"}
            ref={(el) => {
              refs.current[i] = el;
            }}
            className="walk-step glass glass-edge spot flex flex-col overflow-hidden rounded-[30px] lg:bg-transparent lg:shadow-none lg:backdrop-blur-none"
          >
            <div className="flex flex-col gap-3 p-7 pb-0 lg:p-8">
              <div className="flex items-center justify-between">
                <span className="walk-icon flex h-11 w-11 items-center justify-center rounded-[14px] border border-bead/25 bg-bead/10 text-bead transition-all duration-500">
                  {s.icon}
                </span>
                <span className="font-display text-sm font-bold tracking-[0.1em] text-steel/70">{s.n}</span>
              </div>
              <h3 className="mt-2 font-display text-[24px] font-bold tracking-[-0.02em] lg:text-[30px]">{s.title}</h3>
              <p className="text-[15px] leading-relaxed text-steel lg:text-[17px]">{s.body}</p>
            </div>
            <div className="relative mt-8 h-[300px] overflow-hidden lg:hidden">
              <div className="mx-auto w-[64%]">
                <Phone screen={s.screen} glow={false} sizes="60vw" />
              </div>
              <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-[#12161c] to-transparent" />
            </div>
            <div className="hidden h-8 lg:block" />
          </li>
        ))}
      </ol>
    </div>
  );
}
