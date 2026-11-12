"use client";

import { AnimatePresence, motion, MotionConfig, useReducedMotion } from "motion/react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { z } from "zod";
import { BeadLogo } from "@/components/BeadLogo";
import type { Detailer, VehicleSize } from "@/lib/booking-types";
import { haptic, primeAudio } from "@/lib/feedback";
import { createBooking, type BookingResult } from "@/app/[handle]/actions";
import { smsConsentText } from "@/lib/consent";
import { COUNTRIES, formatMoney, formatPhone, toE164, whatsappUrl, type Country } from "@/lib/countries";
import { bookingFeeCents, depositCents } from "@/lib/pricing";
import { openDays } from "@/lib/slots";
import { WhatsAppIcon } from "./WhatsAppIcon";
import { useCspNonce, useHydrated } from "@/lib/use-hydrated";
import { BookedCelebration } from "./BookedCelebration";
import { Turnstile, turnstileEnabled } from "./Turnstile";

// Zod's fast path compiles validators with `new Function`, which the CSP
// forbids (no 'unsafe-eval'). Same validation, without the eval probe.
z.config({ jitless: true });

// Shown when Cloudflare wants a tick (or is still checking) and Book is tapped.
const VERIFY_FIRST = "Just a quick check that you're not a bot. If a “Verify you are human” box appears above, tick it, then tap Book again.";

const BOOK_ERRORS: Record<Exclude<BookingResult, { ok: true }>["error"], string> = {
  invalid: "Something in the booking didn't check out. Please review your details.",
  rate_limited: "Too many attempts. Please wait a few minutes and try again.",
  bot_check: "We couldn't verify this browser. Please refresh and try again.",
  slot_taken: "That time was just booked by someone else. Please pick another time.",
  slot_unavailable: "That time is no longer available. Please pick another time.",
  unavailable: "Booking is temporarily unavailable. Please try again shortly.",
  payments_not_ready: "This detailer isn't taking online payments yet. Please contact them directly to book.",
  plan_limit: "This detailer's online booking is full for this month. Please contact them directly to book.",
  catalog_changed: "This detailer just updated their services or prices. Please choose your detail again.",
};

const STEPS = ["Service", "Vehicle", "Time", "Details", "Review"] as const;

const SIZES: { id: VehicleSize; label: string }[] = [
  { id: "sedan", label: "Sedan" },
  { id: "suv", label: "SUV" },
  { id: "truck", label: "Truck" },
];

// Phone numbers are read the way people write them in the detailer's country.
const detailsSchemaFor = (country: Country) =>
  z.object({
  name: z.string().trim().min(2, "Enter your name").max(80),
  phone: z
    .string()
    .trim()
    .refine((p) => toE164(p, country) !== null, "Enter a valid mobile number"),
  address: z.string().trim().min(6, "Enter the address where the car will be").max(200),
  // Optional: consent to texts is never a condition of booking.
  smsConsent: z.boolean(),
});

type Details = { name: string; phone: string; address: string; smsConsent: boolean };

const spring = { type: "spring", stiffness: 420, damping: 34 } as const;

function initials(name: string) {
  const words = name.replace(/[^\p{L}\p{N}\s]/gu, "").split(/\s+/).filter(Boolean);
  return words.slice(0, 2).map((w) => w[0]!.toUpperCase()).join("") || "B";
}

function to12h(hhmm: string) {
  const [h, m] = hhmm.split(":").map(Number);
  const suffix = h >= 12 ? "PM" : "AM";
  return `${((h + 11) % 12) + 1}:${m.toString().padStart(2, "0")} ${suffix}`;
}

