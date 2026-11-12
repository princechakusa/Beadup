import { expect, test } from "@playwright/test";
import { cleanup, continueButton, fillBooking, sql } from "./helpers";

test.afterAll(cleanup);

test("the directory lists published businesses, by trade", async ({ page, request }) => {
  await page.goto("/find");
  await expect(page.getByRole("heading", { level: 1, name: "Find and book a pro near you" })).toBeVisible();
  await expect(page.locator('a[href="/marcus"]')).toHaveCount(1);
  await page.goto("/find/car-detailers?q=austin");
  await expect(page.locator('a[href="/marcus"]')).toHaveCount(1);
  await page.goto("/find/barbers");
  await expect(page.getByText("No businesses match yet")).toBeVisible();
  expect((await request.get("/find/no-such-trade")).status()).toBe(404);
  // Leaving the directory hides the business (after the 5-minute cache, so check the database answer).
  expect(sql(`select public.get_directory('detailing', null, 'Marcus') @> '[{"handle":"marcus"}]'`)).toBe("t");
});

test("an email at booking queues the confirmation; details are remembered for next time", async ({ page }) => {
  cleanup();
  await fillBooking(page, { dayIndex: 4, name: "E2E Emailer", phone: "(512) 555-0191" });
  // Back to details to add the optional email, then book.
  await page.getByRole("button", { name: "Back" }).click();
  await page.getByLabel("Email (optional, for your confirmation and reminder)").fill("e2e-emailer@example.com");
  await continueButton(page).click();
  await page.getByRole("button", { name: "Book", exact: true }).click();
  await expect(page.getByRole("heading", { name: "You're booked" })).toBeVisible();
  await expect
    .poll(() => sql(`select string_agg(e.kind || ':' || e.status, ',') from public.client_emails e join public.bookings b on b.id = e.booking_id
                      join public.clients c on c.id = b.client_id where c.name = 'E2E Emailer'`))
    .toBe("confirmation:skipped"); // no Brevo key locally: recorded, not sent

  // Booking again from the same browser: name, phone and email are filled in.
  await page.goto("/marcus");
  await page.getByRole("radio", { name: /Express wash/ }).click();
  await continueButton(page).click();
  await page.getByRole("radiogroup", { name: "Your vehicle" }).getByRole("radio", { name: /Sedan/ }).click();
  await continueButton(page).click();
  await page.getByRole("radiogroup", { name: "Day" }).getByRole("radio").nth(5).click();
  await page.getByRole("radiogroup", { name: "Time" }).getByRole("radio").first().click();
  await continueButton(page).click();
  await expect(page.getByLabel("Your name")).toHaveValue("E2E Emailer");
  await expect(page.getByLabel("Email (optional, for your confirmation and reminder)")).toHaveValue("e2e-emailer@example.com");
});
