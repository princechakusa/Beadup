"use client";

import { motion, useMotionValue, useReducedMotion, useSpring, useTransform } from "motion/react";
import type { ReactNode } from "react";
import { useHydrated } from "@/lib/use-hydrated";

/**
 * Tilts its content toward the pointer on a soft spring, like turning a phone
 * in the light. Plain markup until hydrated (no inline styles in server HTML).
 */
export function Tilt({ children, className = "", max = 8 }: { children: ReactNode; className?: string; max?: number }) {
  const hydrated = useHydrated();
  const reduce = useReducedMotion();
  const px = useMotionValue(0);
  const py = useMotionValue(0);
  const sx = useSpring(px, { stiffness: 140, damping: 18, mass: 0.6 });
  const sy = useSpring(py, { stiffness: 140, damping: 18, mass: 0.6 });
  const rotateY = useTransform(sx, (v) => v * max);
  const rotateX = useTransform(sy, (v) => v * -max);

  if (!hydrated || reduce) return <div className={className}>{children}</div>;
  return (
    <motion.div
      className={`${className} [transform-style:preserve-3d]`}
      style={{ rotateX, rotateY, transformPerspective: 1200 }}
      onPointerMove={(e) => {
        if (e.pointerType !== "mouse") return;
        const r = e.currentTarget.getBoundingClientRect();
        px.set(((e.clientX - r.left) / r.width) * 2 - 1);
        py.set(((e.clientY - r.top) / r.height) * 2 - 1);
      }}
      onPointerLeave={() => {
        px.set(0);
        py.set(0);
      }}
    >
      {children}
    </motion.div>
  );
}
