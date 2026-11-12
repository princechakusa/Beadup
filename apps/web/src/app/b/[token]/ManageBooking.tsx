"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { AddToCalendar, DepositSent } from "@/components/booking/BookedCelebration";
import type { Detailer } from "@/lib/booking-types";
import type { ClientBooking } from "@/lib/client-booking";
import { WhatsAppIcon } from "@/components/booking/WhatsAppIcon";
import { formatMoney, formatPhone, whatsappUrl, type Country } from "@/lib/countries";
import { haptic } from "@/lib/feedback";
import { wallClock } from "@/lib/ics";
import { openDays } from "@/lib/slots";
import { tierLabel } from "@/lib/trades";
import { useHydrated } from "@/lib/use-hydrated";
import { reportSentByToken, requestChange, type ActionResult } from "./actions";

export type Availability = Pick<Detailer, "weeklySlots" | "busy" | "bufferMin" | "daysOff">;
type View = Omit<ClientBooking, "bookingId">;

const STATUS: Record<View["status"], { label: string; tone: string }> = {
  pending_payment: { label: "Awaiting payment", tone: "border-gold/40 text-gold" },
  confirmed: { label: "Confirmed", tone: "border-bead/40 text-bead" },
  completed: { label: "Completed", tone: "border-white/20 text-paint" },
  cancelled: { label: "Cancelled", tone: "border-white/20 text-steel" },
  no_show: { label: "Missed", tone: "border-white/20 text-steel" },
};
const ERRORS: Record<Exclude<ActionResult, { ok: true }>["error"], string> = {
  invalid: "Something didn't check out. Please try again.",
  rate_limited: "Too many tries. Please wait a few minutes.",
  status: "This booking can't be changed any more. Contact the detailer directly.",
  unavailable: "That didn't go through. Please try again shortly.",
};

