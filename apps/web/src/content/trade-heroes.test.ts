import { readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { TRADE_HERO_SLUGS } from "./trade-heroes";
import { TRADE_PAGES } from "./trade-pages";

describe("trade hero photos", () => {
  const files = readdirSync(join(process.cwd(), "public/hero/trades")).filter((f) => f.endsWith(".webp")).map((f) => f.replace(/\.webp$/, ""));

  it("the list matches the files, and every photo belongs to a trade page", () => {
    expect([...TRADE_HERO_SLUGS].sort()).toEqual(files.sort());
    const slugs = new Set(TRADE_PAGES.map((p) => p.slug));
    for (const f of files) expect(slugs.has(f), `${f}.webp has no trade page`).toBe(true);
  });
});
