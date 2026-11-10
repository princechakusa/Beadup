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

describe("more countries (2026-11-10)", () => {
  it("reads New Zealand numbers", () => {
    expect(toE164("021 123 4567", "NZ")).toBe("+64211234567");
    expect(toE164("027 123456", "NZ")).toBe("+6427123456");
    expect(toE164("03 123 4567", "NZ")).toBe("+6431234567");
    expect(toE164("64 21 123 4567", "NZ")).toBe("+64211234567");
    expect(toE164("0123", "NZ")).toBeNull();
  });
  it("reads UAE numbers", () => {
    expect(toE164("050 123 4567", "AE")).toBe("+971501234567");
    expect(toE164("04 123 4567", "AE")).toBe("+97141234567");
    expect(toE164("971 50 123 4567", "AE")).toBe("+971501234567");
    expect(toE164("0012 3456", "AE")).toBeNull();
  });
  it("reads South African numbers", () => {
    expect(toE164("082 123 4567", "ZA")).toBe("+27821234567");
    expect(toE164("011 123 4567", "ZA")).toBe("+27111234567");
    expect(toE164("27 82 123 4567", "ZA")).toBe("+27821234567");
    expect(toE164("092 123 4567", "ZA")).toBeNull();
  });
  it("reads Singapore numbers", () => {
    expect(toE164("9123 4567", "SG")).toBe("+6591234567");
    expect(toE164("6123 4567", "SG")).toBe("+6561234567");
    expect(toE164("65 9123 4567", "SG")).toBe("+6591234567");
    expect(toE164("1123 4567", "SG")).toBeNull();
    expect(toE164("09123 4567", "SG")).toBeNull();
  });
  it("formats each currency", () => {
    expect(formatMoney(18000, "NZ")).toMatch(/\$180/);
    expect(formatMoney(45000, "AE")).toMatch(/AED\s?450/);
    expect(formatMoney(45000, "ZA")).toMatch(/R\s?450/);
    expect(formatMoney(18000, "SG")).toMatch(/\$180/);
  });
});
