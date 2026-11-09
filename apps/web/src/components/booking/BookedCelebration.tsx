"use client";

import { motion, useReducedMotion } from "motion/react";
import { useEffect, useMemo } from "react";
import { haptic, playBookedChime } from "@/lib/feedback";
import { GlassBead } from "@/components/GlassBead";
import { useHydrated } from "@/lib/use-hydrated";

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
  celebrate = false,
  smsEnabled = false,
  payment,
}: {
  businessName: string;
  when: string;
  paid: string;
  serviceName: string;
  /** Play the chime and success haptic on mount (best effort: browsers may block audio without a gesture). */
  celebrate?: boolean;
  /** Mention texts only when they are actually sent. */
  smsEnabled?: boolean;
  /** External payments: the deposit is still to be paid to the detailer, via their link and/or note. */
  payment?: { link: string | null; note: string | null };
}) {
  const reduce = useReducedMotion();
  // The falling beads need inline sizes, so they render only after hydration
  // (server HTML has no style="" attributes: CSP). Entrances are CSS keyframes.
  const hydrated = useHydrated();
  useEffect(() => {
    if (!celebrate) return;
    haptic("success");
    playBookedChime();
  }, [celebrate]);
  const beads = useMemo(() => makeBeads(22), []);

  return (
    <main id="main" className="relative mx-auto flex min-h-dvh w-full max-w-md flex-col items-center overflow-hidden px-5 pb-10 pt-20 text-center">
      <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 h-[460px] bg-[radial-gradient(ellipse_70%_60%_at_50%_10%,rgba(77,216,255,0.2),transparent)]" />
      {/* Beads land on the glass, then slide down like water on fresh ceramic */}
      {!reduce && hydrated && (
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

      <div className="celebrate-pop relative origin-[50%_90%] drop-shadow-[0_0_40px_rgba(77,216,255,0.3)]">
        <span
          aria-hidden="true"
          className="ripple absolute bottom-[4%] left-1/2 h-4 w-[70%] -translate-x-1/2 rounded-[50%] border-2 border-bead motion-reduce:hidden"
        />
        <GlassBead size={148}>
          <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="#E8FBFF" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="drop-shadow-[0_0_8px_rgba(77,216,255,0.8)]">
            <path d="M5 12.5l4.5 4.5L19 7.5" pathLength={1} className="draw-check" />
          </svg>
        </GlassBead>
      </div>

      <div className="enter d-5 relative mt-8 w-full">
        <h1 className="text-gradient font-display text-[44px] font-extrabold leading-none tracking-[-0.04em]">You&apos;re booked</h1>
        <p className="mt-3 text-[15px] text-steel">
          {serviceName} with {businessName}
        </p>

        <div className="glass glass-edge mt-8 rounded-[24px] p-5 text-left">
          <div className="flex justify-between py-1.5 text-[15px]">
            <span className="text-steel">When</span>
            <span className="font-semibold">{when}</span>
          </div>
          <div className="flex justify-between py-1.5 text-[15px]">
            <span className="text-steel">{payment ? "Deposit to pay" : "Paid today"}</span>
            <span className="font-display font-bold text-gold">{paid}</span>
          </div>
        </div>

        {payment && (
          <div className="mt-4 rounded-[24px] border border-gold/30 bg-gold/[0.06] p-5 text-left">
            <p className="text-[15px] font-semibold">Pay your deposit to {businessName}</p>
            <p className="mt-1 text-[13px] leading-relaxed text-steel">
              Your time is held. Pay the {paid} deposit to secure it.
            </p>
            {payment.note && <p className="mt-3 whitespace-pre-line break-words text-[15px] font-medium">{payment.note}</p>}
            {payment.link && (
              <a
                href={payment.link}
                target="_blank"
                rel="noopener noreferrer nofollow"
                className="btn-sheen mt-4 flex h-[52px] items-center justify-center rounded-[18px] bg-gold font-bold text-midnight shadow-[0_10px_30px_rgba(255,181,71,0.3)] transition-transform active:scale-[0.98]"
              >
                Pay {paid} deposit
              </a>
            )}
            {!payment.link && !payment.note && (
              <p className="mt-3 text-[13px] text-steel">{businessName} will contact you about the deposit.</p>
            )}
          </div>
        )}

        <p className="mt-6 text-[13px] leading-relaxed text-steel">
          {payment
            ? "Need to change anything? Contact the detailer directly."
            : smsEnabled
              ? "Your receipt and confirmation are on their way by text and email. You'll get a reminder the day before."
              : "Your receipt is on its way by email. Need to change anything? Contact the detailer directly."}
        </p>
      </div>
    </main>
  );
}
