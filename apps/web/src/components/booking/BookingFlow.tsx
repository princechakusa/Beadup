"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useMemo, useState } from "react";
import { z } from "zod";
import { BeadLogo } from "@/components/BeadLogo";
import type { Detailer, VehicleSize } from "@/lib/demo";
import { bookingFeeCents, depositCents, formatUsd } from "@/lib/pricing";
import { BookedCelebration } from "./BookedCelebration";

const STEPS = ["Service", "Vehicle", "Time", "Details", "Review"] as const;

const SIZES: { id: VehicleSize; label: string }[] = [
  { id: "sedan", label: "Sedan" },
  { id: "suv", label: "SUV" },
  { id: "truck", label: "Truck" },
];

const detailsSchema = z.object({
  name: z.string().trim().min(2, "Enter your name").max(80),
  phone: z
    .string()
    .trim()
    .regex(/^\+?1?[\s.-]?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}$/, "Enter a valid US phone number"),
  address: z.string().trim().min(6, "Enter the address where the car will be").max(200),
  smsConsent: z.literal(true, { error: "Needed so we can text your booking updates" }),
});

type Details = { name: string; phone: string; address: string; smsConsent: boolean };

const spring = { type: "spring", stiffness: 420, damping: 34 } as const;

function nextDays(count: number) {
  const out: { key: string; dow: string; day: number; label: string }[] = [];
  const now = new Date();
  for (let i = 1; i <= count; i++) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i);
    out.push({
      key: d.toISOString().slice(0, 10),
      dow: d.toLocaleDateString("en-US", { weekday: "short" }),
      day: d.getDate(),
      label: d.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" }),
    });
  }
  return out;
}

function to12h(hhmm: string) {
  const [h, m] = hhmm.split(":").map(Number);
  const suffix = h >= 12 ? "PM" : "AM";
  return `${((h + 11) % 12) + 1}:${m.toString().padStart(2, "0")} ${suffix}`;
}

