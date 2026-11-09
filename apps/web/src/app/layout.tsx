import type { Metadata, Viewport } from "next";
import { Inter, Sora } from "next/font/google";
import { connection } from "next/server";
import { Suspense, type ReactNode } from "react";
import "./globals.css";

const inter = Inter({ variable: "--font-inter", subsets: ["latin"], display: "swap" });
const sora = Sora({ variable: "--font-sora", subsets: ["latin"], weight: ["600", "700", "800"], display: "swap" });

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
const DESCRIPTION =
  "Quote, book and get paid from your phone. AI photo quotes, a booking link your clients use without an app, and deposits that cut no-shows. Built for mobile car detailers.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: "Beadup", template: "%s · Beadup" },
  description: DESCRIPTION,
  applicationName: "Beadup",
  keywords: ["mobile detailing app", "car detailing booking", "detailing quotes", "auto detailer scheduling", "detailing deposits"],
  openGraph: {
    type: "website",
    siteName: "Beadup",
    locale: "en_US",
    title: "Beadup: quote, book and get paid as a mobile detailer",
    description: DESCRIPTION,
  },
  twitter: { card: "summary_large_image" },
  formatDetection: { telephone: false, email: false, address: false },
};

export const viewport: Viewport = {
  themeColor: "#0a0c10",
  colorScheme: "dark",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

/**
 * Renders the page at request time so every response carries a fresh CSP
 * nonce (src/proxy.ts). Data stays cached with "use cache", so this costs a
 * render, not database calls. The prerendered shell is just <html>/<head>/<body>.
 */
async function RequestTime({ children }: { children: ReactNode }) {
  await connection();
  return children;
}

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${inter.variable} ${sora.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">
        <Suspense>
          <RequestTime>{children}</RequestTime>
        </Suspense>
      </body>
    </html>
  );
}
