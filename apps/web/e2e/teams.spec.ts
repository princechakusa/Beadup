import { expect, test } from "@playwright/test";
import { continueButton, sql } from "./helpers";

// A salon with two stylists: the client can choose a person or "Anyone".
const TEAM = "e2e7ea40-0000-4000-8000-000000000000";

test.beforeAll(() => {
  sql(`
    delete from auth.users where id = '${TEAM}';
    insert into auth.users (instance_id, id, aud, role, email, encrypted_password, created_at, updated_at)
      values ('00000000-0000-0000-0000-000000000000', '${TEAM}', 'authenticated', 'authenticated', 'e2e-team@test.local', '', now(), now());
    insert into public.detailers (id, handle, business_name, timezone, is_published, trade, visit_mode, service_area, contact_phone)
      values ('${TEAM}', 'e2e-team', 'Duo Hair Studio', 'Africa/Johannesburg', true, 'hair_salon', 'studio', 'Sandton', '+27821234567');
    insert into public.detailer_accounts (detailer_id, plan) values ('${TEAM}', 'pro');
    insert into public.services (detailer_id, name, description, duration_min, price_sedan_cents, price_suv_cents, price_truck_cents, sort_order)
      values ('${TEAM}', 'Silk press', 'Wash, blow-dry, press', 90, 45000, 45000, 45000, 1);
    insert into public.availability_slots (detailer_id, weekday, start_time)
      select '${TEAM}', wd, '09:00' from generate_series(0, 6) wd;
    insert into public.staff_members (detailer_id, name, sort_order) values ('${TEAM}', 'Thandi', 1), ('${TEAM}', 'Lerato', 2);
  `);
});
test.afterAll(() => sql(`delete from auth.users where id = '${TEAM}'`));

test("a team page lets the client pick a person or anyone, and shows times for each", async ({ page }) => {
  await page.goto("/e2e-team");
  await page.getByRole("radio", { name: /Silk press/ }).click();
  await continueButton(page).click();
  await expect(page.getByRole("heading", { name: "Pick a time" })).toBeVisible();

  const who = page.getByRole("radiogroup", { name: "With" });
  await expect(who.getByRole("radio")).toHaveText(["Anyone", "Thandi", "Lerato"]);
  await expect(who.getByRole("radio", { name: "Anyone" })).toHaveAttribute("aria-checked", "true");

  await page.getByRole("radiogroup", { name: "Day" }).getByRole("radio").first().click();
  const times = page.getByRole("radiogroup", { name: "Time" }).getByRole("radio");
  await expect(times.first()).toBeVisible();

  // Choosing a person clears the picked time and still offers times.
  await who.getByRole("radio", { name: "Thandi" }).click();
  await expect(who.getByRole("radio", { name: "Thandi" })).toHaveAttribute("aria-checked", "true");
  await page.getByRole("radiogroup", { name: "Day" }).getByRole("radio").first().click();
  await expect(times.first()).toBeVisible();
});
