import { expect, test } from "@playwright/test";
import { cleanup, fillBooking, sql } from "./helpers";

test.afterAll(cleanup);

test("booking page offers WhatsApp with a written message", async ({ page }) => {
  await page.goto("/marcus");
  const wa = page.getByRole("link", { name: "WhatsApp" }).first();
  await expect(wa).toHaveAttribute("href", /^https:\/\/wa\.me\/15125550101\?text=Hi%20Marcus%20Shine%20Co/);
});

test("after the job the client gets a printable receipt with the rating", async ({ page }) => {
  cleanup();
  await fillBooking(page, { dayIndex: 3, name: "E2E Receipt Person", phone: "(512) 555-0181" });
  await page.getByRole("button", { name: "Book", exact: true }).click();
  await expect(page.getByRole("heading", { name: "You're booked" })).toBeVisible();

  // The detailer finishes the job and marks the deposit received.
  sql(`update public.bookings b set status = 'completed', deposit_received_at = now()
         from public.clients c where c.id = b.client_id and c.name = 'E2E Receipt Person'`);
  const token = sql(`select b.review_token from public.bookings b join public.clients c on c.id = b.client_id where c.name = 'E2E Receipt Person'`);

  await page.goto(`/r/${token}`);
  const receipt = page.getByRole("region", { name: "Receipt" });
  await expect(receipt.getByRole("heading", { name: "Marcus Shine Co." })).toBeVisible();
  await expect(receipt.getByText("For E2E")).toBeVisible();
  await expect(receipt.getByText("$245", { exact: true })).toBeVisible(); // total
  await expect(receipt.getByText("Deposit paid")).toBeVisible();
  await expect(receipt.getByText("$171.50", { exact: true })).toBeVisible(); // balance at the job
  await expect(receipt.getByRole("button", { name: "Print or save PDF" })).toBeVisible();
  // Private details stay off the receipt.
  await expect(page.getByText("Barton Springs")).toHaveCount(0);
  await expect(page.getByText("555-0181")).toHaveCount(0);
  // The rating is still on the same page.
  await expect(page.getByText(/rate|stars|How was/i).first()).toBeVisible();
  await expect(page.locator('meta[name="referrer"]')).toHaveAttribute("content", "no-referrer");
});

test("media links never reveal files of unknown or unpublished pages", async ({ request }) => {
  expect((await request.get("/api/media/marcus/avatar")).status()).toBe(404); // no photo yet
  expect((await request.get("/api/media/no-such-handle/avatar")).status()).toBe(404);
  expect((await request.get("/api/media/marcus/not-a-uuid")).status()).toBe(404);
});
