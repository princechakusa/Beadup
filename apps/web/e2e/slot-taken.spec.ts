import { expect, test } from "@playwright/test";
import { cleanup, continueButton, fillBooking } from "./helpers";

test.afterAll(cleanup);

test("a booked time disappears for the next client", async ({ page, browser }) => {
  const { day, time } = await fillBooking(page, { dayIndex: 1, name: "E2E First", phone: "(512) 555-0143" });
  await page.getByRole("button", { name: "Book", exact: true }).click();
  await expect(page.getByRole("heading", { name: "You're booked" })).toBeVisible();

  const other = await browser.newContext({ reducedMotion: "reduce" });
  const p2 = await other.newPage();
  await p2.goto("/marcus");
  await p2.getByRole("radio", { name: /Full detail/ }).click();
  await continueButton(p2).click();
  await continueButton(p2).click();
  await p2.getByRole("radiogroup", { name: "Day" }).getByRole("radio", { name: day, exact: true }).click();
  const times = p2.getByRole("radiogroup", { name: "Time" });
  await expect(times.getByRole("radio").first()).toBeVisible();
  await expect(times.getByRole("radio", { name: time, exact: true })).toHaveCount(0);
  await other.close();
});
