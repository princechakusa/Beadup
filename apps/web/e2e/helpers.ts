import { execFileSync } from "node:child_process";
import { expect, type Page } from "@playwright/test";

/** Runs SQL in the local Supabase database (docker container from `supabase start`). */
export function sql(query: string): string {
  return execFileSync(
    "docker",
    ["exec", "-i", process.env.SUPABASE_DB_CONTAINER ?? "supabase_db_beadup", "psql", "-U", "postgres", "-d", "postgres", "-tA", "-q", "-v", "ON_ERROR_STOP=1"],
    { input: query, encoding: "utf8" },
  ).trim();
}

export const MARCUS = "11111111-1111-4111-8111-111111111111";

/** Removes everything the tests created (clients are named "E2E ...") and resets rate limits. */
export function cleanup(): void {
  sql(`
    delete from public.reviews where booking_id in (select b.id from public.bookings b join public.clients c on c.id = b.client_id where c.name like 'E2E %');
    delete from public.bookings where client_id in (select id from public.clients where name like 'E2E %');
    delete from public.clients where name like 'E2E %';
    delete from public.rate_limits where key like 'book:%' or key like 'review:%' or key like 'client-%' or key like 'deposit-sent:%';
  `);
}

export type BookingChoice = { dayIndex: number; name: string; phone: string };

/** The sticky Continue button (the details form also has a hidden submit named Continue). */
export const continueButton = (page: Page) => page.getByRole("button", { name: "Continue", exact: true }).last();

/** Walks the booking flow up to the review step; returns the picked day label and time. */
export async function fillBooking(page: Page, c: BookingChoice): Promise<{ day: string; time: string }> {
  await page.goto("/marcus");
  await page.getByRole("radio", { name: /Full detail/ }).click();
  await continueButton(page).click();

  await page.getByRole("radiogroup", { name: "Your vehicle" }).getByRole("radio", { name: /SUV/ }).click();
  await page.getByRole("checkbox", { name: /Odor treatment/ }).click();
  await continueButton(page).click();

  const day = page.getByRole("radiogroup", { name: "Day" }).getByRole("radio").nth(c.dayIndex);
  await day.click();
  const dayLabel = (await day.getAttribute("aria-label")) ?? "";
  const time = page.getByRole("radiogroup", { name: "Time" }).getByRole("radio").first();
  const timeLabel = (await time.textContent())?.trim() ?? "";
  await time.click();
  await continueButton(page).click();

  await page.getByLabel("Your name").fill(c.name);
  await page.getByLabel("Mobile number").fill(c.phone);
  await page.getByLabel("Service address").fill("1200 Barton Springs Rd, Austin, TX");
  await continueButton(page).click();
  await expect(page.getByRole("heading", { name: "Review and book" })).toBeVisible();
  return { day: dayLabel, time: timeLabel };
}
