import { createHash } from "node:crypto";
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { cleanup, fillBooking, sql } from "./helpers";

// The client's private booking page, /b/<client_token>.
test.afterAll(cleanup);
test.beforeEach(cleanup);

/** Books through the real flow and returns the private page path from the confirmation. */
async function bookAndOpen(page: Page, name: string, phone: string): Promise<string> {
  await fillBooking(page, { dayIndex: 1, name, phone });
  await page.getByRole("button", { name: "Book", exact: true }).click();
  await expect(page.getByRole("heading", { name: "You're booked" })).toBeVisible();
  const open = page.getByRole("link", { name: "Open", exact: true });
  const path = (await open.getAttribute("href")) ?? "";
  expect(path).toMatch(/^\/b\/[0-9a-f]{48}$/);
  await open.click();
  await expect(page.getByRole("heading", { name: `Hi E2E` })).toBeVisible();
  return path;
}

const tokenOf = (path: string) => path.split("/").pop()!;

test("the client sees their booking, reports the deposit and asks for changes", async ({ page }) => {
  const path = await bookAndOpen(page, "E2E Selfserve", "(512) 555-0161");

  // Details, privately: first name only, no address or phone of the client.
  await expect(page.getByText("Confirmed", { exact: true })).toBeVisible();
  await expect(page.getByText("Full detail")).toBeVisible();
  await expect(page.getByText("Odor treatment")).toBeVisible();
  await expect(page.getByText("$73.50")).toBeVisible();
  await expect(page.getByText("Not paid yet")).toBeVisible();
  await expect(page.getByText("Barton Springs")).toHaveCount(0);
  await expect(page.getByText("555-0161")).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Call" })).toHaveAttribute("href", "tel:+15125550101");

  // The page itself must not leak the token to other sites, nor be indexed.
  const meta = await page.locator('meta[name="referrer"]').getAttribute("content");
  expect(meta).toBe("no-referrer");
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);

  // Deposit reported: shown as waiting, never as paid.
  await page.getByRole("button", { name: "I've sent the deposit" }).click();
  await expect(page.getByText("You said it's sent. Waiting for the detailer to confirm.")).toBeVisible();
  expect(sql(`select deposit_received_at is null and deposit_reported_at is not null from public.bookings where client_token = '${tokenOf(path)}'`)).toBe("t");

  // Ask for a new time.
  await page.getByRole("button", { name: "Ask for a new time" }).click();
  await page.getByRole("button", { name: /AM|PM/ }).first().click();
  await page.getByLabel("Note (optional)").fill("Mornings are best");
  await page.getByRole("button", { name: "Send request" }).click();
  await expect(page.getByText("You asked for a new time")).toBeVisible();
  await expect(page.getByText("“Mornings are best”")).toBeVisible();

  // Then ask to cancel instead: it replaces the open request. Nothing is cancelled yet.
  await page.getByRole("button", { name: "Ask to cancel" }).click();
  await page.getByRole("button", { name: "Send request" }).click();
  await expect(page.getByText("You asked to cancel")).toBeVisible();
  expect(
    sql(`select string_agg(r.kind || ':' || r.status, ',') || '|' || b.status from public.booking_requests r
           join public.bookings b on b.id = r.booking_id where b.client_token = '${tokenOf(path)}' group by b.status`),
  ).toBe("cancel:open|confirmed");

  // No horizontal scroll on a phone, and no serious accessibility issues.
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
  await page.waitForLoadState("networkidle");
  const { violations } = await new AxeBuilder({ page }).analyze();
  expect(violations.filter((v) => v.impact === "serious" || v.impact === "critical").map((v) => v.id)).toEqual([]);
});

test("cancelled and expired bookings, and bad links", async ({ page }) => {
  const path = await bookAndOpen(page, "E2E Lifecycle", "(512) 555-0162");
  const token = tokenOf(path);

  // The detailer cancels: the page says so and offers no changes.
  sql(`select public.cancel_booking((select id from public.bookings where client_token = '${token}'), 'detailer',
         (select detailer_id from public.bookings where client_token = '${token}'))`);
  await page.reload();
  await expect(page.getByText("Cancelled", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Ask for a new time" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "I've sent the deposit" })).toHaveCount(0);

  // 30 days after the appointment the link stops showing details.
  sql(`update public.bookings set starts_at = now() - interval '40 days' where client_token = '${token}'`);
  await page.reload();
  await expect(page.getByRole("heading", { name: "This link has expired" })).toBeVisible();
  await expect(page.getByText("Full detail")).toHaveCount(0);

  // Unknown and malformed tokens look the same.
  for (const bad of ["0".repeat(48), "not-a-token", `${token.slice(0, 47)}${token.endsWith("0") ? "1" : "0"}`]) {
    await page.goto(`/b/${bad}`);
    await expect(page.getByRole("heading", { name: "Link not found" })).toBeVisible();
  }
});

test("change requests are rate-limited per booking link", async ({ page }) => {
  const path = await bookAndOpen(page, "E2E Limits", "(512) 555-0163");
  const key = `client-change:tok:${createHash("sha256").update(tokenOf(path)).digest("hex").slice(0, 32)}`;
  // Use up this hour's allowance for the link, as many requests from many IPs would.
  sql(`insert into public.rate_limits (key, window_start, hits)
       values ('${key}', to_timestamp(floor(extract(epoch from now()) / 3600) * 3600), 6)`);
  await page.getByRole("button", { name: "Ask to cancel" }).click();
  await page.getByRole("button", { name: "Send request" }).click();
  await expect(page.getByText("Too many tries. Please wait a few minutes.")).toBeVisible();
  expect(sql(`select count(*) from public.booking_requests r join public.bookings b on b.id = r.booking_id where b.client_token = '${tokenOf(path)}'`)).toBe("0");
});
