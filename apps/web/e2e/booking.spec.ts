import { expect, test } from "@playwright/test";
import { depositCents } from "../src/lib/pricing";
import { cleanup, fillBooking } from "./helpers";

test.afterAll(cleanup);

test("a client books, sees the price math and the detailer's deposit instructions", async ({ page }) => {
  await fillBooking(page, { dayIndex: 0, name: "E2E Booker", phone: "(512) 555-0142" });

  // Full detail, SUV ($210) + Odor treatment ($35) = $245; deposit 30% = $73.50.
  const deposit = depositCents(21000 + 3500);
  expect(deposit).toBe(7350);
  await expect(page.getByText("$245", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("$73.50", { exact: true }).first()).toBeVisible();
  // External payments: no booking fee and no card checkout.
  await expect(page.getByText("Booking fee")).toHaveCount(0);
  await expect(page.getByText(/pay the \$73\.50 deposit to Marcus Shine Co directly/)).toBeVisible();

  await page.getByRole("button", { name: "Book", exact: true }).click();
  await expect(page.getByRole("heading", { name: "You're booked" })).toBeVisible();
  await expect(page.getByText("Pay your deposit to Marcus Shine Co.")).toBeVisible();
  await expect(page.getByText("Zelle: (512) 555-0101")).toBeVisible();
});
