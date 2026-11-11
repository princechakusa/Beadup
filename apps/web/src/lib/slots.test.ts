import { describe, expect, it } from "vitest";
import { localNow, openDays } from "./slots";

// Every day 08:00, 09:00 ... 17:00.
const hours = Array.from({ length: 10 }, (_, i) => `${String(8 + i).padStart(2, "0")}:00`);
const weeklySlots = Object.fromEntries(["0", "1", "2", "3", "4", "5", "6"].map((d) => [d, hours]));

// Monday 2026-11-16 15:00 UTC.
const now = new Date("2026-11-16T15:00:00Z");
const base = { weeklySlots, busy: [], bufferMin: 0, durationMin: 60, timeZone: "UTC", now, count: 30 };

describe("openDays", () => {
  it("starts tomorrow in the detailer's zone and stops 21 days out", () => {
    const days = openDays(base);
    expect(days[0].key).toBe("2026-11-17");
    expect(days.at(-1)!.key).toBe("2026-12-07");
    expect(days).toHaveLength(21);
  });

  it("counts days in the detailer's zone, not the visitor's", () => {
    // 15:00 UTC is already Tuesday 04:00 in Auckland, so Auckland's tomorrow is Wednesday.
    expect(openDays({ ...base, timeZone: "Pacific/Auckland" })[0].key).toBe("2026-11-18");
    // And still Monday in Los Angeles.
    expect(openDays({ ...base, timeZone: "America/Los_Angeles" })[0].key).toBe("2026-11-17");
  });

  it("labels the date itself, whatever zone the browser is in", () => {
    const [first] = openDays(base);
    expect(first.label).toBe("Tuesday, Nov 17");
    expect(first.dow).toBe("Tue");
    expect(first.day).toBe(17);
  });

  it("hides every start time inside a long job, not only its start", () => {
    const busy = [{ start: "2026-11-17 08:00", minutes: 360 }];
    const [tue] = openDays({ ...base, busy });
    expect(tue.slots).toEqual(["14:00", "15:00", "16:00", "17:00"]);
  });

  it("hides start times whose own job would run into a later booking", () => {
    const busy = [{ start: "2026-11-17 12:00", minutes: 60 }];
    const [tue] = openDays({ ...base, busy, durationMin: 180 });
    // 09:00 + 3 h ends at 12:00 exactly: fine. 10:00 and 11:00 would overlap.
    expect(tue.slots).toEqual(["08:00", "09:00", "13:00", "14:00", "15:00", "16:00", "17:00"]);
  });

  it("keeps the travel buffer free on both sides", () => {
    const busy = [{ start: "2026-11-17 12:00", minutes: 60 }];
    const [tue] = openDays({ ...base, busy, bufferMin: 30 });
    expect(tue.slots).toEqual(["08:00", "09:00", "10:00", "14:00", "15:00", "16:00", "17:00"]);
  });

  it("drops a day with nothing left and honours exact exclusions", () => {
    const busy = [{ start: "2026-11-17 06:00", minutes: 720 }];
    const days = openDays({ ...base, busy, exclude: new Set(["2026-11-18 08:00"]) });
    expect(days[0].key).toBe("2026-11-18");
    expect(days[0].slots[0]).toBe("09:00");
  });

  it("stops at count", () => {
    expect(openDays({ ...base, count: 7 })).toHaveLength(7);
  });
});

describe("localNow", () => {
  it("reads the wall clock in a zone", () => {
    expect(localNow(now, "Asia/Dubai")).toEqual({ date: "2026-11-16", minute: 19 * 60 });
    expect(localNow(now, "Pacific/Auckland")).toEqual({ date: "2026-11-17", minute: 4 * 60 });
  });
});

describe("openDays with days off", () => {
  it("skips the detailer's days off entirely", () => {
    const days = openDays({ ...base, count: 2, daysOff: ["2026-11-17"] });
    expect(days.map((d) => d.key)).toEqual(["2026-11-18", "2026-11-19"]);
  });
});