const to12h = (hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number);
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, "0")} ${h >= 12 ? "PM" : "AM"}`;
};
/** "YYYY-MM-DD HH:MM" (detailer's zone) as "Tue, Nov 18 · 10:00 AM". */
const localLabel = (s: string) => {
  const [date, time] = s.split(" ");
  const d = new Date(`${date}T12:00:00Z`).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" });
  return `${d} · ${to12h(time)}`;
};

export function ManageBooking({ token, booking: b, availability }: { token: string; booking: View; availability: Availability | null }) {
  const router = useRouter();
  const hydrated = useHydrated();
  const money = (c: number) => formatMoney(c, b.country as Country);
  const when = wallClock(b.startsAt, b.timezone);
  const whenLabel = localLabel(`${when.date} ${when.time}`);
  const live = b.status === "confirmed" || b.status === "pending_payment";
  const canAsk = live && availability !== null; // upcoming and not yet started (checked on the server)
  const status = STATUS[b.status];
  const [mode, setMode] = useState<"none" | "reschedule" | "cancel">("none");

  return (
    <div className="flex flex-col gap-4">
      <header>
        <p className="text-[13px] text-steel">{b.businessName}</p>
        <h1 className="mt-1 font-display text-[32px] font-extrabold leading-tight">Hi {b.firstName}</h1>
        <div className="mt-3 flex items-center gap-2">
          <span className={`rounded-full border px-3 py-1 text-[12px] font-semibold ${status.tone}`}>{status.label}</span>
          <span className="text-[12px] text-steel">Ref {b.ref}</span>
        </div>
      </header>

      <section aria-label="Booking" className="glass glass-edge rounded-[24px] p-5">
        <Row label="When" value={whenLabel} strong />
        <Row label="Service" value={b.serviceName} />
        {b.addOns.length > 0 && <Row label="Add-ons" value={b.addOns.join(", ")} />}
        {tierLabel(b.trade, b.vehicleSize) && <Row label="Size" value={tierLabel(b.trade, b.vehicleSize)} />}
        {b.visitMode === "studio" && <Row label="Where" value={`At ${b.businessName}`} />}
        <Row label="Length" value={`About ${Math.round((b.durationMin / 60) * 10) / 10} h`} />
        <Row label="Total" value={money(b.subtotalCents)} />
      </section>

      {b.request && live && (
        <section role="status" className="rounded-[20px] border border-bead/30 bg-bead/[0.06] p-4 text-[14px] leading-relaxed">
          <p className="font-semibold">{b.request.kind === "cancel" ? "You asked to cancel" : "You asked for a new time"}</p>
          {b.request.preferred.length > 0 && <p className="mt-1 text-steel">Preferred: {b.request.preferred.map(localLabel).join("; ")}</p>}
          {b.request.note && <p className="mt-1 text-steel">“{b.request.note}”</p>}
          <p className="mt-1 text-steel">
            {b.businessName} will get back to you. Your booking stays as it is until they do.
          </p>
        </section>
      )}

      {b.depositCents > 0 && b.status !== "cancelled" && (
        <Payment b={b} token={token} money={money} onDone={() => router.refresh()} />
      )}

      {canAsk && mode === "none" && (
        <section aria-label="Change your booking" className="flex gap-2">
          <button type="button" onClick={() => setMode("reschedule")} className="h-12 flex-1 rounded-[16px] border border-white/15 text-[14px] font-semibold">
            Ask for a new time
          </button>
          <button type="button" onClick={() => setMode("cancel")} className="h-12 flex-1 rounded-[16px] border border-white/15 text-[14px] font-semibold text-steel">
            Ask to cancel
          </button>
        </section>
      )}
      {canAsk && mode === "reschedule" && hydrated && (
        <Reschedule
          token={token}
          b={b}
          availability={availability}
          onClose={() => setMode("none")}
          onDone={() => {
            setMode("none");
            router.refresh();
          }}
        />
      )}
      {canAsk && mode === "cancel" && (
        <CancelRequest
          token={token}
          businessName={b.businessName}
          onClose={() => setMode("none")}
          onDone={() => {
            setMode("none");
            router.refresh();
          }}
        />
      )}

      {b.contactPhone && (
        <section className="flex items-center justify-between gap-3 rounded-[20px] border border-white/10 bg-white/[0.03] px-4 py-3">
          <div className="min-w-0">
            <p className="text-[13px] text-steel">Questions? {b.businessName}</p>
            <p className="truncate text-[15px] font-semibold">{formatPhone(b.contactPhone, b.country as Country)}</p>
          </div>
          <div className="flex shrink-0 gap-2">
            <a
              href={whatsappUrl(b.contactPhone, `Hi ${b.businessName}, it's ${b.firstName} about my booking (ref ${b.ref}).`)}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`WhatsApp ${b.businessName}`}
              className="flex h-11 items-center rounded-full border border-[#25D366]/40 bg-[#25D366]/10 px-3 text-[#7ff0a8]"
            >
              <WhatsAppIcon size={18} />
            </a>
            <a href={`sms:${b.contactPhone}`} className="flex h-11 items-center rounded-full border border-white/15 px-4 text-[14px] font-semibold">
              Text
            </a>
            <a href={`tel:${b.contactPhone}`} className="flex h-11 items-center rounded-full border border-white/15 px-4 text-[14px] font-semibold">
              Call
            </a>
          </div>
        </section>
      )}

      {live && (
        <AddToCalendar
          event={{
            uid: `${b.handle}-${b.ref}`,
            title: `${b.serviceName} with ${b.businessName}`,
            date: when.date,
            time: when.time,
            timezone: b.timezone,
            durationMin: b.durationMin,
            location: "",
            description: `Booked with ${b.businessName} on Beadup. Ref ${b.ref}.`,
          }}
        />
      )}
      {hydrated && <ShareLink title={`${b.serviceName} with ${b.businessName}, ${whenLabel}`} />}
      <p className="text-center text-[12px] leading-relaxed text-steel">
        This page is private to you. Anyone with the link can see it, so only share it with people you trust.
      </p>
    </div>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex justify-between gap-4 py-1.5 text-[15px]">
      <span className="text-steel">{label}</span>
      <span className={`text-right ${strong ? "font-semibold" : ""}`}>{value}</span>
    </div>
  );
}

