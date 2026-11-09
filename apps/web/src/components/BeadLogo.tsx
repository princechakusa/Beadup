"use client";

import { motion, useReducedMotion } from "motion/react";
import { useId } from "react";
import { useHydrated } from "@/lib/use-hydrated";

/**
 * The Beadup water bead. On mount it drops in, squashes on impact and
 * wobbles to rest like water on a fresh ceramic coat (spring physics).
 * The drop plays once hydrated, so the server HTML has no inline styles (CSP).
 */
export function BeadLogo({ size = 40, animate = true }: { size?: number; animate?: boolean }) {
  const reduce = useReducedMotion();
  const hydrated = useHydrated();
  const gid = useId().replace(/:/g, "");
  const live = animate && !reduce && hydrated;

  return (
    <motion.svg
      // Remount once hydrated so the drop-in starts from its initial state.
      key={live ? "live" : "still"}
      width={size}
      height={size}
      viewBox="0 0 48 48"
      role="img"
      aria-label="Beadup"
      className="origin-bottom"
      initial={live ? { y: -size * 0.6, scaleX: 0.85, scaleY: 1.15, opacity: 0 } : undefined}
      animate={
        live
          ? { y: 0, opacity: 1, scaleX: [0.85, 1.22, 0.92, 1.05, 1], scaleY: [1.15, 0.78, 1.08, 0.97, 1] }
          : undefined
      }
      transition={{
        y: { type: "spring", stiffness: 520, damping: 18 },
        opacity: { duration: 0.15 },
        scaleX: { duration: 0.9, times: [0, 0.28, 0.5, 0.75, 1], ease: "easeOut" },
        scaleY: { duration: 0.9, times: [0, 0.28, 0.5, 0.75, 1], ease: "easeOut" },
      }}
    >
      <defs>
        <radialGradient id={`bead-${gid}`} cx="38%" cy="32%" r="75%">
          <stop offset="0" stopColor="#E8FBFF" />
          <stop offset="0.35" stopColor="#4DD8FF" />
          <stop offset="1" stopColor="#0B4F7A" />
        </radialGradient>
      </defs>
      <path d="M24 4 C24 4 9 20 9 30 a15 15 0 0 0 30 0 C39 20 24 4 24 4Z" fill={`url(#bead-${gid})`} />
      <ellipse cx="18" cy="27" rx="4" ry="6" fill="#fff" opacity="0.75" transform="rotate(-20 18 27)" />
    </motion.svg>
  );
}
