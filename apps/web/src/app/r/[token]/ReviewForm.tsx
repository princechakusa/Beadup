"use client";

import { motion, useReducedMotion } from "motion/react";
import { useState } from "react";
import { BeadLogo } from "@/components/BeadLogo";
import { haptic, primeAudio, playBookedChime } from "@/lib/feedback";
import { submitReview } from "./actions";

const LABELS = ["", "Not good", "Could be better", "Good", "Great", "Outstanding"];

export function ReviewForm({ token, businessName, firstName }: { token: string; businessName: string; firstName: string }) {
  const reduce = useReducedMotion();
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [body, setBody] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "done">("idle");
  const [error, setError] = useState<string | null>(null);
  const shown = hover || rating;

  const send = async () => {
    if (!rating) return;
    primeAudio();
    setState("sending");
    setError(null);
    const res = await submitReview({ token, rating, body });
    if (res.ok || res.error === "already_reviewed") {
      haptic("success");
      playBookedChime();
      setState("done");
    } else {
      setState("idle");
      setError(res.error === "rate_limited" ? "Too many tries. Please wait a little and try again." : "Something went wrong. Please try again.");
    }
  };

  if (state === "done") {
    return (
      <motion.div
        initial={reduce ? false : { opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col items-center gap-4 text-center"
      >
        <BeadLogo size={64} />
        <h1 className="font-display text-3xl font-extrabold">Thank you{firstName ? `, ${firstName}` : ""}</h1>
        <p className="text-steel">Your review helps {businessName} and other drivers nearby.</p>
      </motion.div>
    );
  }

  return (
    <div className="flex w-full flex-col items-center gap-6 text-center">
      <BeadLogo size={56} />
      <div>
        <h1 className="text-gradient font-display text-[28px] font-extrabold leading-tight tracking-[-0.03em]">How did {businessName} do?</h1>
        <p className="mt-2 text-[15px] text-steel">Tap a star to rate your detail.</p>
      </div>

      <div className="flex gap-2" role="radiogroup" aria-label="Rating" onMouseLeave={() => setHover(0)}>
        {[1, 2, 3, 4, 5].map((n) => {
          const on = n <= shown;
          return (
            <motion.button
              key={n}
              type="button"
              role="radio"
              aria-checked={rating === n}
              aria-label={`${n} star${n > 1 ? "s" : ""}`}
              onMouseEnter={() => setHover(n)}
              onClick={() => {
                haptic("select");
                setRating(n);
              }}
              whileTap={reduce ? undefined : { scale: 0.85 }}
              animate={reduce ? undefined : { scale: on ? 1.08 : 1 }}
              transition={{ type: "spring", stiffness: 500, damping: 18 }}
              className="flex h-14 w-14 items-center justify-center rounded-2xl border border-white/[0.08] bg-gradient-to-b from-[#1a1f27] to-gunmetal shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]"
            >
              <svg width="30" height="30" viewBox="0 0 24 24" aria-hidden="true" fill={on ? "#FFB547" : "none"} stroke={on ? "#FFB547" : "#5B6371"} strokeWidth="1.8" strokeLinejoin="round">
                <path d="M12 3.5l2.5 5.2 5.7.7-4.2 3.9 1.1 5.6L12 16.1l-5.1 2.8 1.1-5.6-4.2-3.9 5.7-.7z" />
              </svg>
            </motion.button>
          );
        })}
      </div>
      <p className="h-5 text-sm font-semibold text-paint" aria-live="polite">
        {LABELS[shown]}
      </p>

      <label className="flex w-full flex-col gap-2 text-left">
        <span className="text-[13px] text-steel">
          {rating === 0
            ? "Anything to add? (optional)"
            : rating <= 3
              ? "What could have been better? Your detailer reads every review."
              : "What did you like most? (optional)"}
        </span>
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value.slice(0, 1000))}
          rows={4}
          placeholder={rating > 0 && rating <= 3 ? "For example: arrived late, missed a spot on the wheels" : "For example: on time, interior looks brand new"}
          className="w-full resize-none rounded-2xl border border-line bg-black/30 p-4 text-base text-paint outline-none transition-[border-color,box-shadow] focus:border-bead/70 focus:shadow-[0_0_0_4px_rgba(77,216,255,0.12)]"
        />
      </label>

      {error && (
        <p role="alert" className="text-sm text-[#ffb3b3]">
          {error}
        </p>
      )}

      <button
        type="button"
        onClick={send}
        disabled={!rating || state === "sending"}
        className="btn-sheen h-14 w-full rounded-[18px] bg-bead font-bold text-bead-ink shadow-[0_10px_30px_rgba(77,216,255,0.35)] transition-opacity disabled:opacity-40 disabled:shadow-none"
      >
        {state === "sending" ? "Sending…" : "Send review"}
      </button>
    </div>
  );
}
