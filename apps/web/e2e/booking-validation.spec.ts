import { expect, test } from "@playwright/test";
import { continueButton } from "./helpers";

test("details step rejects an empty name, a bad phone and a short address", async ({ page }) => {
  await page.goto("/marcus");
  await page.getByRole("radio", { name: /Express wash/ }).click();
  await continueButton(page).click();
  await page.getByRole("radiogroup", { name: "Your vehicle" }).getByRole("radio", { name: /Sedan/ }).click();
  await continueButton(page).click();
  await page.getByRole("radiogroup", { name: "Day" }).getByRole("radio").first().click();
  await page.getByRole("radiogroup", { name: "Time" }).getByRole("radio").first().click();
  await continueButton(page).click();
  const heading = page.getByRole("heading", { name: "Where's the vehicle?" });
  await expect(heading).toBeVisible();

  await page.getByLabel("Mobile number").fill("12345");
  await page.getByLabel("Service address").fill("abc");
  await continueButton(page).click();

  await expect(page.getByText("Enter your name")).toBeVisible();
  await expect(page.getByText("Enter a valid mobile number")).toBeVisible();
  await expect(page.getByText("Enter the address for the appointment")).toBeVisible();
  await expect(heading).toBeVisible();
});
