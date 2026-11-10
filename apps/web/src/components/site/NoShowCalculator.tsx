"use client";

import { useEffect, useRef, useState } from "react";
import { IconWallet } from "./Icons";

const money = (n: number) => `$${Math.round(n).toLocaleString("en-US")}`;

/** Eases a number toward its target on every change (text only, no inline styles). */
function useTween(target: number, ms = 600) {
  const [v, setV] = useState(target);
  const from = useRef(target);
  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const start = performance.now();
    const a = from.current;
    let raf = 0;
    const tick = (now: number) => {
      const t = reduce ? 1 : Math.min(1, (now - start) / ms);
      const e = 1 - Math.pow(1 - t, 3);
      const cur = a + (target - a) * e;
      setV(cur);
      from.current = cur;
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, ms]);
  return v;
}

/**
 * "What do no-shows cost you?" The visitor's own numbers, nothing invented:
 * jobs a week × average ticket × no-show rate, and what a 30% deposit keeps.
 */
export function NoShowCalculator() {
  const [jobs, setJobs] = useState(10);
  const [ticket, setTicket] = useState(180);
  const [rate, setRate] = useState(15);

  const monthlyJobs = jobs * 4.33;
  const missed = monthlyJobs * (rate / 100);
  const lost = missed * ticket;
  const kept = lost * 0.3;
  const lostV = useTween(lost);
  const keptV = useTween(kept);
  const missedV = useTween(missed, 400);

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,440px)] lg:gap-12">
      <div className="flex flex-col gap-7">
        <Slider id="calc-jobs" label="Jobs a week" value={jobs} min={2} max={40} step={1} onChange={setJobs} display={`${jobs}`} />
        <Slider id="calc-ticket" label="Average ticket" value={ticket} min={60} max={600} step={10} onChange={setTicket} display={money(ticket)} />
        <Slider id="calc-rate" label="No-show rate" value={rate} min={0} max={40} step={1} onChange={setRate} display={`${rate}%`} />
        <p className="text-[13px] leading-relaxed text-steel">
          Detailers report anywhere from one in ten to one in four bookings never showing. Use your own number; the math is
          yours.
        </p>
      </div>

      <div className="glass glass-edge spot relative flex flex-col gap-6 overflow-hidden rounded-[30px] p-7 sm:p-8" aria-live="polite">
        <div aria-hidden="true" className="pointer-events-none absolute -right-24 -top-24 h-64 w-64 rounded-full bg-[radial-gradient(closest-side,rgba(255,181,71,0.18),transparent)]" />
        <div className="flex flex-col gap-1.5">
          <span className="text-[13px] font-medium text-steel">Lost to no-shows each month</span>
          <span className="font-display text-[48px] font-extrabold leading-none tracking-[-0.045em] text-paint tabular-nums sm:text-[58px]">
            {money(lostV)}
          </span>
          <span className="text-[13px] text-steel">About {missedV.toFixed(1)} missed jobs, with the slot gone and the drive wasted.</span>
        </div>
        <div className="h-px bg-gradient-to-r from-transparent via-white/15 to-transparent" />
        <div className="flex items-start gap-4">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] border border-gold/25 bg-gold/10 text-gold">
            <IconWallet size={21} />
          </span>
          <div className="flex flex-col gap-1">
            <span className="text-[13px] font-medium text-steel">Kept with a 30% deposit</span>
            <span className="font-display text-[34px] font-extrabold leading-none tracking-[-0.04em] text-gold tabular-nums">{money(keptV)}</span>
            <span className="text-[13px] leading-relaxed text-steel">Paid before you drive out. And people who put money down tend to show up.</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function Slider({
  id,
  label,
  value,
  min,
  max,
  step,
  onChange,
  display,
}: {
  id: string;
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (n: number) => void;
  display: string;
}) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between">
        <label htmlFor={id} className="text-[15px] font-medium text-mist">
          {label}
        </label>
        <output htmlFor={id} className="font-display text-[22px] font-bold tabular-nums tracking-[-0.02em] text-paint">
          {display}
        </output>
      </div>
      <input id={id} type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} className="range" />
    </div>
  );
}
