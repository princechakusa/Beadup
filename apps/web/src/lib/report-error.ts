/** Sends a crash to /api/log (best effort, once per error). Browser only. */
const sent = new WeakSet<object>();

export function reportError(error: Error & { digest?: string }) {
  if (typeof window === "undefined" || sent.has(error)) return;
  sent.add(error);
  const body = JSON.stringify({
    source: "web",
    message: `${error.message}${error.digest ? ` (digest ${error.digest})` : ""}`,
    where: window.location.pathname,
    stack: error.stack ?? "",
  });
  try {
    if (!navigator.sendBeacon?.("/api/log", new Blob([body], { type: "application/json" }))) {
      void fetch("/api/log", { method: "POST", headers: { "content-type": "application/json" }, body, keepalive: true }).catch(() => {});
    }
  } catch {
    // never let reporting break the error page
  }
}
