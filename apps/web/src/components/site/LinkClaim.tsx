"use client";

import { useState } from "react";
import { IconCheck, IconLock } from "./Icons";

const RESERVED = new Set(["admin", "blog", "pricing", "privacy", "terms", "support", "api", "app", "beadup"]);

function toHandle(raw: string) {
  return raw
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-/, "")
    .slice(0, 24);
}

/** Type a name, watch your booking link appear. A preview only; the handle is claimed in the app. */
export function LinkClaim() {
  const [raw, setRaw] = useState("");
  const handle = toHandle(raw);
  const reserved = RESERVED.has(handle);
  const ready = handle.length >= 3 && !reserved;

  return (
    <div className="flex flex-col gap-3">
      <label htmlFor="link-claim" className="text-[13px] font-medium text-steel">
        Try your name
      </label>
      <div className="flex items-center gap-2 rounded-2xl border border-white/[0.1] bg-black/30 px-4 py-2.5 font-mono text-[14px] text-mist transition-[border-color,box-shadow] duration-300 focus-within:border-bead/50 focus-within:shadow-[0_0_0_4px_rgba(77,216,255,0.12)]">
        <IconLock size={15} className="shrink-0 text-mint" />
        <span className="shrink-0 select-none">beadup.app/</span>
        <input
          id="link-claim"
          value={raw}
          onChange={(e) => setRaw(e.target.value)}
          placeholder="yourname"
          autoComplete="off"
          autoCapitalize="none"
          spellCheck={false}
          maxLength={30}
          className="min-w-0 flex-1 bg-transparent font-mono text-bead placeholder:text-steel/60 focus:outline-none"
        />
      </div>
      <p className={`flex min-h-5 items-center gap-1.5 text-[13px] transition-colors ${ready ? "text-mint" : "text-steel"}`} aria-live="polite">
        {ready ? (
          <>
            <IconCheck size={15} /> Looks good. Claim it when you set up the app.
          </>
        ) : reserved ? (
          "That one is taken by Beadup itself."
        ) : (
          "Letters, numbers and dashes. Yours in under a minute."
        )}
      </p>
    </div>
  );
}
