"use client";

import Script from "next/script";
import { useEffect, useRef, useState } from "react";

type TurnstileApi = {
  render: (el: HTMLElement, opts: Record<string, unknown>) => string;
  remove: (id: string) => void;
};
declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

const SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

/** True when bot protection is configured and a token is required. */
export const turnstileEnabled = Boolean(SITE_KEY);

/** Cloudflare Turnstile widget. Renders nothing when no site key is configured. */
export function Turnstile({ onToken }: { onToken: (token: string | null) => void }) {
  const box = useRef<HTMLDivElement>(null);
  const [loaded, setLoaded] = useState(() => typeof window !== "undefined" && !!window.turnstile);
  const cb = useRef(onToken);
  useEffect(() => {
    cb.current = onToken;
  }, [onToken]);

  useEffect(() => {
    if (!SITE_KEY || !loaded || !box.current || !window.turnstile) return;
    const id = window.turnstile.render(box.current, {
      sitekey: SITE_KEY,
      theme: "dark",
      appearance: "interaction-only",
      callback: (t: string) => cb.current(t),
      "expired-callback": () => cb.current(null),
      "error-callback": () => cb.current(null),
    });
    return () => window.turnstile?.remove(id);
  }, [loaded]);

  if (!SITE_KEY) return null;
  return (
    <>
      <Script
        src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"
        strategy="afterInteractive"
        onReady={() => setLoaded(true)}
      />
      <div ref={box} className="mt-4 flex justify-center" />
    </>
  );
}
