import { expect, test } from "@playwright/test";
import { cleanup, MARCUS, sql } from "./helpers";

test.afterAll(cleanup);

test("a client reviews a finished job once", async ({ page }) => {
  const token = sql(`
    with c as (
      insert into public.clients (detailer_id, name, phone) values ('${MARCUS}', 'E2E Reviewer', '+15125550144') returning id
    )
    insert into public.bookings (detailer_id, client_id, service_name, vehicle_size, starts_at, duration_min, address,
                                 subtotal_cents, deposit_cents, status, completed_at)
    select '${MARCUS}', c.id, 'Full detail', 'sedan', now() - interval '5 hours', 180, '1 Main St', 18000, 5400,
           'completed', now() - interval '2 hours' from c
    returning review_token;`).split("\n")[0];
  expect(token).toMatch(/^[0-9a-f]{48}$/);

  await page.goto(`/r/${token}`);
  await page.getByRole("radio", { name: "5 stars" }).click();
  await page.getByRole("textbox").fill("Car looks brand new.");
  await page.getByRole("button", { name: "Send review" }).click();
  await expect(page.getByRole("heading", { name: /Thank you|Thanks for your review/ })).toBeVisible();
  expect(sql(`select rating || ' ' || body from public.reviews r join public.bookings b on b.id = r.booking_id where b.review_token = '${token}';`)).toBe(
    "5 Car looks brand new.",
  );

  // The link only works once.
  await page.reload();
  await expect(page.getByRole("heading", { name: "Thanks for your review" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Send review" })).toHaveCount(0);
});
