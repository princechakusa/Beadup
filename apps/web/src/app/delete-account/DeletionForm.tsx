"use client";

import { useState } from "react";
import { Turnstile, turnstileEnabled } from "@/components/booking/Turnstile";
import { requestDeletion } from "./actions";

const ERRORS = {
  invalid: "Enter the email address you use for Beadup.",
  bot_check: "We couldn't verify this browser. Refresh the page and try again.",
  rate_limited: "Too many requests. Please try again in an hour.",
  unavailable: "Something went wrong. Please email us instead.",
} as const;

export function DeletionForm({ supportEmail }: { supportEmail: string }) {
  const [email, setEmail] = useState("");
  const [note, setNote] = useState("");
  const [token, setToken] = useState<string | null>(null);
  const [state, setState] = useState<"idle" | "sending" | "sent">("idle");
  const [error, setError] = useState<string | null>(null);

  if (state === "sent") {
    return (
      <div role="status" className="rounded-[24px] border border-mint/30 bg-mint/[0.08] p-6 shadow-[0_0_60px_-20px_rgba(110,231,168,0.4)]">
        <p className="font-semibold text-paint">Request received.</p>
        <p className="mt-2">
          We&apos;ll confirm by email from {supportEmail} and delete the account and its data within 30 days. If we
          can&apos;t find an account for that email, we&apos;ll let you know.
        </p>
      </div>
    );
  }

  return (
    <form
      className="glass glass-edge flex flex-col gap-5 rounded-[28px] p-6 sm:p-8"
      onSubmit={async (e) => {
        e.preventDefault();
        if (turnstileEnabled && !token) return setError(ERRORS.bot_check);
        setState("sending");
        setError(null);
        const res = await requestDeletion({ email, note, turnstileToken: token ?? undefined });
        if (res.ok) setState("sent");
        else {
          setState("idle");
          setError(ERRORS[res.error]);
        }
      }}
    >
      <label className="flex flex-col gap-2">
        <span className="text-sm font-medium text-mist">Email address on the account</span>
        <input
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="h-[52px] rounded-2xl border border-line bg-black/30 px-4 text-base text-paint outline-none transition-[border-color,box-shadow] focus:border-bead/70 focus:shadow-[0_0_0_4px_rgba(77,216,255,0.12)]"
        />
      </label>
      <label className="flex flex-col gap-2">
        <span className="text-sm font-medium text-mist">Anything we should know? (optional)</span>
        <textarea
          rows={3}
          value={note}
          onChange={(e) => setNote(e.target.value.slice(0, 500))}
          className="resize-none rounded-2xl border border-line bg-black/30 p-4 text-base text-paint outline-none transition-[border-color,box-shadow] focus:border-bead/70 focus:shadow-[0_0_0_4px_rgba(77,216,255,0.12)]"
        />
      </label>
      <Turnstile onToken={setToken} />
      {error && (
        <p role="alert" className="rounded-2xl border border-danger/30 bg-danger/10 p-3.5 text-sm text-[#ffb3b3]">
          {error}
        </p>
      )}
      <button
        type="submit"
        disabled={state === "sending"}
        className="h-[52px] rounded-[18px] border border-danger/40 bg-danger/10 font-semibold text-[#ffc2c2] transition-colors hover:bg-danger/[0.16] active:scale-[0.98] disabled:opacity-50"
      >
        {state === "sending" ? "Sending…" : "Request account deletion"}
      </button>
    </form>
  );
}