export function BookingFlow({ detailer, smsEnabled }: { detailer: Detailer; smsEnabled: boolean }) {
  const money = (cents: number) => formatMoney(cents, detailer.country);
  const reduce = useReducedMotion();
  const router = useRouter();
  // Animation start states only after hydration: the server HTML must not
  // carry style="" attributes (CSP without 'unsafe-inline').
  const hydrated = useHydrated();
  const nonce = useCspNonce();
  const [step, setStep] = useState(0);
  const [dir, setDir] = useState(1);
  // Nothing is preselected: the client picks a detail before any price shows.
  const [serviceId, setServiceId] = useState<string | null>(null);
  const [size, setSize] = useState<VehicleSize>("suv");
  const [addOns, setAddOns] = useState<string[]>([]);
  // Computed only once the visitor reaches the time step, so the current date
  // is read in their browser and never during the server prerender.
  // Times booked by others during this visit, on top of what the page loaded with.
  const [lostSlots, setLostSlots] = useState<string[]>([]);
  const showDays = step >= 2;
  const durationMin = detailer.services.find((s) => s.id === serviceId)?.durationMin ?? 60;
  const days = useMemo(
    () =>
      showDays
        ? openDays({
            weeklySlots: detailer.weeklySlots,
            busy: detailer.busy,
            bufferMin: detailer.bufferMin,
            durationMin,
            timeZone: detailer.timezone,
            now: new Date(),
            count: 7,
            exclude: new Set([...detailer.taken, ...lostSlots]),
            daysOff: detailer.daysOff,
          })
        : [],
    [showDays, detailer.weeklySlots, detailer.busy, detailer.bufferMin, detailer.timezone, detailer.taken, detailer.daysOff, durationMin, lostSlots],
  );
  const [pickedDay, setDayKey] = useState<string | null>(null);
  // A longer service picked after going back can close the chosen day or time.
  const dayKey = (pickedDay && days.some((d) => d.key === pickedDay) ? pickedDay : null) ?? days[0]?.key ?? null;
  const [pickedSlot, setSlot] = useState<string | null>(null);
  const slot = pickedSlot && days.find((d) => d.key === dayKey)?.slots.includes(pickedSlot) ? pickedSlot : null;
  const [details, setDetails] = useState<Details>({ name: "", phone: "", address: "", smsConsent: false });
  const [errors, setErrors] = useState<Partial<Record<keyof Details, string>>>({});
  const [booked, setBooked] = useState(false);
  const [paying, setPaying] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [bookError, setBookError] = useState<string | null>(null);
  const [paidCents, setPaidCents] = useState<number | null>(null);
  const [bookedRef, setBookedRef] = useState<{ bookingId: string; token: string } | null>(null);

  const service = detailer.services.find((s) => s.id === serviceId);
  // Launch mode: the client pays the deposit to the detailer directly (no card form, no booking fee).
  const external = detailer.payments === "external";
  const shortName = detailer.businessName.replace(/\.+$/, "");
  const totals = useMemo(() => {
    const base = service ? service.priceCents[size] : 0;
    const extras = detailer.addOns.filter((a) => addOns.includes(a.id)).reduce((n, a) => n + a.priceCents, 0);
    const total = base + extras;
    const deposit = depositCents(total);
    const fee = external ? 0 : bookingFeeCents(deposit);
    return { base, extras, total, deposit, fee, dueToday: deposit + fee };
  }, [service, size, addOns, detailer.addOns, external]);

  const canContinue =
    (step === 0 && !!serviceId) || step === 1 || (step === 2 && !!dayKey && !!slot) || step === 3 || step === 4;

  function go(to: number) {
    setDir(to > step ? 1 : -1);
    setStep(to);
  }

  function next() {
    if (step === 3) {
      const parsed = detailsSchemaFor(detailer.country).safeParse(details);
      if (!parsed.success) {
        const e: Partial<Record<keyof Details, string>> = {};
        for (const issue of parsed.error.issues) e[issue.path[0] as keyof Details] ??= issue.message;
        setErrors(e);
        return;
      }
      setErrors({});
    }
    if (step === 4) {
      // Creates the booking server-side (held for 30 min). Card payment is
      // wired to the processor in the next milestone.
      if (turnstileEnabled && !turnstileToken) {
        // Cloudflare sometimes asks for a tick (or is still checking): say so,
        // and bring the box and this message into view above the sticky bar.
        setBookError(VERIFY_FIRST);
        requestAnimationFrame(() => document.getElementById("book-alert")?.scrollIntoView({ block: "center", behavior: "smooth" }));
        return;
      }
      primeAudio(); // inside the click, so the chime is allowed to play later
      setPaying(true);
      setBookError(null);
      createBooking({
        handle: detailer.handle,
        serviceId: serviceId ?? "", // always set by the review step (Continue needs a pick)
        vehicleSize: size,
        addOnIds: addOns,
        date: dayKey ?? "",
        time: slot ?? "",
        name: details.name,
        phone: details.phone,
        address: details.address,
        smsConsent: smsEnabled && details.smsConsent,
        turnstileToken: turnstileToken ?? undefined,
      })
        .then((res) => {
          if (res.ok && res.checkoutUrl) {
            // Pay on Stripe's hosted page; Stripe sends them back to /<handle>/booked.
            window.location.assign(res.checkoutUrl);
            return new Promise<never>(() => {}); // keep the spinner until the page unloads
          }
          if (res.ok) {
            if (res.clientToken) setBookedRef({ bookingId: res.bookingId, token: res.clientToken });
            setPaidCents(res.depositCents + res.bookingFeeCents);
            setBooked(true);
            return;
          }
          setBookError(BOOK_ERRORS[res.error]);
          if (res.error === "catalog_changed") {
            // Load the current services, then start the choice again (the old ids no longer exist).
            router.refresh();
            setServiceId(null);
            setAddOns([]);
            setSlot(null);
            go(0);
            return;
          }
          if (res.error === "slot_taken" || res.error === "slot_unavailable") {
            if (dayKey && slot) setLostSlots((xs) => [...xs, `${dayKey} ${slot}`]);
            setSlot(null);
            go(2);
          }
        })
        .catch(() => setBookError(BOOK_ERRORS.unavailable))
        .finally(() => setPaying(false));
      return;
    }
    haptic("step");
    go(step + 1);
  }

  const day = days.find((d) => d.key === dayKey);

  if (booked) {
    return (
      <BookedCelebration
        businessName={detailer.businessName}
        when={`${day?.label ?? ""} · ${slot ? to12h(slot) : ""}`}
        paid={money(paidCents ?? totals.dueToday)}
        payment={external ? { link: detailer.paymentLink, note: detailer.paymentNote } : undefined}
        depositSent={external && bookedRef ? bookedRef : undefined}
        contact={detailer.contactPhone ? { e164: detailer.contactPhone, display: formatPhone(detailer.contactPhone, detailer.country) } : undefined}
        serviceName={service?.name ?? ""}
        celebrate
        smsEnabled={smsEnabled}
        calendar={
          dayKey && slot
            ? {
                uid: `${detailer.handle}-${dayKey}-${slot}`,
                title: `${service?.name ?? "Detail"} with ${detailer.businessName}`,
                date: dayKey,
                time: slot,
                timezone: detailer.timezone,
                durationMin: service?.durationMin ?? 60,
                location: details.address,
                description: `Booked with ${detailer.businessName} on Beadup.`,
              }
            : undefined
        }
      />
    );
  }

  const variants = {
    enter: (d: number) => (reduce ? { opacity: 0 } : { x: d * 48, opacity: 0, filter: "blur(6px)" }),
    center: { x: 0, opacity: 1, filter: "blur(0px)" },
    exit: (d: number) => (reduce ? { opacity: 0 } : { x: d * -48, opacity: 0, filter: "blur(6px)" }),
  };

  return (
    <MotionConfig nonce={nonce}>
    <main id="main" className="relative mx-auto flex min-h-dvh w-full max-w-md flex-col px-4 pb-40 pt-6">
      <div aria-hidden="true" className="pointer-events-none fixed inset-x-0 top-0 -z-10 h-[520px] bg-[radial-gradient(ellipse_80%_60%_at_50%_-10%,rgba(77,216,255,0.16),transparent)]" />
      {/* Header */}
      <header className="flex items-center gap-3.5">
        {detailer.photo ? (
          // The detailer's own photo, so a new client knows who is coming. Served by this site (CSP: img-src 'self').
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={`/api/media/${detailer.handle}/avatar?v=${detailer.photo}`}
            alt={`${detailer.businessName}, the detailer`}
            width={56}
            height={56}
            className="h-14 w-14 shrink-0 rounded-[18px] object-cover shadow-[0_10px_30px_-8px_rgba(77,216,255,0.45)] ring-1 ring-white/15"
          />
        ) : (
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-[18px] bg-gradient-to-b from-white to-[#cfd8e4] font-display text-xl font-extrabold text-midnight shadow-[0_10px_30px_-8px_rgba(77,216,255,0.45),inset_0_-2px_0_rgba(0,0,0,0.12)]">
            {initials(detailer.businessName)}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <h1 className="truncate font-display text-[19px] font-bold">{detailer.businessName}</h1>
          <p className="truncate text-[13px] text-steel">{detailer.tagline}</p>
        </div>
        <div className="glass flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-[13px] font-semibold">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#FFB547" strokeWidth="2.4" strokeLinejoin="round" aria-hidden="true">
            <path d="M12 3.5l2.5 5.2 5.7.7-4.2 3.9 1.1 5.6L12 16.1l-5.1 2.8 1.1-5.6-4.2-3.9 5.7-.7z" />
          </svg>
          {detailer.rating === null ? (
            <span className="font-medium text-steel">New</span>
          ) : (
            <>
              {detailer.rating.toFixed(1)}
              <span className="font-medium text-steel">({detailer.reviewCount})</span>
            </>
          )}
        </div>
      </header>

      {/* Progress */}
      {detailer.contactPhone && (
        <div className="mt-4 flex items-center gap-2 text-[13px]">
          <span className="text-steel">Questions first?</span>
          <a
            href={whatsappUrl(detailer.contactPhone, `Hi ${shortName}, I found you on Beadup and have a question about a detail.`)}
            target="_blank"
            rel="noopener noreferrer"
            className="flex h-9 items-center gap-1.5 rounded-full border border-[#25D366]/40 bg-[#25D366]/10 px-3 font-semibold text-[#7ff0a8]"
          >
            <WhatsAppIcon />
            WhatsApp
          </a>
          <a href={`tel:${detailer.contactPhone}`} className="flex h-9 items-center rounded-full border border-white/15 px-3 font-semibold">
            Call
          </a>
        </div>
      )}

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
            <span
              className={`absolute inset-0 origin-left rounded-full bg-gradient-to-r from-[#7fe4ff] to-bead shadow-[0_0_12px_rgba(77,216,255,0.7)] transition-transform duration-500 ease-(--ease-spring) ${i <= step ? "scale-x-100" : "scale-x-0"}`}
            />
          </button>
        ))}
      </nav>

      <div className="relative mt-6 flex-1">
        <AnimatePresence mode="popLayout" custom={dir}>
          <motion.section
            key={step}
            custom={dir}
            variants={variants}
            initial={hydrated ? "enter" : undefined}
            animate="center"
            exit="exit"
            transition={spring}
            aria-live="polite"
          >
            {step === 0 && (
              <>
                <StepTitle eyebrow={`Step 1 of ${STEPS.length}`} title="Pick your detail" />
                {bookError && (
                  <p role="alert" className="mt-4 rounded-2xl border border-[#ff8a8a]/30 bg-[#ff8a8a]/10 p-3.5 text-sm text-[#ffb3b3]">
                    {bookError}
                  </p>
                )}
                <div className="mt-5 flex flex-col gap-2.5" role="radiogroup" aria-label="Service">
                  {detailer.services.map((s) => {
                    const active = s.id === serviceId;
                    return (
                      <motion.button
                        key={s.id}
                        type="button"
                        role="radio"
                        aria-checked={active}
                        onClick={() => { haptic(); setServiceId(s.id); setBookError(null); }}
                        whileTap={{ scale: 0.98 }}
                        className="relative flex items-center gap-3.5 rounded-[22px] border border-white/[0.07] bg-gradient-to-b from-[#1a1f27] to-gunmetal p-4 text-left shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]"
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
                          from {money(s.priceCents.sedan)}
                        </span>
                      </motion.button>
                    );
                  })}
                </div>
                {detailer.portfolio.length > 0 && <OurWork handle={detailer.handle} items={detailer.portfolio} businessName={shortName} />}
              </>
            )}

            {step === 1 && (
              <>
                <StepTitle eyebrow={`Step 2 of ${STEPS.length}`} title="Your vehicle" />
                <div className="glass mt-5 grid grid-cols-3 gap-1 rounded-[20px] p-1" role="radiogroup" aria-label="Vehicle size">
                  {SIZES.map((s) => {
                    const active = s.id === size;
                    return (
                      <button
                        key={s.id}
                        type="button"
                        role="radio"
                        aria-checked={active}
                        onClick={() => { haptic(); setSize(s.id); }}
                        className={`relative h-12 rounded-2xl text-[15px] font-semibold transition-colors ${active ? "text-bead-ink" : "text-steel"}`}
                      >
                        {active && <motion.span layoutId="size-pill" transition={spring} className="absolute inset-0 rounded-2xl bg-bead shadow-[0_8px_24px_-6px_rgba(77,216,255,0.6)]" />}
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
                        onClick={() => { haptic(); setAddOns((xs) => (on ? xs.filter((x) => x !== a.id) : [...xs, a.id])); }}
                        className={`flex items-center gap-3.5 rounded-[20px] border p-4 text-left transition-colors ${on ? "border-bead/60 bg-[#0f1a20]" : "border-line bg-gunmetal"}`}
                      >
                        <motion.span
                          animate={{ scale: on ? 1 : 0.85, backgroundColor: on ? "#4DD8FF" : "rgba(255,255,255,0)" }}
                          transition={{ type: "spring", stiffness: 600, damping: 20 }}
                          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border border-bead/60"
                        >
                          {on && (
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#04121A" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                              <path d="M5 12.5l4.5 4.5L19 7.5" />
                            </svg>
                          )}
                        </motion.span>
                        <span className="min-w-0 flex-1 font-semibold leading-snug">{a.name}</span>
                        <span className="shrink-0 font-semibold text-steel">+{money(a.priceCents)}</span>
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
                        onClick={() => {
                          haptic();
                          setDayKey(d.key);
                          if (slot && !d.slots.includes(slot)) setSlot(null);
                        }}
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
                  {days.length === 0 && (
                    <p className="col-span-3 rounded-2xl border border-line bg-gunmetal p-4 text-sm text-steel">
                      No open times in the next few weeks. Check back soon.
                    </p>
                  )}
                  {(day?.slots ?? []).map((s) => {
                    const active = s === slot;
                    return (
                      <motion.button
                        key={s}
                        type="button"
                        role="radio"
                        aria-checked={active}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => { haptic(); setSlot(s); setBookError(null); }}
                        className={`h-12 rounded-2xl border text-sm font-semibold transition-colors ${active ? "border-bead bg-bead text-bead-ink shadow-[0_8px_24px_rgba(77,216,255,0.3)]" : "border-line bg-gunmetal"}`}
                      >
                        {to12h(s)}
                      </motion.button>
                    );
                  })}
                </div>
                <p className="mt-4 text-[13px] text-steel">Service area: {detailer.serviceArea}</p>
                {bookError && (
                  <p role="alert" className="mt-4 rounded-2xl border border-[#ff8a8a]/30 bg-[#ff8a8a]/10 p-3.5 text-sm text-[#ffb3b3]">
                    {bookError}
                  </p>
                )}
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
                    <input type="tel" inputMode="tel" autoComplete="tel" placeholder={COUNTRIES[detailer.country].phoneExample} value={details.phone} maxLength={20} onChange={(e) => setDetails({ ...details, phone: e.target.value })} />
                  </Field>
                  <Field label="Service address" error={errors.address}>
                    <input autoComplete="street-address" value={details.address} maxLength={200} onChange={(e) => setDetails({ ...details, address: e.target.value })} />
                  </Field>
                  {smsEnabled && (
                  <label className="mt-1 flex cursor-pointer items-start gap-3 text-[13px] leading-relaxed text-steel">
                    <input
                      type="checkbox"
                      checked={details.smsConsent}
                      onChange={(e) => setDetails({ ...details, smsConsent: e.target.checked })}
                      className="mt-0.5 h-5 w-5 shrink-0 accent-[#4DD8FF]"
                    />
                    <span>
                      {smsConsentText(detailer.businessName)}
                    </span>
                  </label>
                  )}
                  <button type="submit" className="sr-only">Continue</button>
                </form>
              </>
            )}

            {step === 4 && (
              <>
                <StepTitle eyebrow={`Step 5 of ${STEPS.length}`} title="Review and book" />
                <div className="glass glass-edge mt-5 rounded-[24px] p-5">
                  <p className="font-display text-lg font-bold">{service?.name}</p>
                  <p className="mt-1 text-sm text-steel">
                    {SIZES.find((s) => s.id === size)?.label} · {day?.label} · {slot && to12h(slot)}
                  </p>
                  <div className="my-4 h-px bg-white/[0.06]" />
                  <Row label={service?.name ?? ""} value={money(totals.base)} />
                  {detailer.addOns
                    .filter((a) => addOns.includes(a.id))
                    .map((a) => (
                      <Row key={a.id} label={a.name} value={money(a.priceCents)} />
                    ))}
                  <Row label="Total" value={money(totals.total)} strong />
                  <div className="my-4 h-px bg-white/[0.06]" />
                  <Row label="Deposit (30%)" value={money(totals.deposit)} />
                  {!external && <Row label="Booking fee" value={money(totals.fee)} muted />}
                  <Row label={`Pay ${money(totals.total - totals.deposit)} after the job`} value="" muted />
                </div>
                {external ? (
                  <p className="mt-4 text-[13px] leading-relaxed text-steel">
                    After you book, you&apos;ll pay the {money(totals.deposit)} deposit to {shortName} directly. Beadup
                    never takes your card. Deposits, changes and refunds are handled by {shortName}.
                  </p>
                ) : (
                  <>
                    <p className="mt-4 flex items-center gap-2 text-[13px] text-steel">
                      <svg width="14" height="16" viewBox="0 0 16 18" aria-hidden="true">
                        <rect x="2" y="8" width="12" height="9" rx="2" fill="currentColor" />
                        <path d="M5 8V5a3 3 0 0 1 6 0v3" fill="none" stroke="currentColor" strokeWidth="2" />
                      </svg>
                      Encrypted checkout. Your card is never stored by Beadup.
                    </p>
                    <p className="mt-2 text-[13px] leading-relaxed text-steel">
                      Cancel 24 hours or more before your appointment and your deposit is refunded. The booking fee covers card
                      processing and isn&apos;t refundable. If {shortName} cancels, you get everything back.
                    </p>
                  </>
                )}
                <Turnstile
                  onToken={(t) => {
                    setTurnstileToken(t);
                    if (t) setBookError((e) => (e === VERIFY_FIRST ? null : e)); // ticked: clear the hint
                  }}
                />
                {bookError && (
                  <p id="book-alert" role="alert" className="mt-4 scroll-mb-40 rounded-2xl border border-[#ff8a8a]/30 bg-[#ff8a8a]/10 p-3.5 text-sm text-[#ffb3b3]">
                    {bookError}
                  </p>
                )}
              </>
            )}
          </motion.section>
        </AnimatePresence>
      </div>

      {/* Sticky action bar */}
      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-10 bg-gradient-to-t from-midnight from-60% to-transparent pt-10">
        <div className="pointer-events-auto mx-auto max-w-md px-4 pb-[max(16px,env(safe-area-inset-bottom))]">
          <div className="glass flex items-center gap-3 rounded-[26px] p-3 pl-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_18px_40px_rgba(0,0,0,0.55)]">
            {step > 0 && (
              <button type="button" onClick={() => go(step - 1)} aria-label="Back" className="-ml-2 flex h-11 w-11 items-center justify-center rounded-full text-steel hover:text-paint">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                  <path d="M15 18l-6-6 6-6" />
                </svg>
              </button>
            )}
            <div className="min-w-0 flex-1">
              {service ? (
                <>
                  <p className="text-xs text-steel">{step === 4 ? (external ? "Deposit, paid to the detailer" : "Due today") : "Estimated total"}</p>
                  <AnimatedPrice cents={step === 4 ? totals.dueToday : totals.total} animate={hydrated} country={detailer.country} />
                </>
              ) : (
                <p className="text-sm text-steel">Pick a detail to see the price</p>
              )}
            </div>
            <motion.button
              type="button"
              onClick={next}
              disabled={!canContinue || paying}
              whileTap={{ scale: 0.95 }}
              transition={{ type: "spring", stiffness: 700, damping: 25 }}
              className="btn-sheen flex h-[52px] items-center gap-2 rounded-[18px] bg-bead px-6 font-bold text-bead-ink shadow-[0_10px_30px_rgba(77,216,255,0.35)] disabled:opacity-40 disabled:shadow-none"
            >
              {paying ? (
                <motion.span animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 0.8, ease: "linear" }} className="block h-5 w-5 rounded-full border-2 border-bead-ink border-t-transparent" aria-label="Processing" />
              ) : step === 4 ? (
                external ? "Book" : "Book & pay"
              ) : (
                "Continue"
              )}
            </motion.button>
          </div>
          {/* Every booking page quietly introduces Beadup to other detailers. */}
          <a
            href={`/?utm_source=booking_page&utm_medium=referral&utm_campaign=${encodeURIComponent(detailer.handle)}`}
            className="mx-auto mt-2.5 flex w-fit items-center justify-center gap-1.5 rounded-full px-2 py-1 text-[11px] text-steel transition-colors hover:text-mist"
          >
            <BeadLogo size={12} animate={false} /> Powered by beadup
          </a>
        </div>
      </div>
    </main>
    </MotionConfig>
  );
}

function StepTitle({ eyebrow, title }: { eyebrow: string; title: string }) {
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-[0.14em] text-bead">{eyebrow}</p>
      <h2 className="text-gradient mt-1.5 font-display text-[32px] font-extrabold leading-[1.1] tracking-[-0.035em]">{title}</h2>
    </div>
  );
}

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactElement }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[13px] font-medium text-steel">{label}</span>
      <span
        className={`block rounded-2xl border bg-gunmetal transition-[border-color,box-shadow] focus-within:border-bead focus-within:shadow-[0_0_0_4px_rgba(77,216,255,0.12)] [&>input]:h-[52px] [&>input]:w-full [&>input]:bg-transparent [&>input]:px-4 [&>input]:text-base [&>input]:outline-none ${error ? "border-[#ff8a8a]" : "border-line"}`}
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

