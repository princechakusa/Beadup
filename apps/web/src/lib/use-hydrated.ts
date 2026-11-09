import { useState, useSyncExternalStore } from "react";

const noop = () => () => {};

/**
 * False during server rendering and hydration, true afterwards.
 *
 * The CSP has no 'unsafe-inline' for styles, so server HTML must not contain
 * style="" attributes. Motion writes its `initial` values as inline styles
 * during SSR; components pass animation start states only once hydrated
 * (after that, Motion sets styles through the CSSOM, which CSP allows).
 */
export function useHydrated(): boolean {
  return useSyncExternalStore(
    noop,
    () => true,
    () => false,
  );
}

/**
 * The page's CSP nonce, read from an inline script Next.js rendered with it
 * (browsers hide the attribute but keep the `nonce` property). Inline scripts
 * only: external <script src> tags in a cached prerendered shell can carry the
 * nonce of the request that generated the shell.
 *
 * Passed to <MotionConfig nonce> so Motion's popLayout <style> tag is allowed.
 * Read on the very first client render (Motion memoizes its config context
 * without the nonce); it is never rendered into the DOM, so the server's
 * `undefined` can't cause a hydration mismatch.
 */
export function useCspNonce(): string | undefined {
  const [nonce] = useState(() =>
    typeof document === "undefined"
      ? undefined
      : [...document.querySelectorAll<HTMLScriptElement>("script[nonce]:not([src])")].pop()?.nonce || undefined,
  );
  return nonce;
}