function Payment({ b, token, money, onDone }: { b: View; token: string; money: (c: number) => string; onDone: () => void }) {
  const label = { not_required: "", due: "Not paid yet", reported: "You said it's sent. Waiting for the detailer to confirm.", received: "Received. Thank you." }[b.depositStatus];
  const external = b.payments === "external";
  return (
    <section aria-label="Deposit" className="rounded-[24px] border border-gold/30 bg-gold/[0.06] p-5">
      <div className="flex justify-between text-[15px]">
        <span className="font-semibold">Deposit</span>
        <span className="font-display font-bold text-gold">{money(b.depositCents)}</span>
      </div>
      <p className="mt-1 text-[13px] leading-relaxed text-steel">{label}</p>
      {external && b.depositStatus === "due" && (
        <>
          {b.paymentNote && <p className="mt-3 whitespace-pre-line break-words text-[15px] font-medium">{b.paymentNote}</p>}
          {b.paymentLink && (
            <a
              href={b.paymentLink}
              target="_blank"
              rel="noopener noreferrer nofollow"
              className="mt-4 flex h-[52px] items-center justify-center rounded-[18px] bg-gold font-bold text-midnight"
            >
              Pay {money(b.depositCents)} deposit
            </a>
          )}
          {(b.paymentLink || b.paymentNote) && (
            <DepositSent
              businessName={b.businessName}
              report={async () => {
                const r = await reportSentByToken(token);
                if (r.ok) setTimeout(onDone, 1200);
                return r;
              }}
            />
          )}
          {!b.paymentLink && !b.paymentNote && <p className="mt-3 text-[13px] text-steel">{b.businessName} will contact you about the deposit.</p>}
        </>
      )}
    </section>
  );
}

function Reschedule({
  token,
  b,
  availability,
  onClose,
  onDone,
}: {
  token: string;
  b: View;
  availability: Availability;
  onClose: () => void;
  onDone: () => void;
}) {
  const days = useMemo(
    () =>
      openDays({
        ...availability,
        durationMin: b.durationMin,
        timeZone: b.timezone,
        now: new Date(),
        count: 10,
      }),
    [availability, b.durationMin, b.timezone],
  );
  const [day, setDay] = useState(days[0]?.key ?? null);
  const [picked, setPicked] = useState<string[]>([]);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const slots = days.find((d) => d.key === day)?.slots ?? [];
  const toggle = (s: string) => {
    haptic("step");
    setPicked((p) => (p.includes(s) ? p.filter((x) => x !== s) : p.length < 3 ? [...p, s] : p));
  };

  return (
    <section aria-label="Ask for a new time" className="glass glass-edge rounded-[24px] p-5">
      <p className="font-semibold">Pick up to 3 times that suit you</p>
      <p className="mt-1 text-[13px] text-steel">{b.businessName} confirms the new time. Until then your booking stays as it is.</p>
      {days.length === 0 ? (
        <p className="mt-3 text-[14px] text-steel">No open times in the next three weeks. Add a note instead.</p>
      ) : (
        <>
          <div className="-mx-1 mt-4 flex gap-2 overflow-x-auto px-1 pb-1" role="tablist" aria-label="Day">
            {days.map((d) => (
              <button
                key={d.key}
                type="button"
                role="tab"
                aria-selected={d.key === day}
                onClick={() => setDay(d.key)}
                className={`flex h-16 w-14 shrink-0 flex-col items-center justify-center rounded-[18px] border text-[12px] ${
                  d.key === day ? "border-bead bg-bead font-semibold text-midnight" : "border-white/10"
                }`}
              >
                {d.dow}
                <span className="text-[17px] font-bold">{d.day}</span>
              </button>
            ))}
          </div>
          <div className="mt-3 grid grid-cols-3 gap-2">
            {slots.map((s) => {
              const key = `${day} ${s}`;
              const on = picked.includes(key);
              return (
                <button
                  key={s}
                  type="button"
                  aria-pressed={on}
                  onClick={() => toggle(key)}
                  className={`h-11 rounded-[14px] border text-[14px] ${on ? "border-bead bg-bead font-semibold text-midnight" : "border-white/10"}`}
                >
                  {to12h(s)}
                </button>
              );
            })}
          </div>
        </>
      )}
      {picked.length > 0 && <p className="mt-3 text-[13px] text-steel">Picked: {picked.map(localLabel).join("; ")}</p>}
      <label className="mt-4 block text-[13px] text-steel" htmlFor="resched-note">
        Note (optional)
      </label>
      <textarea
        id="resched-note"
        value={note}
        maxLength={300}
        onChange={(e) => setNote(e.target.value)}
        rows={2}
        className="mt-1 w-full rounded-[14px] border border-white/10 bg-white/[0.03] p-3 text-[15px]"
        placeholder="e.g. Any weekday morning works"
      />
      {error && (
        <p role="alert" className="mt-2 text-[13px] text-danger">
          {error}
        </p>
      )}
      <div className="mt-4 flex gap-2">
        <button type="button" onClick={onClose} className="h-12 flex-1 rounded-[16px] border border-white/15 text-[14px] font-semibold text-steel">
          Back
        </button>
        <button
          type="button"
          disabled={busy || (picked.length === 0 && !note.trim())}
          onClick={() => {
            setBusy(true);
            setError(null);
            requestChange({ token, kind: "reschedule", preferred: picked, note })
              .then((r) => (r.ok ? onDone() : setError(ERRORS[r.error])))
              .catch(() => setError(ERRORS.unavailable))
              .finally(() => setBusy(false));
          }}
          className="h-12 flex-1 rounded-[16px] bg-bead text-[14px] font-semibold text-midnight disabled:opacity-50"
        >
          {busy ? "Sending…" : "Send request"}
        </button>
      </div>
    </section>
  );
}

