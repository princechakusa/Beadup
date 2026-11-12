import type { MetadataRoute } from "next";

/**
 * Installable web app (Add to Home Screen). Clients can keep a detailer's
 * booking page or their own booking page on their home screen, and Android
 * users get an app-like Beadup until the Android app ships.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Beadup",
    short_name: "Beadup",
    description: "Book a mobile car detailer in under a minute. No app or account needed.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#0A0C10",
    theme_color: "#0A0C10",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
