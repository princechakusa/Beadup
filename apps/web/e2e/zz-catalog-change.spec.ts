import { expect, test } from "@playwright/test";
import { cleanup, continueButton, fillBooking, MARCUS, sql } from "./helpers";

// A detailer changes their add-ons while a client is mid-booking: the client is told clearly and can book again.
// Named "zz-" so it runs last (files run in name order, one worker): it flips an add-on straight in the database,
// and the booking page's 60 s cache would hide that add-on from specs running after it. The next run starts with
// an empty cache (playwright.config.ts).
test.afterAll(() => {
  sql(`update public.add_ons set active = true where detailer_id = '${MARCUS}' and name = 'Odor treatment'`);
  cleanup();
});

test("a removed add-on mid-booking restarts the choice with a clear message", async ({ page }) => {
  cleanup();
  await fillBooking(page, { dayIndex: 2, name: "E2E Catalog", phone: "(512) 555-0171" });

  // The detailer switches the picked add-on off (no page refresh reaches this client).
  sql(`update public.add_ons set active = false where detailer_id = '${MARCUS}' and name = 'Odor treatment'`);
  await page.getByRole("button", { name: "Book", exact: true }).click();

  await expect(page.getByRole("alert").filter({ hasText: "just updated its services" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Pick your detail" })).toBeVisible();

  // The refreshed page no longer offers it, and booking without it works.
  await page.getByRole("radio", { name: /Full detail/ }).click();
  await continueButton(page).click();
  await expect(page.getByRole("checkbox", { name: /Odor treatment/ })).toHaveCount(0);
  await continueButton(page).click();
  await page.getByRole("radiogroup", { name: "Day" }).getByRole("radio").nth(2).click();
  await page.getByRole("radiogroup", { name: "Time" }).getByRole("radio").first().click();
  await continueButton(page).click();
  await expect(page.getByLabel("Your name")).toHaveValue("E2E Catalog"); // details were kept
  await continueButton(page).click();
  await page.getByRole("button", { name: "Book", exact: true }).click();
  await expect(page.getByRole("heading", { name: "You're booked" })).toBeVisible();
});

test("the estimate never uses a size the client didn't pick", async ({ page }) => {
  await page.goto("/marcus");
  await page.getByRole("radio", { name: /Express wash/ }).click();
  // Listed "from $60" (sedan): the bar says From $60, not the SUV price.
  await expect(page.getByText("From", { exact: true })).toBeVisible();
  await expect(page.getByText("$60", { exact: true }).last()).toBeVisible();
  await page.getByRole("button", { name: "Continue", exact: true }).last().click();
  // No size chosen yet: can't continue.
  await expect(page.getByRole("button", { name: "Continue", exact: true }).last()).toBeDisabled();
  await page.getByRole("radiogroup", { name: "Your vehicle" }).getByRole("radio", { name: /SUV/ }).click();
  await expect(page.getByText("Estimated total")).toBeVisible();
  await expect(page.getByRole("button", { name: "Continue", exact: true }).last()).toBeEnabled();
});
