import { useSyncExternalStore } from "react";

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