function AnimatedPrice({ cents, animate, country }: { cents: number; animate: boolean; country: Country }) {
  return (
    <AnimatePresence mode="popLayout">
      <motion.p
        key={cents}
        initial={animate ? { y: 14, opacity: 0, filter: "blur(4px)" } : undefined}
        animate={{ y: 0, opacity: 1, filter: "blur(0px)" }}
        exit={{ y: -14, opacity: 0, filter: "blur(4px)" }}
        transition={{ type: "spring", stiffness: 500, damping: 32 }}
        className="font-display text-2xl font-extrabold tracking-tight text-gold"
      >
        {formatMoney(cents, country)}
      </motion.p>
    </AnimatePresence>
  );
}

/** Photos of the detailer's work: a swipeable strip under the services. */
function OurWork({ handle, items, businessName }: { handle: string; items: Detailer["portfolio"]; businessName: string }) {
  return (
    <section aria-label={`Work by ${businessName}`} className="mt-7">
      <h3 className="font-display text-[17px] font-bold">Recent work</h3>
      <ul className="-mx-4 mt-3 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-2">
        {items.map((p) => (
          <li key={p.id} className="w-[72%] max-w-[280px] shrink-0 snap-start">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`/api/media/${handle}/${p.id}`}
              alt={p.caption || `Work by ${businessName}`}
              loading="lazy"
              width={280}
              height={210}
              className="aspect-[4/3] w-full rounded-[18px] object-cover ring-1 ring-white/10"
            />
            {p.caption && <p className="mt-1.5 truncate text-[13px] text-steel">{p.caption}</p>}
          </li>
        ))}
      </ul>
    </section>
  );
}