export function BookingFlow({ detailer }: { detailer: Detailer }) {
  const reduce = useReducedMotion();
  const [step, setStep] = useState(0);
  const [dir, setDir] = useState(1);
  const [serviceId, setServiceId] = useState(detailer.services[1]?.id ?? detailer.services[0].id);
  const [size, setSize] = useState<VehicleSize>("suv");
  const [addOns, setAddOns] = useState<string[]>([]);
  // Recomputed in the visitor's browser (memo values are not serialized from the server).
  // Dates only render from step 3 on, which never appears in server HTML.
  const days = useMemo(() => nextDays(7), []);
  const [pickedDay, setDayKey] = useState<string | null>(null);
  const dayKey = pickedDay ?? days[0].key;
  const [slot, setSlot] = useState<string | null>(null);
  const [details, setDetails] = useState<Details>({ name: "", phone: "", address: "", smsConsent: false });
  const [errors, setErrors] = useState<Partial<Record<keyof Details, string>>>({});
  const [booked, setBooked] = useState(false);
  const [paying, setPaying] = useState(false);

  const service = detailer.services.find((s) => s.id === serviceId)!;
  const totals = useMemo(() => {
    const base = service.priceCents[size];
    const extras = detailer.addOns.filter((a) => addOns.includes(a.id)).reduce((n, a) => n + a.priceCents, 0);
    const total = base + extras;
    const deposit = depositCents(total);
    const fee = bookingFeeCents(deposit);
    return { base, extras, total, deposit, fee, dueToday: deposit + fee };
  }, [service, size, addOns, detailer.addOns]);

  const canContinue =
    (step === 0 && !!serviceId) || step === 1 || (step === 2 && !!dayKey && !!slot) || step === 3 || step === 4;

  function go(to: number) {
    setDir(to > step ? 1 : -1);
    setStep(to);
  }

  function next() {
    if (step === 3) {
      const parsed = detailsSchema.safeParse(details);
      if (!parsed.success) {
        const e: Partial<Record<keyof Details, string>> = {};
        for (const issue of parsed.error.issues) e[issue.path[0] as keyof Details] ??= issue.message;
        setErrors(e);
        return;
      }
      setErrors({});
    }
    if (step === 4) {
      // Payment is wired to the processor in the next milestone.
      setPaying(true);
      setTimeout(() => {
        setPaying(false);
        setBooked(true);
      }, 1100);
      return;
    }
    go(step + 1);
  }

  const day = days.find((d) => d.key === dayKey);

  if (booked) {
    return (
      <BookedCelebration
        businessName={detailer.businessName}
        when={`${day?.label ?? ""} · ${slot ? to12h(slot) : ""}`}
        paid={formatUsd(totals.dueToday)}
        serviceName={service.name}
      />
    );
  }

  const variants = {
    enter: (d: number) => (reduce ? { opacity: 0 } : { x: d * 48, opacity: 0, filter: "blur(6px)" }),
    center: { x: 0, opacity: 1, filter: "blur(0px)" },
    exit: (d: number) => (reduce ? { opacity: 0 } : { x: d * -48, opacity: 0, filter: "blur(6px)" }),
  };

  return (
    <div className="relative mx-auto flex min-h-dvh w-full max-w-md flex-col px-4 pb-40 pt-6">
      {/* Header */}
      <header className="flex items-center gap-3.5">
        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-[18px] bg-paint font-display text-xl font-extrabold text-midnight">
          {detailer.initials}
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="truncate font-display text-[19px] font-bold">{detailer.businessName}</h1>
          <p className="truncate text-[13px] text-steel">{detailer.tagline}</p>
        </div>
        <div className="flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.06] px-2.5 py-1.5 text-[13px] font-semibold">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#FFB547" strokeWidth="2.4" strokeLinejoin="round" aria-hidden="true">
            <path d="M12 3.5l2.5 5.2 5.7.7-4.2 3.9 1.1 5.6L12 16.1l-5.1 2.8 1.1-5.6-4.2-3.9 5.7-.7z" />
          </svg>
          {detailer.rating}
          <span className="font-medium text-steel">({detailer.reviewCount})</span>
        </div>
      </header>

      {/* Progress */}
      <nav aria-label="Booking steps" className="mt-6 flex gap-1.5">
        {STEPS.map((label, i) => (
          <button
            key={label}
            type="button"
            onClick={() => i < step && go(i)}
            disabled={i >= step}
            aria-current={i === step ? "step" : undefined}
            aria-label={`Step ${i + 1}: ${label}`}
            className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-white/[0.08] enabled:cursor-pointer"
          >
            <motion.span
              className="absolute inset-y-0 left-0 rounded-full bg-bead shadow-[0_0_12px_rgba(77,216,255,0.7)]"
              initial={false}
              animate={{ width: i <= step ? "100%" : "0%" }}
              transition={spring}
            />
          </button>
        ))}
      </nav>

      <div className="relative mt-6 flex-1">
        <AnimatePresence mode="popLayout" custom={dir} initial={false}>
          <motion.section
            key={step}
            custom={dir}
            variants={variants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={spring}
            aria-live="polite"
          >
            {step === 0 && (
              <>
                <StepTitle eyebrow={`Step 1 of ${STEPS.length}`} title="Pick your detail" />
                <div className="mt-5 flex flex-col gap-2.5" role="radiogroup" aria-label="Service">
                  {detailer.services.map((s) => {
                    const active = s.id === serviceId;
                    return (
                      <motion.button
                        key={s.id}
                        type="button"
                        role="radio"
                        aria-checked={active}
                        onClick={() => setServiceId(s.id)}
                        whileTap={{ scale: 0.98 }}
                        className="relative flex items-center gap-3.5 rounded-[22px] border border-line bg-gunmetal p-4 text-left"
                      >
                        {active && (
                          <motion.span
                            layoutId="service-glow"
                            transition={spring}
                            className="absolute inset-0 rounded-[22px] border-2 border-bead bg-[#10262e] shadow-[0_0_0_4px_rgba(77,216,255,0.08),0_12px_40px_rgba(77,216,255,0.15)]"
                          />
                        )}
                        <span className="relative flex-1">
                          <span className="block text-base font-semibold">{s.name}</span>
                          <span className="mt-0.5 block text-[13px] text-steel">
                            {s.description} · {s.durationMin >= 60 ? `${s.durationMin / 60} hr` : `${s.durationMin} min`}
                          </span>
                        </span>
                        <span className={`relative text-[17px] font-bold ${active ? "text-bead" : ""}`}>
                          from {formatUsd(s.priceCents.sedan)}
                        </span>
                      </motion.button>
                    );
                  })}
                </div>
              </>
            )}

            {step === 1 && (
              <>
                <StepTitle eyebrow={`Step 2 of ${STEPS.length}`} title="Your vehicle" />
                <div className="mt-5 grid grid-cols-3 gap-1 rounded-[20px] border border-line bg-panel p-1" role="radiogroup" aria-label="Vehicle size">
                  {SIZES.map((s) => {
                    const active = s.id === size;
                    return (
                      <button
                        key={s.id}
                        type="button"
                        role="radio"
                        aria-checked={active}
                        onClick={() => setSize(s.id)}
                        className={`relative h-12 rounded-2xl text-[15px] font-semibold transition-colors ${active ? "text-bead-ink" : "text-steel"}`}
                      >
                        {active && <motion.span layoutId="size-pill" transition={spring} className="absolute inset-0 rounded-2xl bg-bead" />}
                        <span className="relative">{s.label}</span>
                      </button>
                    );
                  })}
                </div>

                <h3 className="mt-7 text-[13px] font-medium uppercase tracking-[0.12em] text-steel">Add-ons</h3>
                <div className="mt-3 flex flex-col gap-2.5">
                  {detailer.addOns.map((a) => {
                    const on = addOns.includes(a.id);
                    return (
                      <motion.button
                        key={a.id}
                        type="button"
                        role="checkbox"
                        aria-checked={on}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => setAddOns((xs) => (on ? xs.filter((x) => x !== a.id) : [...xs, a.id]))}
                        className={`flex items-center gap-3.5 rounded-[20px] border p-4 text-left transition-colors ${on ? "border-bead/60 bg-[#0f1a20]" : "border-line bg-gunmetal"}`}
                      >
                        <motion.span
                          animate={{ scale: on ? 1 : 0.85, backgroundColor: on ? "#4DD8FF" : "rgba(255,255,255,0)" }}
                          transition={{ type: "spring", stiffness: 600, damping: 20 }}
                          className="flex h-6 w-6 items-center justify-center rounded-lg border border-bead/60"
                        >
                          {on && (
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#04121A" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                              <path d="M5 12.5l4.5 4.5L19 7.5" />
                            </svg>
                          )}
                        </motion.span>
                        <span className="flex-1 font-semibold">{a.name}</span>
                        <span className="font-semibold text-steel">+{formatUsd(a.priceCents)}</span>
                      </motion.button>
                    );
                  })}
                </div>
              </>
            )}

            {step === 2 && (
              <>
                <StepTitle eyebrow={`Step 3 of ${STEPS.length}`} title="Pick a time" />
                <div className="-mx-4 mt-5 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none]" role="radiogroup" aria-label="Day">
                  {days.map((d) => {
                    const active = d.key === dayKey;
                    return (
                      <button
                        key={d.key}
                        type="button"
                        role="radio"
                        aria-checked={active}
                        aria-label={d.label}
                        onClick={() => setDayKey(d.key)}
                        className={`relative flex h-[72px] w-[60px] shrink-0 flex-col items-center justify-center rounded-[20px] border ${active ? "border-transparent text-bead-ink" : "border-line bg-gunmetal"}`}
                      >
                        {active && <motion.span layoutId="day-pill" transition={spring} className="absolute inset-0 rounded-[20px] bg-bead" />}
                        <span className={`relative text-xs font-medium ${active ? "" : "text-steel"}`}>{d.dow}</span>
                        <span className="relative font-display text-xl font-bold">{d.day}</span>
                      </button>
                    );
                  })}
                </div>
                <div className="mt-4 grid grid-cols-3 gap-2" role="radiogroup" aria-label="Time">
                  {detailer.slots.map((s) => {
                    const active = s === slot;
                    return (
                      <motion.button
                        key={s}
                        type="button"
                        role="radio"
                        aria-checked={active}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => setSlot(s)}
                        className={`h-12 rounded-2xl border text-sm font-semibold transition-colors ${active ? "border-bead bg-bead text-bead-ink shadow-[0_8px_24px_rgba(77,216,255,0.3)]" : "border-line bg-gunmetal"}`}
                      >
                        {to12h(s)}
                      </motion.button>
                    );
                  })}
                </div>
                <p className="mt-4 text-[13px] text-steel">Service area: {detailer.serviceArea}</p>
              </>
            )}

            {step === 3 && (
              <>
                <StepTitle eyebrow={`Step 4 of ${STEPS.length}`} title="Where's the car?" />
                <form className="mt-5 flex flex-col gap-3" onSubmit={(e) => (e.preventDefault(), next())} noValidate>
                  <Field label="Your name" error={errors.name}>
                    <input autoComplete="name" value={details.name} maxLength={80} onChange={(e) => setDetails({ ...details, name: e.target.value })} />
                  </Field>
                  <Field label="Mobile number" error={errors.phone}>
                    <input type="tel" inputMode="tel" autoComplete="tel" value={details.phone} maxLength={20} onChange={(e) => setDetails({ ...details, phone: e.target.value })} />
                  </Field>
                  <Field label="Service address" error={errors.address}>
                    <input autoComplete="street-address" value={details.address} maxLength={200} onChange={(e) => setDetails({ ...details, address: e.target.value })} />
                  </Field>
                  <label className="mt-1 flex cursor-pointer items-start gap-3 text-[13px] leading-relaxed text-steel">
                    <input
                      type="checkbox"
                      checked={details.smsConsent}
                      onChange={(e) => setDetails({ ...details, smsConsent: e.target.checked })}
                      className="mt-0.5 h-5 w-5 shrink-0 accent-[#4DD8FF]"
                    />
                    <span>
                      Text me booking confirmations and reminders from {detailer.businessName}. Msg &amp; data rates may apply. Reply STOP to opt out.
                      {errors.smsConsent && <span className="mt-1 block text-[#ff8a8a]">{errors.smsConsent}</span>}
                    </span>
                  </label>
                  <button type="submit" className="sr-only">Continue</button>
                </form>
              </>
            )}

            {step === 4 && (
              <>
                <StepTitle eyebrow={`Step 5 of ${STEPS.length}`} title="Review and book" />
                <div className="mt-5 rounded-[24px] border border-white/[0.08] bg-panel p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
                  <p className="font-display text-lg font-bold">{service.name}</p>
                  <p className="mt-1 text-sm text-steel">
                    {SIZES.find((s) => s.id === size)?.label} · {day?.label} · {slot && to12h(slot)}
                  </p>
                  <div className="my-4 h-px bg-white/[0.06]" />
                  <Row label={service.name} value={formatUsd(totals.base)} />
                  {detailer.addOns
                    .filter((a) => addOns.includes(a.id))
                    .map((a) => (
                      <Row key={a.id} label={a.name} value={formatUsd(a.priceCents)} />
                    ))}
                  <Row label="Total" value={formatUsd(totals.total)} strong />
                  <div className="my-4 h-px bg-white/[0.06]" />
                  <Row label="Deposit (30%)" value={formatUsd(totals.deposit)} />
                  <Row label="Booking fee" value={formatUsd(totals.fee)} muted />
                  <Row label={`Pay ${formatUsd(totals.total - totals.deposit)} after the job`} value="" muted />
                </div>
                <p className="mt-4 flex items-center gap-2 text-[13px] text-steel">
                  <svg width="14" height="16" viewBox="0 0 16 18" aria-hidden="true">
                    <rect x="2" y="8" width="12" height="9" rx="2" fill="currentColor" />
                    <path d="M5 8V5a3 3 0 0 1 6 0v3" fill="none" stroke="currentColor" strokeWidth="2" />
                  </svg>
                  Encrypted checkout. Your card is never stored by Beadup.
                </p>
              </>
            )}
          </motion.section>
        </AnimatePresence>
      </div>

      {/* Sticky action bar */}
      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-10 bg-gradient-to-t from-midnight from-60% to-transparent pt-10">
        <div className="pointer-events-auto mx-auto max-w-md px-4 pb-[max(16px,env(safe-area-inset-bottom))]">
          <div className="flex items-center gap-3 rounded-[26px] border border-white/10 bg-[rgba(28,33,42,0.72)] p-3 pl-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_18px_40px_rgba(0,0,0,0.55)] backdrop-blur-xl">
            {step > 0 && (
              <button type="button" onClick={() => go(step - 1)} aria-label="Back" className="-ml-2 flex h-11 w-11 items-center justify-center rounded-full text-steel hover:text-paint">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                  <path d="M15 18l-6-6 6-6" />
                </svg>
              </button>
            )}
            <div className="min-w-0 flex-1">
              <p className="text-xs text-steel">{step === 4 ? "Due today" : "Estimated total"}</p>
              <AnimatedPrice cents={step === 4 ? totals.dueToday : totals.total} />
            </div>
            <motion.button
              type="button"
              onClick={next}
              disabled={!canContinue || paying}
              whileTap={{ scale: 0.95 }}
              transition={{ type: "spring", stiffness: 700, damping: 25 }}
              className="flex h-[52px] items-center gap-2 rounded-[18px] bg-bead px-6 font-bold text-bead-ink shadow-[0_10px_30px_rgba(77,216,255,0.35)] disabled:opacity-40 disabled:shadow-none"
            >
              {paying ? (
                <motion.span animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 0.8, ease: "linear" }} className="block h-5 w-5 rounded-full border-2 border-bead-ink border-t-transparent" aria-label="Processing" />
              ) : step === 4 ? (
                "Book & pay"
              ) : (
                "Continue"
              )}
            </motion.button>
          </div>
          <p className="mt-2.5 flex items-center justify-center gap-1.5 text-[11px] text-steel">
            <BeadLogo size={12} animate={false} /> Powered by beadup
          </p>
        </div>
      </div>
    </div>
  );
}

