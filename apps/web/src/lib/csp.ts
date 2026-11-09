/**
 * Content Security Policy for HTML documents.
 *
 * Every page is rendered per request (see `RequestTime` in app/layout.tsx), so
 * the proxy can give each response a fresh nonce. Next.js reads the nonce from
 * the request's CSP header and puts it on every inline script it emits.
 * No 'unsafe-inline' anywhere: inline <style>/<script> need the nonce, and the
 * markup never uses style="" attributes (see docs/SECURITY_REVIEW.md).
 */
import hashes from "./csp-hashes.json";

const TURNSTILE = "https://challenges.cloudflare.com";
const SHELL_SCRIPTS = hashes.script.map((h) => `'${h}'`).join(" ");

export function documentCsp(nonce: string, isDev = process.env.NODE_ENV !== "production"): string {
  return [
    "default-src 'none'",
    `script-src 'self' 'nonce-${nonce}' ${SHELL_SCRIPTS} ${TURNSTILE}${isDev ? " 'unsafe-eval'" : ""}`,
    // Dev only: the dev overlay injects un-nonced styles (a nonce would make
    // browsers ignore 'unsafe-inline', so dev uses 'unsafe-inline' alone).
    `style-src 'self' ${isDev ? "'unsafe-inline'" : `'nonce-${nonce}'`}`,
    "img-src 'self' data: blob:",
    "font-src 'self'",
    `connect-src 'self' ${TURNSTILE}${isDev ? " ws:" : ""}`,
    `frame-src ${TURNSTILE}`,
    "manifest-src 'self'",
    "media-src 'self'",
    "worker-src 'self' blob:",
    "frame-ancestors 'none'",
    "base-uri 'none'",
    "form-action 'self'",
    "object-src 'none'",
    ...(isDev ? [] : ["upgrade-insecure-requests"]),
  ].join("; ");
}

/** Policy for everything that is not an HTML page (API JSON, images, files). */
export const STATIC_CSP = "default-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'";

export function newNonce(): string {
  const bytes = new Uint8Array(18);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes));
}
