"use client";

import "./globals.css";

// Replaces the root layout when it fails, so it brings its own <html>.
// Class names only: the CSP forbids inline styles.
export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body className="flex min-h-dvh items-center justify-center bg-midnight px-5 text-center text-paint">
        <main className="flex max-w-md flex-col items-center gap-5">
          <h1 className="text-4xl font-extrabold tracking-tight">Something went wrong</h1>
          <p className="text-lg text-mist">Beadup hit an unexpected error. Please try again in a moment.</p>
          <button type="button" onClick={reset} className="h-14 rounded-[18px] bg-bead px-6 font-bold text-bead-ink">
            Try again
          </button>
        </main>
      </body>
    </html>
  );
}
