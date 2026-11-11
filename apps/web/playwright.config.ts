import { defineConfig, devices } from "@playwright/test";

// End-to-end tests for the client booking flow (CLAUDE.md M8).
// Needs the local Supabase stack with the seed (`npx supabase start` +
// `npx supabase db reset` from the repo root). Runs against `next dev` because
// production builds refuse bookings unless a payment path is configured.
const PORT = 3100;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1, // specs share the seeded detailer's calendar
  retries: 0,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  timeout: 60_000,
  expect: { timeout: 15_000 },
  use: {
    baseURL: `http://localhost:${PORT}`,
    ...devices["Pixel 7"],
    contextOptions: { reducedMotion: "reduce" },
    trace: "retain-on-failure",
  },
  webServer: {
    // Start from an empty data cache: `supabase db reset` re-creates the seed with new ids, and a cached booking
    // page from before the reset would offer add-ons that no longer exist.
    command: `node -e "require('fs').rmSync('.next/cache', { recursive: true, force: true })" && npx next dev -p ${PORT}`,
    url: `http://localhost:${PORT}/pricing`,
    timeout: 180_000,
    reuseExistingServer: !process.env.CI,
    env: {
      // No bot check in tests (the code skips Turnstile outside production when unset).
      TURNSTILE_SECRET_KEY: "",
      NEXT_PUBLIC_TURNSTILE_SITE_KEY: "",
    },
  },
});
