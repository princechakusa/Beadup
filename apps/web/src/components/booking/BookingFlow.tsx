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
import { COUNTRIES, formatClock, formatMoney, formatPhone, toE164, whatsappUrl, type Country } from "@/lib/countries";
import { bookingFeeCents, depositCents } from "@/lib/pricing";
import { openDays } from "@/lib/slots";
import { tierLabel, tradeOf } from "@/lib/trades";
import { WhatsAppIcon } from "./WhatsAppIcon";
import { useCspNonce, useHydrated } from "@/lib/use-hydrated";
import { useI18n } from "@/lib/i18n/I18nProvider";
import type { Messages } from "@/lib/i18n";
import { BookedCelebration } from "./BookedCelebration";
import { Turnstile, turnstileEnabled } from "./Turnstile";

// Zod's fast path compiles validators with `new Function`, which the CSP
// forbids (no 'unsafe-eval'). Same validation, without the eval probe.
z.config({ jitless: true });

const BOOK_ERROR_KEYS = {
  invalid: "err_invalid",
  rate_limited: "err_rate_limited",
  bot_check: "err_bot_check",
  slot_taken: "err_slot_taken",
  slot_unavailable: "err_slot_unavailable",
  unavailable: "err_unavailable",
  payments_not_ready: "err_payments_not_ready",
  plan_limit: "err_plan_limit",
  catalog_changed: "err_catalog_changed",
} as const satisfies Record<Exclude<BookingResult, { ok: true }>["error"], keyof Messages>;

const SIZES: { id: VehicleSize; label: string }[] = [
  { id: "sedan", label: "Sedan" },
  { id: "suv", label: "SUV" },
  { id: "truck", label: "Truck" },
];

type DetailsMessages = { v_name: string; v_phone: string; v_address: string; v_email: string };

// Phone numbers are read the way people write them in the detailer's country.
const detailsSchemaFor = (country: Country, needAddress: boolean, m: DetailsMessages) =>
  z.object({
  name: z.string().trim().min(2, m.v_name).max(80),
  phone: z
    .string()
    .trim()
    .refine((p) => toE164(p, country) !== null, m.v_phone),
  address: needAddress ? z.string().trim().min(6, m.v_address).max(200) : z.string().max(200),
  email: z.union([z.literal(""), z.string().trim().email(m.v_email)]),
  // Optional: consent to texts is never a condition of booking.
  smsConsent: z.boolean(),
});

type Details = { name: string; phone: string; address: string; email: string; smsConsent: boolean };

const spring = { type: "spring", stiffness: 420, damping: 34 } as const;
/** This browser's own details from the last booking, so booking again takes a few taps. */
const REMEMBER_KEY = "beadup:my-details";

function initials(name: string) {
  const words = name.replace(/[^\p{L}\p{N}\s]/gu, "").split(/\s+/).filter(Boolean);
  return words.slice(0, 2).map((w) => w[0]!.toUpperCase()).join("") || "B";
}


