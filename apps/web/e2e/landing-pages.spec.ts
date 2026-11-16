import { expect, test } from "@playwright/test";
import { LANDING_PAGES } from "../src/content/landing-pages";

test("each landing page has one h1, a comparison table, FAQ markup and its own meta tags", async ({ page }) => {
  for (const p of LANDING_PAGES) {
    const res = await page.goto(`/${p.slug}`);
    expect(res?.status(), p.slug).toBe(200);
    await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
    await expect(page).toHaveTitle(`${p.title} · Beadup`);
    await expect(page.locator('meta[name="description"]')).toHaveAttribute("content", p.description);
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", new RegExp(`/${p.slug}$`));
    await expect(page.locator('meta[property="og:title"]')).toHaveCount(1);
    await expect(page.locator('meta[name="twitter:title"]')).toHaveCount(1);
    await expect(page.locator("article table")).toHaveCount(1);
    await expect(page.locator('[itemtype="https://schema.org/FAQPage"]')).toHaveCount(1);
    await expect(page.locator('[itemtype="https://schema.org/SoftwareApplication"]')).toHaveCount(1);
  }
});

test("the sitemap and llms.txt list the landing pages", async ({ request }) => {
  const sitemap = await (await request.get("/sitemap.xml")).text();
  const llms = await (await request.get("/llms.txt")).text();
  for (const p of LANDING_PAGES) {
    expect(sitemap).toContain(`/${p.slug}`);
    expect(llms).toContain(`/${p.slug}`);
  }
  const robots = await (await request.get("/robots.txt")).text();
  expect(robots).toContain("sitemap.xml");
});

test("apple-app-site-association is a 404 until the Team ID is set, then JSON", async ({ request }) => {
  const res = await request.get("/.well-known/apple-app-site-association");
  if (res.status() === 404) return;
  expect(res.headers()["content-type"]).toContain("application/json");
  expect((await res.json()).applinks.details[0].appIDs[0]).toMatch(/^[A-Z0-9]{10}\.com\.beadup\.app$/);
});
