import { expect, test } from "@playwright/test";
import { continueButton, sql } from "./helpers";

// A hair salon: one price per style, clients come to the salon, so no size step and no address.
const SALON = "e2e5a10a-0000-4000-8000-000000000000";

test.beforeAll(() => {
  sql(`
    delete from auth.users where id = '${SALON}';
    insert into auth.users (instance_id, id, aud, role, email, encrypted_password, created_at, updated_at)
      values ('00000000-0000-0000-0000-000000000000', '${SALON}', 'authenticated', 'authenticated', 'e2e-salon@test.local', '', now(), now());
    insert into public.detailers (id, handle, business_name, timezone, is_published, trade, visit_mode, service_area, contact_phone)
      values ('${SALON}', 'e2e-salon', 'Nandi Hair Studio', 'Africa/Johannesburg', true, 'hair_salon', 'studio', 'Rosebank, Johannesburg', '+27821234567');
    insert into public.detailer_accounts (detailer_id, plan) values ('${SALON}', 'pro');
    insert into public.services (detailer_id, name, description, duration_min, price_sedan_cents, price_suv_cents, price_truck_cents, sort_order) values
      ('${SALON}', 'Knotless braids', 'Medium length, waist', 240, 85000, 85000, 85000, 1),
      ('${SALON}', 'Silk press', 'Wash, blow-dry, press', 90, 45000, 45000, 45000, 2);
    insert into public.availability_slots (detailer_id, weekday, start_time)
      select '${SALON}', wd, '09:00' from generate_series(0, 6) wd;
  `);
});
test.afterAll(() => sql(`delete from auth.users where id = '${SALON}'`));

test("a salon booking: one price, no size step, no address, rands", async ({ page }) => {
  await page.goto("/e2e-salon");
  await expect(page.getByRole("heading", { name: "Choose your style" })).toBeVisible();
  // One price per style, in rands, never "from".
  await expect(page.getByRole("radio", { name: /Knotless braids/ })).toContainText("R");
  await expect(page.getByText(/^from /)).toHaveCount(0);

  await page.getByRole("radio", { name: /Knotless braids/ }).click();
  await continueButton(page).click();
  // No add-ons and no sizes: straight to the time.
  await expect(page.getByRole("heading", { name: "Pick a time" })).toBeVisible();
  await page.getByRole("radiogroup", { name: "Day" }).getByRole("radio").first().click();
  await page.getByRole("radiogroup", { name: "Time" }).getByRole("radio").first().click();
  await continueButton(page).click();

  // The client goes to the salon: no address asked.
  await expect(page.getByRole("heading", { name: "Your details" })).toBeVisible();
  await expect(page.getByLabel("Service address")).toHaveCount(0);
  await expect(page.getByText("You go to Nandi Hair Studio, Rosebank, Johannesburg")).toBeVisible();
  await page.getByLabel("Your name").fill("E2E Lerato");
  await page.getByLabel("Mobile number").fill("082 123 4500");
  await continueButton(page).click();

  await expect(page.getByRole("heading", { name: "Review and book" })).toBeVisible();
  await expect(page.getByText(/Sedan|SUV|Truck/)).toHaveCount(0);
  await page.getByRole("button", { name: "Book", exact: true }).click();
  await expect(page.getByRole("heading", { name: "You're booked" })).toBeVisible();
  expect(sql(`select address from public.bookings where detailer_id = '${SALON}'`)).toBe("At Nandi Hair Studio");

  // Back on step 1 the back button skips the hidden step too (checked on a fresh visit).
  await page.goto("/e2e-salon");
  await page.getByRole("radio", { name: /Silk press/ }).click();
  await continueButton(page).click();
  await page.getByRole("button", { name: "Back" }).click();
  await expect(page.getByRole("heading", { name: "Choose your style" })).toBeVisible();
});