export function BookingFlow({ detailer, smsEnabled }: { detailer: Detailer; smsEnabled: boolean }) {
  const { t, phrase, dateLocale } = useI18n();
  const money = (cents: number) => formatMoney(cents, detailer.country);
  const clock = (hhmm: string) => formatClock(hhmm, detailer.country);
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
  // How this business books (trade): size step or one price, client's address or the business's place.
  const trade = tradeOf(detailer.trade);
  const tiers = trade.pricing === "tiers";
  const studio = detailer.visitMode === "studio";
  // Nothing preselected: a size the client didn't choose must never set the price.
  const [size, setSize] = useState<VehicleSize | null>(null);
  // Single-price trades keep their one price in the first tier.
  const tier: VehicleSize | null = tiers ? size : "sedan";
  // Step 2 (size and extras) is skipped when there is nothing to choose there.
  const skipExtras = !tiers && detailer.addOns.length === 0;
  const steps = [t("step_service"), tiers ? phrase(trade.tierTitle) : t("step_extras"), t("step_time"), t("step_details"), t("step_review")];
  const [addOns, setAddOns] = useState<string[]>([]);
  // Computed only once the visitor reaches the time step, so the current date
  // is read in their browser and never during the server prerender.
  // Times booked by others during this visit, on top of what the page loaded with.
  const [lostSlots, setLostSlots] = useState<string[]>([]);
  // Team: a chosen person, or null for "anyone".
  const [staffId, setStaffId] = useState<string | null>(null);
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
            staffIds: staffId ? [staffId] : detailer.staff.map((m) => m.id),
            locale: dateLocale,
          })
        : [],
    [showDays, dateLocale, detailer.weeklySlots, detailer.busy, detailer.bufferMin, detailer.timezone, detailer.taken, detailer.daysOff, detailer.staff, staffId, durationMin, lostSlots],
  );
  const [pickedDay, setDayKey] = useState<string | null>(null);
  // A longer service picked after going back can close the chosen day or time.
  const dayKey = (pickedDay && days.some((d) => d.key === pickedDay) ? pickedDay : null) ?? days[0]?.key ?? null;
  const [pickedSlot, setSlot] = useState<string | null>(null);
  const slot = pickedSlot && days.find((d) => d.key === dayKey)?.slots.includes(pickedSlot) ? pickedSlot : null;
  const [details, setDetails] = useState<Details>({ name: "", phone: "", address: "", email: "", smsConsent: false });
  const [errors, setErrors] = useState<Partial<Record<keyof Details, string>>>({});
  const [booked, setBooked] = useState(false);
  const [paying, setPaying] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [bookError, setBookError] = useState<string | null>(null);
  const [paidCents, setPaidCents] = useState<number | null>(null);
  const [bookedRef, setBookedRef] = useState<{ bookingId: string; token: string } | null>(null);
  // Returning clients: their own details, remembered in this browser only (never sent anywhere until they book).
  function prefillDetails() {
    try {
      const saved = JSON.parse(localStorage.getItem(REMEMBER_KEY) ?? "null") as Partial<Details> | null;
      if (!saved || typeof saved.name !== "string") return;
      setDetails((d) => ({
        ...d,
        name: d.name || saved.name || "",
        phone: d.phone || saved.phone || "",
        address: d.address || saved.address || "",
        email: d.email || saved.email || "",
      }));
    } catch {
      // storage blocked or empty: nothing to fill
    }
  }

  const service = detailer.services.find((s) => s.id === serviceId);
  // Launch mode: the client pays the deposit to the detailer directly (no card form, no booking fee).
  const external = detailer.payments === "external";
  const shortName = detailer.businessName.replace(/\.+$/, "");
  const totals = useMemo(() => {
    // Before a size is chosen, the lowest price ("from").
    const base = !service ? 0 : tier ? service.priceCents[tier] : Math.min(service.priceCents.sedan, service.priceCents.suv, service.priceCents.truck);
    const extras = detailer.addOns.filter((a) => addOns.includes(a.id)).reduce((n, a) => n + a.priceCents, 0);
    const total = base + extras;
    const deposit = depositCents(total);
    const fee = external ? 0 : bookingFeeCents(deposit);
    return { base, extras, total, deposit, fee, dueToday: deposit + fee };
  }, [service, tier, addOns, detailer.addOns, external]);

  const canContinue =
    (step === 0 && !!serviceId) || (step === 1 && !!tier) || (step === 2 && !!dayKey && !!slot) || step === 3 || step === 4;

  function go(to: number) {
    if (to === 3) prefillDetails();
    setDir(to > step ? 1 : -1);
    setStep(to);
  }

  function next() {
    if (step === 3) {
      const parsed = detailsSchemaFor(detailer.country, !studio, { v_name: t("v_name"), v_phone: t("v_phone"), v_address: t("v_address"), v_email: t("v_email") }).safeParse(details);
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
        setBookError(t("verifyFirst"));
        requestAnimationFrame(() => document.getElementById("book-alert")?.scrollIntoView({ block: "center", behavior: "smooth" }));
        return;
      }
      primeAudio(); // inside the click, so the chime is allowed to play later
      setPaying(true);
      setBookError(null);
      createBooking({
        handle: detailer.handle,
        serviceId: serviceId ?? "", // always set by the review step (Continue needs a pick)
        vehicleSize: tier ?? "sedan",
        addOnIds: addOns,
        date: dayKey ?? "",
        time: slot ?? "",
        name: details.name,
        phone: details.phone,
        address: studio ? "" : details.address,
        smsConsent: smsEnabled && details.smsConsent,
        email: details.email.trim(),
        staffId: staffId ?? undefined,
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
            try {
              localStorage.setItem(REMEMBER_KEY, JSON.stringify({ name: details.name, phone: details.phone, address: details.address, email: details.email }));
            } catch {
              // private mode: fine
            }
            setPaidCents(res.depositCents + res.bookingFeeCents);
            setBooked(true);
            return;
          }
          setBookError(t(BOOK_ERROR_KEYS[res.error]));
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
        .catch(() => setBookError(t("err_unavailable")))
        .finally(() => setPaying(false));
      return;
    }
    haptic("step");
    go(step === 0 && skipExtras ? 2 : step + 1);
  }

  const day = days.find((d) => d.key === dayKey);

  if (booked) {
    return (
      <BookedCelebration
        businessName={detailer.businessName}
        when={`${day?.label ?? ""} · ${slot ? clock(slot) : ""}`}
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
                title: t("calTitle", { service: service?.name ?? t("calDefaultService"), name: detailer.businessName }),
                date: dayKey,
                time: slot,
                timezone: detailer.timezone,
                durationMin: service?.durationMin ?? 60,
                location: studio ? [shortName, detailer.serviceArea].filter(Boolean).join(", ") : details.address,
                description: t("calDesc", { name: detailer.businessName }),
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
            alt={t("detailerAlt", { name: detailer.businessName })}
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
            <span className="font-medium text-steel">{t("newLabel")}</span>
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
          <span className="text-steel">{t("questionsFirst")}</span>
          <a
            href={whatsappUrl(detailer.contactPhone, t("waMsg", { name: shortName }))}
            target="_blank"
            rel="noopener noreferrer"
            className="flex h-9 items-center gap-1.5 rounded-full border border-[#25D366]/40 bg-[#25D366]/10 px-3 font-semibold text-[#7ff0a8]"
          >
            <WhatsAppIcon />
            WhatsApp
          </a>
          <a href={`tel:${detailer.contactPhone}`} className="flex h-9 items-center rounded-full border border-white/15 px-3 font-semibold">
            {t("call")}
          </a>
        </div>
      )}

      <nav aria-label={t("bookingSteps")} className="mt-6 flex gap-1.5">
        {steps.map((label, i) => (skipExtras && i === 1 ? null : (
          <button
            key={label}
            type="button"
            onClick={() => i < step && go(i)}
            disabled={i >= step}
            aria-current={i === step ? "step" : undefined}
            aria-label={`${label}`}
            className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-white/[0.08] enabled:cursor-pointer"
          >
            <span
              className={`absolute inset-0 origin-left rounded-full bg-gradient-to-r from-[#7fe4ff] to-bead shadow-[0_0_12px_rgba(77,216,255,0.7)] transition-transform duration-500 ease-(--ease-spring) ${i <= step ? "scale-x-100" : "scale-x-0"}`}
            />
          </button>
        )))}
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
                <StepTitle eyebrow={t("stepN", { n: 1 })} title={phrase(trade.pickTitle)} />
                {bookError && (
                  <p role="alert" className="mt-4 rounded-2xl border border-[#ff8a8a]/30 bg-[#ff8a8a]/10 p-3.5 text-sm text-[#ffb3b3]">
                    {bookError}
                  </p>
                )}
                <div className="mt-5 flex flex-col gap-2.5" role="radiogroup" aria-label={t("serviceLabel")}>
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
                        className={`relative flex gap-3.5 rounded-[22px] border border-white/[0.07] bg-gradient-to-b from-[#1a1f27] to-gunmetal p-4 text-left shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] ${s.photo && trade.photoFirst ? "flex-col items-stretch" : "items-center"}`}
                      >
                        {active && (
                          <motion.span
                            layoutId="service-glow"
                            transition={spring}
                            className="absolute inset-0 rounded-[22px] border-2 border-bead bg-[#10262e] shadow-[0_0_0_4px_rgba(77,216,255,0.08),0_12px_40px_rgba(77,216,255,0.15)]"
                          />
                        )}
                        {s.photo && (
                          // The service's own photo (a hairstyle, a finish): clients pick by what they see.
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={`/api/media/${detailer.handle}/${s.id}?v=${s.photo}`}
                            alt=""
                            loading="lazy"
                            width={trade.photoFirst ? 400 : 64}
                            height={trade.photoFirst ? 300 : 64}
                            className={`relative shrink-0 object-cover ring-1 ring-white/10 ${trade.photoFirst ? "aspect-[4/3] w-full rounded-[16px]" : "h-16 w-16 rounded-[14px]"}`}
                          />
                        )}
                        <span className="relative flex flex-1 items-center gap-3">
                        <span className="relative flex-1">
                          <span className="block text-base font-semibold">{s.name}</span>
                          <span className="mt-0.5 block text-[13px] text-steel">
                            {s.description} · {s.durationMin >= 60 ? t("hours", { n: s.durationMin / 60 }) : t("minutes", { n: s.durationMin })}
                          </span>
                        </span>
                        <span className={`relative text-[17px] font-bold ${active ? "text-bead" : ""}`}>
                          {tiers ? t("fromPrice", { price: money(Math.min(s.priceCents.sedan, s.priceCents.suv, s.priceCents.truck)) }) : money(s.priceCents.sedan)}
                        </span>
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
                <StepTitle eyebrow={t("stepN", { n: 2 })} title={tiers ? phrase(trade.tierTitle) : t("addExtras")} />
                {tiers && (
                <div className="glass mt-5 grid grid-cols-3 gap-1 rounded-[20px] p-1" role="radiogroup" aria-label={phrase(trade.tierTitle)}>
                  {SIZES.map((s) => ({ ...s, label: phrase(trade.tiers[s.id]) })).map((s) => {
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
                        <span className="relative px-1 text-[14px] leading-tight">{s.label}</span>
                      </button>
                    );
                  })}
                </div>
                )}

                {detailer.addOns.length > 0 && tiers && <h3 className="mt-7 text-[13px] font-medium uppercase tracking-[0.12em] text-steel">{t("addOns")}</h3>}
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
                <StepTitle eyebrow={t("stepN", { n: 3 })} title={t("pickTime")} />
                {detailer.staff.length > 0 && (
                  <div className="mt-5 flex flex-wrap gap-2" role="radiogroup" aria-label={t("withWho")}>
                    {[{ id: null, name: t("anyone") }, ...detailer.staff].map((m) => {
                      const on = m.id === staffId;
                      return (
                        <button
                          key={m.id ?? "anyone"}
                          type="button"
                          role="radio"
                          aria-checked={on}
                          onClick={() => { haptic(); setStaffId(m.id); setSlot(null); }}
                          className={`h-10 rounded-full border px-4 text-[14px] font-semibold transition-colors ${on ? "border-bead bg-bead text-bead-ink" : "border-white/15 text-mist"}`}
                        >
                          {m.name}
                        </button>
                      );
                    })}
                  </div>
                )}
                <div className="-mx-4 mt-5 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none]" role="radiogroup" aria-label={t("dayLabel")}>
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
                <div className="mt-4 grid grid-cols-3 gap-2" role="radiogroup" aria-label={t("timeLabel")}>
                  {days.length === 0 && (
                    <p className="col-span-3 rounded-2xl border border-line bg-gunmetal p-4 text-sm text-steel">
                      {t("noTimes")}
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
                        {clock(s)}
                      </motion.button>
                    );
                  })}
                </div>
                <p className="mt-4 text-[13px] text-steel">{t("serviceArea", { area: detailer.serviceArea })}</p>
                {bookError && (
                  <p role="alert" className="mt-4 rounded-2xl border border-[#ff8a8a]/30 bg-[#ff8a8a]/10 p-3.5 text-sm text-[#ffb3b3]">
                    {bookError}
                  </p>
                )}
              </>
            )}

            {step === 3 && (
              <>
                <StepTitle eyebrow={t("stepN", { n: 4 })} title={studio ? t("yourDetails") : detailer.trade === "detailing" || detailer.trade === "boat_rv" ? t("whereVehicle") : t("whereCome")} />
                <form className="mt-5 flex flex-col gap-3" onSubmit={(e) => (e.preventDefault(), next())} noValidate>
                  <Field label={t("fName")} error={errors.name}>
                    <input autoComplete="name" value={details.name} maxLength={80} onChange={(e) => setDetails({ ...details, name: e.target.value })} />
                  </Field>
                  <Field label={t("fPhone")} error={errors.phone}>
                    <input type="tel" inputMode="tel" autoComplete="tel" placeholder={COUNTRIES[detailer.country].phoneExample} value={details.phone} maxLength={20} onChange={(e) => setDetails({ ...details, phone: e.target.value })} />
                  </Field>
                  {studio ? (
                    <p className="rounded-2xl border border-white/10 bg-white/[0.03] p-3.5 text-[14px] leading-relaxed text-steel">
                      {t("studioGo", { name: shortName, area: detailer.serviceArea ? `, ${detailer.serviceArea}` : "" })}
                    </p>
                  ) : (
                    <Field label={t("fAddress")} error={errors.address}>
                      <input autoComplete="street-address" value={details.address} maxLength={200} onChange={(e) => setDetails({ ...details, address: e.target.value })} />
                    </Field>
                  )}
                  <Field label={t("fEmail")} error={errors.email}>
                    <input type="email" inputMode="email" autoComplete="email" value={details.email} maxLength={254} onChange={(e) => setDetails({ ...details, email: e.target.value })} />
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
                  <button type="submit" className="sr-only">{t("continueBtn")}</button>
                </form>
              </>
            )}

            {step === 4 && (
              <>
                <StepTitle eyebrow={t("lastStep")} title={t("reviewTitle")} />
                <div className="glass glass-edge mt-5 rounded-[24px] p-5">
                  <p className="font-display text-lg font-bold">{service?.name}</p>
                  <p className="mt-1 text-sm text-steel">
                    {[tier ? tierLabel(detailer.trade, tier) : "", day?.label, slot && clock(slot)].filter(Boolean).join(" · ")}
                  </p>
                  <div className="my-4 h-px bg-white/[0.06]" />
                  <Row label={service?.name ?? ""} value={money(totals.base)} />
                  {detailer.addOns
                    .filter((a) => addOns.includes(a.id))
                    .map((a) => (
                      <Row key={a.id} label={a.name} value={money(a.priceCents)} />
                    ))}
                  <Row label={t("total")} value={money(totals.total)} strong />
                  <div className="my-4 h-px bg-white/[0.06]" />
                  <Row label={t("deposit30")} value={money(totals.deposit)} />
                  {!external && <Row label={t("bookingFee")} value={money(totals.fee)} muted />}
                  <Row label={t("payAfter", { amount: money(totals.total - totals.deposit) })} value="" muted />
                </div>
                {external ? (
                  <p className="mt-4 text-[13px] leading-relaxed text-steel">
                    {t("externalNote", { amount: money(totals.deposit), name: shortName })}
                  </p>
                ) : (
                  <>
                    <p className="mt-4 flex items-center gap-2 text-[13px] text-steel">
                      <svg width="14" height="16" viewBox="0 0 16 18" aria-hidden="true">
                        <rect x="2" y="8" width="12" height="9" rx="2" fill="currentColor" />
                        <path d="M5 8V5a3 3 0 0 1 6 0v3" fill="none" stroke="currentColor" strokeWidth="2" />
                      </svg>
                      {t("encrypted")}
                    </p>
                    <p className="mt-2 text-[13px] leading-relaxed text-steel">
                      {t("cancelPolicy", { name: shortName })}
                    </p>
                  </>
                )}
                <Turnstile
                  onToken={(token) => {
                    setTurnstileToken(token);
                    if (token) setBookError((e) => (e === t("verifyFirst") ? null : e)); // ticked: clear the hint
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
              <button type="button" onClick={() => go(step === 2 && skipExtras ? 0 : step - 1)} aria-label={t("back")} className="-ml-2 flex h-11 w-11 items-center justify-center rounded-full text-steel hover:text-paint">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                  <path d="M15 18l-6-6 6-6" />
                </svg>
              </button>
            )}
            <div className="min-w-0 flex-1">
              {service ? (
                <>
                  <p className="text-xs text-steel">
                    {step === 4 ? (external ? t("depositPaidTo", { name: shortName }) : t("dueToday")) : tier ? t("estimatedTotal") : t("fromLabel")}
                  </p>
                  <AnimatedPrice cents={step === 4 ? totals.dueToday : totals.total} animate={hydrated} country={detailer.country} />
                </>
              ) : (
                <p className="text-sm text-steel">{t("pickToSee")}</p>
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
                <motion.span animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 0.8, ease: "linear" }} className="block h-5 w-5 rounded-full border-2 border-bead-ink border-t-transparent" aria-label={t("processing")} />
              ) : step === 4 ? (
                external ? t("book") : t("bookPay")
              ) : (
                t("continueBtn")
              )}
            </motion.button>
          </div>
          {/* Every booking page quietly introduces Beadup to other detailers. */}
          <a
            href={`/?utm_source=booking_page&utm_medium=referral&utm_campaign=${encodeURIComponent(detailer.handle)}`}
            className="mx-auto mt-2.5 flex w-fit items-center justify-center gap-1.5 rounded-full px-2 py-1 text-[11px] text-steel transition-colors hover:text-mist"
          >
            <BeadLogo size={12} animate={false} /> {t("powered")}
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
  const { t } = useI18n();
  return (
    <section aria-label={t("workBy", { name: businessName })} className="mt-7">
      <h3 className="font-display text-[17px] font-bold">{t("recentWork")}</h3>
      <ul className="-mx-4 mt-3 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-2">
        {items.map((p) => (
          <li key={p.id} className="w-[72%] max-w-[280px] shrink-0 snap-start">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`/api/media/${handle}/${p.id}`}
              alt={p.caption || t("workBy", { name: businessName })}
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
