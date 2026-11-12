import { expect, test } from "@playwright/test";
import { TRADE_PAGES } from "../src/content/trade-pages";

test("every trade page renders with its own title, answer and FAQ markup", async ({ page, request }) => {
  for (const p of TRADE_PAGES) {
    const res = await page.goto(`/for/${p.slug}`);
    expect(res?.status(), p.slug).toBe(200);
    await expect(page.getByRole("heading", { level: 1, name: p.h1 })).toBeVisible();
    await expect(page).toHaveTitle(`${p.title} · Beadup`);
    await expect(page.locator('[itemtype="https://schema.org/FAQPage"]')).toHaveCount(1);
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", new RegExp(`/for/${p.slug}$`));
  }
  expect((await request.get("/for/no-such-trade")).status()).toBe(404);
});

test("the sitemap and llms.txt list the trade pages", async ({ request }) => {
  const sitemap = await (await request.get("/sitemap.xml")).text();
  for (const p of TRADE_PAGES) expect(sitemap).toContain(`/for/${p.slug}`);
  const llms = await (await request.get("/llms.txt")).text();
  expect(llms).toContain("hair salons");
  expect(llms).toContain("/for/barbers");
});

test("home page links every trade", async ({ page }) => {
  await page.goto("/");
  const trades = page.getByRole("region", { name: "Set up for your trade in one tap" });
  for (const p of TRADE_PAGES) await expect(trades.locator(`a[href="/for/${p.slug}"]`)).toHaveCount(1);
});
