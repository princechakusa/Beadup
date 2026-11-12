import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { continueButton } from "./helpers";

async function seriousViolations(page: Page) {
  // Measure the settled page, not elements mid fade-in.
  await page.waitForLoadState("networkidle");
  await page.waitForFunction(
    () =>
      document.getAnimations().every((a) => a.playState !== "running") &&
      [...document.querySelectorAll<HTMLElement>("[style*='opacity']")].every((e) => getComputedStyle(e).opacity === "1" || e.closest("[aria-hidden='true']")),
  );
  const { violations } = await new AxeBuilder({ page }).analyze();
  return violations
    .filter((v) => v.impact === "serious" || v.impact === "critical")
    .map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).slice(0, 3).join(", ")}`);
}

for (const path of ["/", "/pricing", "/for", "/for/hair-salons", "/refund-policy"]) {
  test(`no serious accessibility issues on ${path}`, async ({ page }) => {
    await page.goto(path);
    expect(await seriousViolations(page)).toEqual([]);
  });
}

test("no serious accessibility issues on each booking step", async ({ page }) => {
  await page.goto("/marcus");
  expect(await seriousViolations(page), "service").toEqual([]);
  await page.getByRole("radio", { name: /Express wash/ }).click();
  await continueButton(page).click();
  expect(await seriousViolations(page), "vehicle").toEqual([]);
  await page.getByRole("radiogroup", { name: "Your vehicle" }).getByRole("radio", { name: /Sedan/ }).click();
  await continueButton(page).click();
  expect(await seriousViolations(page), "time").toEqual([]);
  await page.getByRole("radiogroup", { name: "Day" }).getByRole("radio").first().click();
  await page.getByRole("radiogroup", { name: "Time" }).getByRole("radio").first().click();
  await continueButton(page).click();
  expect(await seriousViolations(page), "details").toEqual([]);
});
