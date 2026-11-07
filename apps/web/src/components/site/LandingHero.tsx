"use client";

import { motion, useReducedMotion } from "motion/react";
import { GlassBead } from "@/components/GlassBead";

const spring = { type: "spring", stiffness: 260, damping: 24 } as const;

/** Hero: staggered headline, floating phone mock, a deposit toast that pops in. */
export function LandingHero({ freeBookings }: { freeBookings: number }) {
  const reduce = useReducedMotion();
  const rise = (delay: number) =>
    // The server can't know the visitor's motion setting, so it renders the
    // hidden start state. Under Reduce Motion we still animate *to* visible,
    // just instantly; dropping the props left the hero invisible.
    reduce
      ? { initial: { opacity: 0, y: 0 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0 } }
      : { initial: { opacity: 0, y: 18 }, animate: { opacity: 1, y: 0 }, transition: { ...spring, delay } };

  return (
    <section className="relative mx-auto grid w-full max-w-6xl items-center gap-14 px-5 pt-8 sm:px-10 lg:grid-cols-[1fr_420px] lg:pt-16">
      <div className="flex flex-col gap-6">
        <motion.span
          {...rise(0)}
          className="self-start rounded-full border border-bead/30 bg-bead/10 px-3.5 py-2 text-[13px] font-semibold text-bead"
        >
          Built for mobile detailers
        </motion.span>
        <motion.h1
          {...rise(0.06)}
          className="font-display text-[52px] font-extrabold leading-[0.98] tracking-[-0.045em] sm:text-[76px]"
        >
          Quote. Book.
          <br />
          Get paid.
        </motion.h1>
        <motion.p {...rise(0.12)} className="max-w-[540px] text-lg leading-relaxed text-[#c9d0dc] sm:text-[21px]">
          Snap photos, send an AI-priced quote in a minute, and collect a deposit before you drive out. Fewer no-shows,
          more booked days.
        </motion.p>
        <motion.div {...rise(0.18)} id="get-the-app" className="flex flex-wrap items-center gap-3">
          <a
            href="#get-the-app"
            className="inline-flex h-[58px] items-center rounded-[20px] bg-bead px-7 text-base font-bold text-bead-ink shadow-[0_10px_30px_rgba(77,216,255,0.35)]"
          >
            Download for iPhone
          </a>
          <a
            href="#get-the-app"
            className="inline-flex h-[58px] items-center rounded-[20px] border border-white/[0.12] bg-white/[0.05] px-7 text-base font-semibold"
          >
            Android
          </a>
        </motion.div>
        <motion.span {...rise(0.24)} className="text-sm text-steel">
          Free for up to {freeBookings} bookings a month. Coming soon to the App Store and Google Play.
        </motion.span>
      </div>

      <div className="relative mx-auto h-[600px] w-[340px] sm:w-[420px]" aria-hidden="true">
        <div className="pointer-events-none absolute -inset-24 rounded-full bg-[radial-gradient(circle,rgba(77,216,255,0.18),rgba(77,216,255,0)_65%)]" />
        <motion.div
          className="absolute left-1/2 top-0 h-[580px] w-[290px] -translate-x-1/2 rounded-[44px] border border-white/[0.12] bg-[#0e1218] px-4 py-6 shadow-[0_40px_90px_rgba(0,0,0,0.65),0_0_120px_rgba(77,216,255,0.14)]"
          animate={reduce ? undefined : { y: [0, -10, 0] }}
          transition={reduce ? undefined : { duration: 6, repeat: Infinity, ease: "easeInOut" }}
        >
          <div className="flex flex-col gap-3">
            <span className="text-xs text-steel">Earned this week</span>
            <span className="font-display text-[40px] font-extrabold tracking-[-0.05em]">$1,840</span>
            <svg width="258" height="70" viewBox="0 0 268 70">
              <defs>
                <linearGradient id="hero-fill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0" stopColor="#4DD8FF" stopOpacity="0.35" />
                  <stop offset="1" stopColor="#4DD8FF" stopOpacity="0" />
                </linearGradient>
              </defs>
              <path d="M0 56 C24 54 32 40 54 44 C78 48 86 30 108 36 C132 42 142 18 166 14 C196 10 214 8 268 8 L268 70 L0 70Z" fill="url(#hero-fill)" />
              <motion.path
                d="M0 56 C24 54 32 40 54 44 C78 48 86 30 108 36 C132 42 142 18 166 14 C196 10 214 8 268 8"
                fill="none"
                stroke="#4DD8FF"
                strokeWidth="2.5"
                strokeLinecap="round"
                initial={reduce ? false : { pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{ duration: 1.4, delay: 0.4, ease: "easeOut" }}
              />
            </svg>
            <div className="flex flex-col gap-1.5 rounded-[22px] border border-bead/35 bg-[#0f1a20] p-3.5">
              <span className="font-display text-[15px] font-bold">Full detail · Model Y</span>
              <span className="text-xs text-steel">9:30 AM · Deposit paid</span>
              <span className="font-display font-bold text-gold">$240</span>
            </div>
            <div className="flex flex-col gap-1 rounded-[22px] border border-white/[0.08] bg-panel p-3.5">
              <span className="text-sm font-semibold">Interior refresh · F-150</span>
              <span className="text-xs text-steel">Quote sent</span>
            </div>
            <div className="mt-4 flex justify-center">
              <GlassBead size={84} />
            </div>
          </div>
        </motion.div>
        <motion.div
          className="absolute left-0 top-[400px] flex items-center gap-3 rounded-[22px] border border-white/[0.12] bg-[rgba(28,33,42,0.85)] px-4 py-3.5 shadow-[0_20px_40px_rgba(0,0,0,0.5)] backdrop-blur-xl"
          initial={reduce ? false : { opacity: 0, scale: 0.6, x: -20 }}
          animate={{ opacity: 1, scale: 1, x: 0 }}
          transition={{ type: "spring", stiffness: 380, damping: 18, delay: 1.2 }}
        >
          <div className="flex h-[38px] w-[38px] items-center justify-center rounded-xl bg-mint/15 text-mint">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12.5l4.5 4.5L19 7.5" />
            </svg>
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-semibold">Jenna paid $72</span>
            <span className="text-xs text-steel">Deposit received</span>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
