"use client";

import { motion, useReducedMotion } from "motion/react";
import { useEffect, useMemo, useState } from "react";
import { reportDepositSent } from "@/app/[handle]/actions";
import { WhatsAppIcon } from "@/components/booking/WhatsAppIcon";
import { whatsappUrl } from "@/lib/countries";
import { haptic, playBookedChime } from "@/lib/feedback";
import { GlassBead } from "@/components/GlassBead";
import { buildIcs, type CalendarEvent } from "@/lib/ics";
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
  calendar,
  contact,
  depositSent,
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
  /** "Add to calendar": an .ics built and downloaded in the browser. */
  calendar?: CalendarEvent;
  /** The detailer's public phone: E.164 for links, and how it's written locally. */
  contact?: { e164: string; display: string };
  /** External payments: lets this browser tell the detailer the deposit is sent. */
  depositSent?: { bookingId: string; token: string };
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

        {calendar && <AddToCalendar event={calendar} />}

        {depositSent && <SaveBookingLink token={depositSent.token} />}

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
            {depositSent && (payment.link || payment.note) && (
              <DepositSent businessName={businessName} report={() => reportDepositSent(depositSent)} />
            )}
          </div>
        )}

        {contact && (
          <div className="mt-4 flex items-center justify-between gap-3 rounded-[20px] border border-white/10 bg-white/[0.03] px-4 py-3 text-left">
            <div className="min-w-0">
              <p className="text-[13px] text-steel">Questions? {businessName}</p>
              <p className="truncate text-[15px] font-semibold">{contact.display}</p>
            </div>
            <div className="flex shrink-0 gap-2">
              <a
                href={whatsappUrl(contact.e164, `Hi ${businessName}, I just booked ${serviceName} (${when}) on Beadup.`)}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`WhatsApp ${businessName}`}
                className="flex h-11 items-center rounded-full border border-[#25D366]/40 bg-[#25D366]/10 px-3 text-[#7ff0a8] transition-transform active:scale-[0.97]"
              >
                <WhatsAppIcon size={18} />
              </a>
              <a href={`sms:${contact.e164}`} className="flex h-11 items-center rounded-full border border-white/15 px-4 text-[14px] font-semibold transition-transform active:scale-[0.97]">
                Text
              </a>
              <a href={`tel:${contact.e164}`} className="flex h-11 items-center rounded-full border border-white/15 px-4 text-[14px] font-semibold transition-transform active:scale-[0.97]">
                Call
              </a>
            </div>
          </div>
        )}

        <p className="mt-6 text-[13px] leading-relaxed text-steel">
          {payment
            ? contact
              ? "Need to change anything? Text or call the detailer."
              : "Need to change anything? Contact the detailer directly."
            : smsEnabled
              ? "Your receipt and confirmation are on their way by text and email. You'll get a reminder the day before."
              : "Your receipt is on its way by email. Need to change anything? Contact the detailer directly."}
        </p>
      </div>
    </main>
  );
}

export function AddToCalendar({ event }: { event: CalendarEvent }) {
  function save() {
    haptic("step");
    let ics: string;
    try {
      ics = buildIcs(event);
    } catch {
      return;
    }
    const url = URL.createObjectURL(new Blob([ics], { type: "text/calendar;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "beadup-booking.ics";
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
  }
  return (
    <button
      type="button"
      onClick={save}
      className="mt-3 flex h-[52px] w-full items-center justify-center gap-2.5 rounded-[18px] border border-white/[0.12] bg-white/[0.04] font-semibold text-paint transition-[transform,background-color] duration-300 hover:bg-white/[0.08] active:scale-[0.98]"
    >
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="text-bead">
        <rect x="3.5" y="5" width="17" height="15.5" rx="3" />
        <path d="M3.5 10h17M8 3v4M16 3v4M12 13.5v4M10 15.5h4" />
      </svg>
      Add to calendar
    </button>
  );
}

/**
 * "I've sent the deposit": tells the detailer to check their account. It does
 * not mark anything paid; the detailer confirms the money arrived in the app.
 */
export function DepositSent({ businessName, report }: { businessName: string; report: () => Promise<{ ok: boolean }> }) {
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  if (state === "sent") {
    return (
      <p role="status" className="mt-4 text-[13px] leading-relaxed text-steel">
        Thanks. We&apos;ve told {businessName}. They&apos;ll confirm once the deposit arrives.
      </p>
    );
  }
  return (
    <div className="mt-3">
      <button
        type="button"
        disabled={state === "sending"}
        onClick={() => {
          haptic("step");
          setState("sending");
          report()
            .then((r) => setState(r.ok ? "sent" : "error"))
            .catch(() => setState("error"));
        }}
        className="flex h-11 w-full items-center justify-center rounded-[16px] border border-gold/40 text-[14px] font-semibold text-gold transition-transform active:scale-[0.98] disabled:opacity-60"
      >
        {state === "sending" ? "Letting them know…" : "I've sent the deposit"}
      </button>
      {state === "error" && (
        <p role="alert" className="mt-2 text-[13px] text-steel">
          That didn&apos;t go through. Please try again, or let {businessName} know directly.
        </p>
      )}
    </div>
  );
}

/** The client's private booking page: view, pay, ask to move or cancel. Saved by the client, never sent by Beadup. */
function SaveBookingLink({ token }: { token: string }) {
  const [copied, setCopied] = useState(false);
  const path = `/b/${token}`;
  return (
    <div className="mt-3 rounded-[20px] border border-white/10 bg-white/[0.03] p-4 text-left">
      <p className="text-[14px] font-semibold">Your booking page</p>
      <p className="mt-1 text-[13px] leading-relaxed text-steel">
        Save this private link to see your booking, pay the deposit later, or ask to change it.
      </p>
      <div className="mt-3 flex gap-2">
        <a href={path} className="flex h-11 flex-1 items-center justify-center rounded-full bg-bead/15 text-[14px] font-semibold text-bead">
          Open
        </a>
        <button
          type="button"
          onClick={() => {
            haptic("step");
            navigator.clipboard
              ?.writeText(new URL(path, window.location.origin).toString())
              .then(() => setCopied(true))
              .catch(() => {});
          }}
          className="flex h-11 flex-1 items-center justify-center rounded-full border border-white/15 text-[14px] font-semibold"
        >
          {copied ? "Copied" : "Copy link"}
        </button>
      </div>
    </div>
  );
}
