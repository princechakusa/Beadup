import { describe, expect, it } from "vitest";
import { tierLabel, TRADE_IDS, TRADES, tradeOf } from "./trades";

describe("trades", () => {
  it("labels sizes per trade, and not at all for one-price trades", () => {
    expect(tierLabel("detailing", "suv")).toBe("SUV");
    expect(tierLabel("pet_grooming", "truck")).toBe("Large dog");
    expect(tierLabel("hair_salon", "sedan")).toBe("");
    expect(tierLabel("mechanic", "truck")).toBe("");
  });
  it("falls back to car detailing for unknown values", () => {
    expect(tradeOf("astrology")).toBe(TRADES.detailing);
    expect(tradeOf(undefined)).toBe(TRADES.detailing);
  });
  it("every trade is complete", () => {
    for (const id of TRADE_IDS) {
      const t = TRADES[id];
      expect(t.name && t.pickTitle && t.schemaType).toBeTruthy();
      if (t.pricing === "tiers") expect(t.tierTitle).not.toBe("");
    }
  });
});
