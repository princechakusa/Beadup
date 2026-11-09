import { describe, expect, it } from "vitest";
import { formatMoney, toE164 } from "./countries";

describe("toE164", () => {
  it("reads US and Canadian numbers", () => {
    expect(toE164("(512) 555-0101", "US")).toBe("+15125550101");
    expect(toE164("1 512 555 0101", "US")).toBe("+15125550101");
    expect(toE164("416-555-0101", "CA")).toBe("+14165550101");
    expect(toE164("555-0101", "US")).toBeNull();
    expect(toE164("(012) 555-0101", "US")).toBeNull();
  });

  it("reads UK numbers", () => {
    expect(toE164("07700 900123", "GB")).toBe("+447700900123");
    expect(toE164("020 7946 0018", "GB")).toBe("+442079460018");
    expect(toE164("44 7700 900123", "GB")).toBe("+447700900123");
    expect(toE164("7700 900123", "GB")).toBeNull();
  });

  it("reads Australian numbers", () => {
    expect(toE164("0412 345 678", "AU")).toBe("+61412345678");
    expect(toE164("(02) 9374 4000", "AU")).toBe("+61293744000");
    expect(toE164("61 412 345 678", "AU")).toBe("+61412345678");
    expect(toE164("0112 345 678", "AU")).toBeNull();
  });

  it("accepts any international number written with + or 00", () => {
    expect(toE164("+44 7700 900123", "US")).toBe("+447700900123");
    expect(toE164("0061 412 345 678", "GB")).toBe("+61412345678");
    expect(toE164("+0 123", "US")).toBeNull();
  });
});

describe("formatMoney", () => {
  it("uses the detailer's currency", () => {
    expect(formatMoney(18000, "US")).toBe("$180");
    expect(formatMoney(6050, "GB")).toBe("£60.50");
    expect(formatMoney(18000, "AU")).toBe("$180");
    expect(formatMoney(18000, "CA")).toBe("$180");
  });
});
