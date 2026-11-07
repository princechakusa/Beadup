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
      <div className="rounded-[24px] border border-mint/30 bg-mint/10 p-6">
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
      className="flex flex-col gap-4 rounded-[24px] border border-white/[0.08] bg-panel p-6"
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
        <span className="text-sm text-steel">Email address on the account</span>
        <input
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="h-12 rounded-2xl border border-line bg-white/[0.05] px-4 text-paint outline-none focus:border-bead/60"
        />
      </label>
      <label className="flex flex-col gap-2">
        <span className="text-sm text-steel">Anything we should know? (optional)</span>
        <textarea
          rows={3}
          value={note}
          onChange={(e) => setNote(e.target.value.slice(0, 500))}
          className="resize-none rounded-2xl border border-line bg-white/[0.05] p-4 text-paint outline-none focus:border-bead/60"
        />
      </label>
      <Turnstile onToken={setToken} />
      {error && (
        <p role="alert" className="text-sm text-[#ffb3b3]">
          {error}
        </p>
      )}
      <button
        type="submit"
        disabled={state === "sending"}
        className="h-12 rounded-full border border-[#ff8a8a]/40 bg-[#ff8a8a]/10 font-semibold text-[#ffb3b3] disabled:opacity-50"
      >
        {state === "sending" ? "Sending…" : "Request account deletion"}
      </button>
    </form>
  );
}
