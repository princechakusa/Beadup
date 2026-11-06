"use client";

import { motion, useReducedMotion } from "motion/react";
import { useMemo } from "react";

type Bead = { x: number; size: number; delay: number; drift: number; fall: number };

function makeBeads(n: number): Bead[] {
  // Deterministic pseudo-random so the layout is stable between renders.
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  return Array.from({ length: n }, () => ({
    x: rnd() * 100,
    size: 6 + rnd() * 18,
    delay: rnd() * 0.6,
    drift: (rnd() - 0.5) * 30,
    fall: 120 + rnd() * 380,
  }));
}

export function BookedCelebration({
  businessName,
  when,
  paid,
  serviceName,
}: {
  businessName: string;
  when: string;
  paid: string;
  serviceName: string;
}) {
  const reduce = useReducedMotion();
  const beads = useMemo(() => makeBeads(22), []);

  return (
    <div className="relative mx-auto flex min-h-dvh w-full max-w-md flex-col items-center overflow-hidden px-5 pb-10 pt-20 text-center">
      {/* Beads land on the glass, then slide down like water on fresh ceramic */}
      {!reduce && (
        <div aria-hidden="true" className="pointer-events-none absolute inset-0">
          {beads.map((b, i) => (
            <motion.span
              key={i}
              className="absolute top-0 rounded-full"
              style={{
                left: `${b.x}%`,
                width: b.size,
                height: b.size * 1.08,
                background:
                  "radial-gradient(circle at 35% 30%, rgba(255,255,255,0.95), rgba(77,216,255,0.55) 40%, rgba(11,79,122,0.15) 100%)",
                boxShadow: "0 2px 6px rgba(0,0,0,0.35)",
              }}
              initial={{ y: -40, scaleX: 0.7, scaleY: 1.3, opacity: 0 }}
              animate={{
                y: [-40, b.fall * 0.35, b.fall * 0.35, b.fall],
                x: [0, 0, 0, b.drift],
                scaleX: [0.7, 1.25, 1, 0.9],
                scaleY: [1.3, 0.8, 1, 1.15],
                opacity: [0, 1, 1, 0],
              }}
              transition={{ duration: 2.6, delay: b.delay, times: [0, 0.18, 0.45, 1], ease: ["easeIn", "easeOut", "easeIn"] }}
            />
          ))}
        </div>
      )}

      <motion.div
        initial={reduce ? false : { scale: 0.4, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", stiffness: 260, damping: 16 }}
        className="relative flex h-[132px] w-[132px] items-center justify-center rounded-full border-2 border-bead bg-[#10262e] shadow-[0_0_60px_rgba(77,216,255,0.35)]"
      >
        {!reduce && (
          <motion.span
            aria-hidden="true"
            className="absolute inset-0 rounded-full border-2 border-bead"
            initial={{ scale: 1, opacity: 0.8 }}
            animate={{ scale: 1.8, opacity: 0 }}
            transition={{ duration: 1.2, delay: 0.25, ease: "easeOut" }}
          />
        )}
        <svg width="60" height="60" viewBox="0 0 24 24" fill="none" stroke="#4DD8FF" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <motion.path
            d="M5 12.5l4.5 4.5L19 7.5"
            initial={reduce ? false : { pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 0.5, delay: 0.3, ease: "easeOut" }}
          />
        </svg>
      </motion.div>

      <motion.div
        initial={reduce ? false : { y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ type: "spring", stiffness: 300, damping: 26, delay: 0.35 }}
        className="relative mt-8 w-full"
      >
        <h1 className="font-display text-[40px] font-extrabold leading-none tracking-[-0.03em]">You&apos;re booked</h1>
        <p className="mt-3 text-[15px] text-steel">
          {serviceName} with {businessName}
        </p>

        <div className="mt-8 rounded-[24px] border border-white/[0.08] bg-panel p-5 text-left shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
          <div className="flex justify-between py-1.5 text-[15px]">
            <span className="text-steel">When</span>
            <span className="font-semibold">{when}</span>
          </div>
          <div className="flex justify-between py-1.5 text-[15px]">
            <span className="text-steel">Paid today</span>
            <span className="font-display font-bold text-gold">{paid}</span>
          </div>
        </div>

        <p className="mt-6 text-[13px] leading-relaxed text-steel">
          Your receipt and confirmation are on their way by text and email. You&apos;ll get a reminder the day before.
        </p>
      </motion.div>
    </div>
  );
}
