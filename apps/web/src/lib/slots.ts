import type { Detailer } from "./booking-types";

/** A day on the booking page with the start times a client can still pick. */
export type OpenDay = { key: string; dow: string; day: number; label: string; slots: string[] };

type Busy = Detailer["busy"][number];

const pad = (n: number) => n.toString().padStart(2, "0");

/** Minutes since 1970 for a detailer-local "YYYY-MM-DD" + "HH:MM" (wall clock, no zone). */
function wallMinutes(date: string, hhmm: string): number {
  const [y, m, d] = date.split("-").map(Number);
  const [h, min] = hhmm.split(":").map(Number);
  return Date.UTC(y, m - 1, d, h, min) / 60_000;
}

/** Today's date and the current minute of the day in `timeZone`. */
export function localNow(now: Date, timeZone: string): { date: string; minute: number } {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(now)
      .map((p) => [p.type, p.value]),
  );
  return { date: `${parts.year}-${parts.month}-${parts.day}`, minute: Number(parts.hour) * 60 + Number(parts.minute) };
}

/**
 * The next `count` days with open start times, in the detailer's time zone
 * (never the visitor's), up to 21 days ahead like the server. A start time is
 * open when a job of `durationMin` starting then, with the detailer's travel
 * buffer on both sides, overlaps no busy booking, and it is at least an hour
 * away. The server checks all of this again; this only hides what would fail.
 */
export function openDays(opts: {
  weeklySlots: Detailer["weeklySlots"];
  busy: readonly Busy[];
  bufferMin: number;
  durationMin: number;
  timeZone: string;
  now: Date;
  count: number;
  /** Exact "YYYY-MM-DD HH:MM" starts to hide (lost to someone else during this visit). */
  exclude?: ReadonlySet<string>;
}): OpenDay[] {
  const { date: today, minute } = localNow(opts.now, opts.timeZone);
  const nowWall = wallMinutes(today, `${pad(Math.floor(minute / 60))}:${pad(minute % 60)}`);
  const ranges = opts.busy.map((b) => {
    const [date, time] = b.start.split(" ");
    const start = wallMinutes(date, time);
    return { start, end: start + b.minutes };
  });
  const [y, m, d] = today.split("-").map(Number);
  const out: OpenDay[] = [];
  // From tomorrow, as before (the server would also accept later today).
  for (let i = 1; i <= 21 && out.length < opts.count; i++) {
    const day = new Date(Date.UTC(y, m - 1, d + i));
    const key = `${day.getUTCFullYear()}-${pad(day.getUTCMonth() + 1)}-${pad(day.getUTCDate())}`;
    const slots = (opts.weeklySlots[String(day.getUTCDay()) as keyof Detailer["weeklySlots"]] ?? []).filter((s) => {
      if (opts.exclude?.has(`${key} ${s}`)) return false;
      const start = wallMinutes(key, s);
      if (start < nowWall + 60) return false;
      const end = start + opts.durationMin;
      return !ranges.some((r) => start < r.end + opts.bufferMin && r.start < end + opts.bufferMin);
    });
    if (slots.length === 0) continue;
    out.push({
      key,
      slots,
      dow: day.toLocaleDateString("en-US", { weekday: "short", timeZone: "UTC" }),
      day: day.getUTCDate(),
      label: day.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric", timeZone: "UTC" }),
    });
  }
  return out;
}
