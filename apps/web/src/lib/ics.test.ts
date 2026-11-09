import { describe, expect, it } from "vitest";
import { buildIcs, wallClock } from "./ics";

const base = { uid: "b1", title: "Full detail with Marcus", date: "2026-11-20", time: "09:30", timezone: "America/Chicago", durationMin: 180 };

describe("buildIcs", () => {
  it("writes a valid single event in the detailer's timezone", () => {
    const ics = buildIcs(base, new Date("2026-11-09T12:00:00Z"));
    expect(ics.startsWith("BEGIN:VCALENDAR\r\n")).toBe(true);
    expect(ics).toContain("DTSTART;TZID=America/Chicago:20261120T093000");
    expect(ics).toContain("DTEND;TZID=America/Chicago:20261120T123000");
    expect(ics).toContain("DTSTAMP:20261109T120000Z");
    expect(ics.trimEnd().endsWith("END:VCALENDAR")).toBe(true);
  });

  it("rolls the end time past midnight", () => {
    expect(buildIcs({ ...base, time: "23:00", durationMin: 120 })).toContain("DTEND;TZID=America/Chicago:20261121T010000");
  });

  it("escapes commas, semicolons and newlines", () => {
    const ics = buildIcs({ ...base, location: "12 Oak St, Austin; TX\nGate code 4" });
    expect(ics).toContain("LOCATION:12 Oak St\\, Austin\\; TX\\nGate code 4");
  });

  it("folds long lines", () => {
    const ics = buildIcs({ ...base, description: "x".repeat(200) });
    for (const line of ics.split("\r\n")) expect(line.length).toBeLessThanOrEqual(75);
  });

  it("rejects malformed dates", () => {
    expect(() => buildIcs({ ...base, date: "20/11/2026" })).toThrow();
  });
});

describe("wallClock", () => {
  it("converts UTC to the detailer's local time", () => {
    expect(wallClock("2026-11-20T15:30:00Z", "America/Chicago")).toEqual({ date: "2026-11-20", time: "09:30" });
  });
});
