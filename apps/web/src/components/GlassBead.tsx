"use client";

import { motion, useMotionValue, useReducedMotion, useSpring, useTransform } from "motion/react";
import { useEffect, useId, type ReactNode } from "react";
import { useHydrated } from "@/lib/use-hydrated";

/**
 * A water bead resting on fresh ceramic: refracted interior (SVG displacement),
 * a caustic where light focuses through the drop, a rim light, and a specular
 * highlight that follows the pointer or phone tilt on a spring.
 */
export function GlassBead({ size = 132, children }: { size?: number; children?: ReactNode }) {
  const reduce = useReducedMotion();
  // Motion-value styles only after hydration: server HTML carries no style="" (CSP).
  const live = useHydrated();
  const id = useId().replace(/:/g, "");

  // -1..1 light direction, smoothed by springs so it feels liquid.
  const tx = useMotionValue(0);
  const ty = useMotionValue(0);
  const sx = useSpring(tx, { stiffness: 120, damping: 14, mass: 0.6 });
  const sy = useSpring(ty, { stiffness: 120, damping: 14, mass: 0.6 });
  // Highlight moves toward the light; the caustic moves the opposite way.
  const hx = useTransform(sx, (v) => v * 9);
  const hy = useTransform(sy, (v) => v * 7);
  const cx = useTransform(sx, (v) => v * -7);
  const cy = useTransform(sy, (v) => v * -3);

  useEffect(() => {
    if (reduce) return;
    const clamp = (v: number) => Math.max(-1, Math.min(1, v));
    const onPointer = (e: PointerEvent) => {
      tx.set(clamp((e.clientX / window.innerWidth) * 2 - 1));
      ty.set(clamp((e.clientY / window.innerHeight) * 2 - 1));
    };
    // Android exposes tilt without a prompt. iOS needs a permission prompt we
    // don't show here, so it falls back to the idle wobble.
    const onTilt = (e: DeviceOrientationEvent) => {
      if (e.gamma == null || e.beta == null) return;
      tx.set(clamp(e.gamma / 30));
      ty.set(clamp((e.beta - 45) / 30));
    };
    window.addEventListener("pointermove", onPointer, { passive: true });
    window.addEventListener("deviceorientation", onTilt, { passive: true });
    return () => {
      window.removeEventListener("pointermove", onPointer);
      window.removeEventListener("deviceorientation", onTilt);
    };
  }, [reduce, tx, ty]);

  // A sessile drop: round on top, slightly flattened where it sits on the paint.
  const drop = "M60 8 C88 8 110 30 110 60 C110 86 92 104 60 104 C28 104 10 86 10 60 C10 30 32 8 60 8Z";

  return (
    <div className="relative inline-block align-middle leading-none">
      <motion.svg
        viewBox="0 0 120 120"
        width={size}
        height={size}
        aria-hidden="true"
        className="block origin-[50%_87%] overflow-visible"
        animate={reduce ? undefined : { scaleX: [1, 1.025, 0.99, 1], scaleY: [1, 0.975, 1.01, 1] }}
        transition={reduce ? undefined : { duration: 3.2, repeat: Infinity, ease: "easeInOut" }}
      >
        <defs>
          <radialGradient id={`body-${id}`} cx="45%" cy="38%" r="70%">
            <stop offset="0" stopColor="#1B4A5C" />
            <stop offset="0.6" stopColor="#0E2730" />
            <stop offset="1" stopColor="#061318" />
          </radialGradient>
          <linearGradient id={`rim-${id}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#E8FBFF" stopOpacity="0.9" />
            <stop offset="0.45" stopColor="#4DD8FF" stopOpacity="0.35" />
            <stop offset="1" stopColor="#4DD8FF" stopOpacity="0.85" />
          </linearGradient>
          <radialGradient id={`caustic-${id}`} cx="50%" cy="50%" r="50%">
            <stop offset="0" stopColor="#B9F2FF" stopOpacity="0.9" />
            <stop offset="0.5" stopColor="#4DD8FF" stopOpacity="0.35" />
            <stop offset="1" stopColor="#4DD8FF" stopOpacity="0" />
          </radialGradient>
          <filter id={`refract-${id}`} x="-10%" y="-10%" width="120%" height="120%">
            <feTurbulence type="fractalNoise" baseFrequency="0.018" numOctaves="2" seed="4" result="noise" />
            <feDisplacementMap in="SourceGraphic" in2="noise" scale="9" xChannelSelector="R" yChannelSelector="G" />
          </filter>
          <filter id={`soft-${id}`}>
            <feGaussianBlur stdDeviation="1.6" />
          </filter>
          <clipPath id={`clip-${id}`}>
            <path d={drop} />
          </clipPath>
        </defs>

        {/* Contact shadow and the glow the bead throws onto the paint */}
        <ellipse cx="60" cy="108" rx="40" ry="6" fill="#000" opacity="0.45" filter={`url(#soft-${id})`} />
        <ellipse cx="60" cy="106" rx="30" ry="4" fill="#4DD8FF" opacity="0.18" filter={`url(#soft-${id})`} />

        <path d={drop} fill={`url(#body-${id})`} />

        {/* Refracted interior: the world seen through the drop, bent and flipped */}
        <g clipPath={`url(#clip-${id})`} filter={`url(#refract-${id})`} opacity="0.55">
          <rect x="0" y="66" width="120" height="40" fill="#4DD8FF" opacity="0.18" />
          <path d="M8 74 Q60 58 112 74" stroke="#9AE9FF" strokeWidth="2" fill="none" opacity="0.5" />
          <path d="M14 86 Q60 74 106 86" stroke="#4DD8FF" strokeWidth="1.5" fill="none" opacity="0.4" />
        </g>

        {/* Caustic: light focused through the bead lands low, opposite the highlight */}
        {live ? (
          <motion.ellipse cx="60" cy="88" rx="26" ry="11" fill={`url(#caustic-${id})`} style={{ x: cx, y: cy }} clipPath={`url(#clip-${id})`} />
        ) : (
          <ellipse cx="60" cy="88" rx="26" ry="11" fill={`url(#caustic-${id})`} clipPath={`url(#clip-${id})`} />
        )}

        <path d={drop} fill="none" stroke={`url(#rim-${id})`} strokeWidth="1.6" />

        {/* Specular highlight */}
        {live ? (
          <motion.g style={{ x: hx, y: hy }}>
            <ellipse cx="42" cy="32" rx="13" ry="8" fill="#fff" opacity="0.85" transform="rotate(-28 42 32)" filter={`url(#soft-${id})`} />
            <circle cx="78" cy="26" r="2.4" fill="#fff" opacity="0.7" />
          </motion.g>
        ) : (
          <g>
            <ellipse cx="42" cy="32" rx="13" ry="8" fill="#fff" opacity="0.85" transform="rotate(-28 42 32)" filter={`url(#soft-${id})`} />
            <circle cx="78" cy="26" r="2.4" fill="#fff" opacity="0.7" />
          </g>
        )}
      </motion.svg>
      {children && <div className="absolute inset-0 flex items-center justify-center pb-[8%]">{children}</div>}
    </div>
  );
}
