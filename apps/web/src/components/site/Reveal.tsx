"use client";

import { useEffect, useRef, type ElementType, type ReactNode } from "react";

/**
 * Fades and lifts content in as it scrolls into view. Server HTML is fully
 * visible; after hydration, only content still below the fold is hidden
 * (via a data attribute, never an inline style, for the CSP) and revealed on
 * scroll. Reduced Motion shows everything at once (globals.css).
 */
export function Reveal({
  children,
  as: Tag = "div",
  className,
  delay = 0,
  id,
}: {
  children: ReactNode;
  as?: ElementType;
  className?: string;
  /** Stagger in ms, applied as a transition-delay class step (0, 80, 160, 240). */
  delay?: 0 | 80 | 160 | 240;
  id?: string;
}) {
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (el.getBoundingClientRect().top < window.innerHeight * 0.92) return;
    el.dataset.reveal = "hidden";
    const io = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        el.dataset.reveal = "shown";
        io.disconnect();
      },
      { rootMargin: "0px 0px -8% 0px", threshold: 0.12 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const stagger = delay === 80 ? "delay-[80ms]" : delay === 160 ? "delay-[160ms]" : delay === 240 ? "delay-[240ms]" : "";
  return (
    <Tag ref={ref} id={id} className={`${stagger} ${className ?? ""}`}>
      {children}
    </Tag>
  );
}
