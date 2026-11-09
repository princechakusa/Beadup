import { describe, expect, it } from "vitest";
import { bookingFeeCents, depositCents } from "./pricing";

describe("depositCents", () => {
  it("is 30% of the total (half-up on the last cent)", () => {
    expect(depositCents(0)).toBe(0);
    expect(depositCents(1)).toBe(0); // floor((1*3+5)/10) = 0
    expect(depositCents(5)).toBe(2); // half-up
    expect(depositCents(99)).toBe(30);
    expect(depositCents(6000)).toBe(1800);
    expect(depositCents(21000)).toBe(6300);
    expect(depositCents(999999)).toBe(300000);
  });
});

describe("bookingFeeCents", () => {
  it.each([0, 1, 5, 99, 6000, 21000, 999999])("returns a fee for a %i¢ deposit", (c) => {
    expect(bookingFeeCents(c)).toBeGreaterThanOrEqual(0);
  });

  it("does not charge a fee on zero", () => {
    expect(bookingFeeCents(0)).toBe(0);
  });

  it("covers 2.9% + 30¢ for a $63 deposit (matches the DB test)", () => {
    expect(bookingFeeCents(6300)).toBe(220);
  });

  it("matches the documented integer formula over the whole range", () => {
    // The intended invariant is fee === ceil((deposit + 30) / 0.971) - deposit,
    // written in exact integer/rational math (the same check as
    // supabase/tests/database/booking.test.sql). 0.971 is 971/1000, so
    // ceil((d + 30) / 0.971) = ceil(1000 * (d + 30) / 971), and
    // floor((N + 970) / 971) === ceil(N / 971), which is what bookingFeeCents
    // computes. The floor of values near integers is exact for these magnitudes.
    for (let c = 1; c <= 200000; c++) {
      const expected = Math.floor((1000 * (c + 30) + 970) / 971) - c;
      expect(bookingFeeCents(c)).toBe(expected);
    }
    // 200k expect() calls: ~2 s normally, slower on a busy machine or CI runner.
  }, 30_000);
});