import { expect, test } from "@playwright/test";
import { sql } from "./helpers";

test("site pages answer 200 and unknown handles a real 404", async ({ request }) => {
  for (const path of ["/", "/pricing", "/privacy", "/terms", "/support", "/delete-account", "/marcus"]) {
    expect((await request.get(path)).status(), path).toBe(200);
  }
  expect((await request.get("/some-unknown-handle")).status()).toBe(404);
});

test("pricing shows the free booking limit from the database", async ({ page }) => {
  const limit = sql("select public.get_public_config() ->> 'free_bookings_per_month';");
  expect(Number(limit)).toBeGreaterThan(0);
  await page.goto("/pricing");
  await expect(page.getByText(new RegExp(`\\b${limit} bookings`)).first()).toBeVisible();
});