function StepTitle({ eyebrow, title }: { eyebrow: string; title: string }) {
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-[0.14em] text-bead">{eyebrow}</p>
      <h2 className="mt-1.5 font-display text-[32px] font-extrabold leading-[1.1] tracking-[-0.03em]">{title}</h2>
    </div>
  );
}

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactElement }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[13px] font-medium text-steel">{label}</span>
      <span
        className={`block rounded-2xl border bg-gunmetal transition-colors focus-within:border-bead [&>input]:h-[52px] [&>input]:w-full [&>input]:bg-transparent [&>input]:px-4 [&>input]:text-base [&>input]:outline-none ${error ? "border-[#ff8a8a]" : "border-line"}`}
      >
        {children}
      </span>
      {error && <span className="mt-1.5 block text-[13px] text-[#ff8a8a]">{error}</span>}
    </label>
  );
}

function Row({ label, value, strong, muted }: { label: string; value: string; strong?: boolean; muted?: boolean }) {
  return (
    <div className={`flex justify-between py-1 text-[15px] ${muted ? "text-steel" : ""} ${strong ? "font-semibold" : ""}`}>
      <span>{label}</span>
      <span className={strong ? "font-display text-lg font-bold text-gold" : "font-semibold"}>{value}</span>
    </div>
  );
}

function AnimatedPrice({ cents }: { cents: number }) {
  return (
    <AnimatePresence mode="popLayout" initial={false}>
      <motion.p
        key={cents}
        initial={{ y: 14, opacity: 0, filter: "blur(4px)" }}
        animate={{ y: 0, opacity: 1, filter: "blur(0px)" }}
        exit={{ y: -14, opacity: 0, filter: "blur(4px)" }}
        transition={{ type: "spring", stiffness: 500, damping: 32 }}
        className="font-display text-2xl font-extrabold tracking-tight"
      >
        {formatUsd(cents)}
      </motion.p>
    </AnimatePresence>
  );
}
