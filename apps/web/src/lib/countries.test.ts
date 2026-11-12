import { describe, expect, it } from "vitest";
import { formatClock, formatMoney, formatPhone, formatWhen, toE164, whatsappUrl } from "./countries";

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

describe("formatPhone", () => {
  it("writes numbers the local way", () => {
    expect(formatPhone("+15125550101", "US")).toBe("(512) 555-0101");
    expect(formatPhone("+14165550101", "CA")).toBe("(416) 555-0101");
    expect(formatPhone("+447700900123", "GB")).toBe("07700 900123");
    expect(formatPhone("+61412345678", "AU")).toBe("0412 345 678");
    expect(formatPhone("+64211234567", "NZ")).toBe("021 123 4567");
    expect(formatPhone("+971501234567", "AE")).toBe("050 123 4567");
    expect(formatPhone("+27821234567", "ZA")).toBe("082 123 4567");
    expect(formatPhone("+6591234567", "SG")).toBe("9123 4567");
  });
  it("round-trips through toE164", () => {
    for (const [e164, c] of [["+447700900123", "GB"], ["+61412345678", "AU"], ["+971501234567", "AE"], ["+27821234567", "ZA"], ["+64211234567", "NZ"]] as const) {
      expect(toE164(formatPhone(e164, c), c)).toBe(e164);
    }
  });
  it("keeps foreign numbers international", () => {
    expect(formatPhone("+447700900123", "US")).toBe("+447700900123");
  });
});

describe("whatsappUrl", () => {
  it("uses digits only and encodes the message", () => {
    expect(whatsappUrl("+27821234567")).toBe("https://wa.me/27821234567");
    expect(whatsappUrl("+15125550101", "Hi, about booking AB12 & more")).toBe(
      "https://wa.me/15125550101?text=Hi%2C%20about%20booking%20AB12%20%26%20more",
    );
  });
});

describe("formatClock / formatWhen", () => {
  it("uses 24-hour time where people write it that way", () => {
    expect(formatClock("14:30", "US")).toBe("2:30 PM");
    expect(formatClock("09:05", "AU")).toBe("9:05 AM");
    expect(formatClock("14:30", "GB")).toBe("14:30");
    expect(formatClock("09:05", "ZA")).toBe("09:05");
  });
  it("writes the date and time in the business's zone", () => {
    expect(formatWhen("2026-11-17T12:30:00Z", "Africa/Johannesburg", "ZA")).toMatch(/17 Nov.*14:30$/);
    expect(formatWhen("2026-11-17T17:30:00Z", "America/Chicago", "US")).toMatch(/Nov 17.*11:30 AM$/);
  });
});
