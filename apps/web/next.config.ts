import type { NextConfig } from "next";
import { STATIC_CSP } from "./src/lib/csp";

// Security headers for every response. HTML pages get their CSP (with a
// per-request nonce) from src/proxy.ts; everything the proxy skips (static
// files, images, API routes) gets the locked-down STATIC_CSP below, so no
// response has two policies.
// accelerometer/gyroscope stay available to our own pages only: the glass bead
// reacts to phone tilt (deviceorientation).
const securityHeaders = [
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value:
      "accelerometer=(self), bluetooth=(), camera=(), display-capture=(), encrypted-media=(), geolocation=(), gyroscope=(self), hid=(), magnetometer=(), microphone=(), midi=(), payment=(self), publickey-credentials-get=(), screen-wake-lock=(), serial=(), usb=(), xr-spatial-tracking=(), browsing-topics=()",
  },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  { key: "Cross-Origin-Resource-Policy", value: "same-origin" },
  { key: "X-Permitted-Cross-Domain-Policies", value: "none" },
  { key: "Origin-Agent-Cluster", value: "?1" },
];

const staticCsp = [{ key: "Content-Security-Policy", value: STATIC_CSP }];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      // Exactly the paths src/proxy.ts does not match.
      { source: "/_next/:path*", headers: staticCsp },
      { source: "/api/:path*", headers: staticCsp },
      { source: "/:path*/:file([^/]+\\.[a-zA-Z0-9]+)", headers: staticCsp },
      { source: "/:file([^/]+\\.[a-zA-Z0-9]+)", headers: staticCsp },
    ];
  },
};

export default nextConfig;
