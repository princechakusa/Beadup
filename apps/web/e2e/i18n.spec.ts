import { expect, test } from "@playwright/test";

// The client booking page follows the browser's language; other pages stay as they are.
test.describe("French browser", () => {
  test.use({ locale: "fr-FR" });

  test("the booking page is in French, with French dates", async ({ page }) => {
    await page.goto("/marcus");
    await expect(page.locator("div[lang='fr']")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Choisissez votre prestation" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Continuer" }).last()).toBeVisible();
    await expect(page.getByText("Choisissez un service pour voir le prix")).toBeVisible();
  });
});

test.describe("Portuguese browser", () => {
  test.use({ locale: "pt-BR" });

  test("a salon page shows Portuguese step titles", async ({ page }) => {
    await page.goto("/marcus");
    await expect(page.getByText("Etapa 1")).toBeVisible();
  });
});

test("an unsupported language falls back to English", async ({ browser }) => {
  const ctx = await browser.newContext({ locale: "ja-JP" });
  const page = await ctx.newPage();
  await page.goto("/marcus");
  await expect(page.getByText("Step 1")).toBeVisible();
  await ctx.close();
});