function CancelRequest({ token, businessName, onClose, onDone }: { token: string; businessName: string; onClose: () => void; onDone: () => void }) {
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <section aria-label="Ask to cancel" className="rounded-[24px] border border-danger/30 bg-danger/[0.05] p-5">
      <p className="font-semibold">Ask {businessName} to cancel?</p>
      <p className="mt-1 text-[13px] leading-relaxed text-steel">
        They&apos;ll confirm the cancellation and sort out any deposit with you directly.
      </p>
      <label className="mt-4 block text-[13px] text-steel" htmlFor="cancel-note">
        Reason (optional)
      </label>
      <textarea
        id="cancel-note"
        value={note}
        maxLength={300}
        onChange={(e) => setNote(e.target.value)}
        rows={2}
        className="mt-1 w-full rounded-[14px] border border-white/10 bg-white/[0.03] p-3 text-[15px]"
      />
      {error && (
        <p role="alert" className="mt-2 text-[13px] text-danger">
          {error}
        </p>
      )}
      <div className="mt-4 flex gap-2">
        <button type="button" onClick={onClose} className="h-12 flex-1 rounded-[16px] border border-white/15 text-[14px] font-semibold">
          Keep booking
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => {
            setBusy(true);
            setError(null);
            requestChange({ token, kind: "cancel", preferred: [], note })
              .then((r) => (r.ok ? onDone() : setError(ERRORS[r.error])))
              .catch(() => setError(ERRORS.unavailable))
              .finally(() => setBusy(false));
          }}
          className="h-12 flex-1 rounded-[16px] border border-danger/50 text-[14px] font-semibold text-danger disabled:opacity-50"
        >
          {busy ? "Sending…" : "Send request"}
        </button>
      </div>
    </section>
  );
}

function ShareLink({ title }: { title: string }) {
  const [copied, setCopied] = useState(false);
  const canShare = typeof navigator !== "undefined" && typeof navigator.share === "function";
  return (
    <div className="flex gap-2">
      <button
        type="button"
        onClick={() => {
          haptic("step");
          navigator.clipboard
            ?.writeText(window.location.href)
            .then(() => setCopied(true))
            .catch(() => {});
        }}
        className="h-12 flex-1 rounded-[16px] border border-white/15 text-[14px] font-semibold"
      >
        {copied ? "Link copied" : "Copy link"}
      </button>
      {canShare && (
        <button
          type="button"
          onClick={() => navigator.share({ title, url: window.location.href }).catch(() => {})}
          className="h-12 flex-1 rounded-[16px] border border-white/15 text-[14px] font-semibold"
        >
          Share
        </button>
      )}
    </div>
  );
}
