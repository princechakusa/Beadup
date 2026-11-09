/**
 * A one-event iCalendar file (RFC 5545) for "Add to calendar" on the booking
 * confirmation. Built in the browser and downloaded as a Blob, so nothing
 * (time, address) goes into a URL or to a third party.
 */
export type CalendarEvent = {
  /** Stable id, e.g. the booking id or handle+slot. */
  uid: string;
  title: string;
  /** Wall-clock start in the detailer's timezone: "YYYY-MM-DD" + "HH:MM". */
  date: string;
  time: string;
  timezone: string;
  durationMin: number;
  location?: string;
  description?: string;
};

const pad = (n: number) => String(n).padStart(2, "0");

/** RFC 5545 text escaping, then line folding at 75 octets (approximated as chars). */
function text(v: string) {
  return v.replace(/\\/g, "\\\\").replace(/\r?\n/g, "\\n").replace(/([,;])/g, "\\$1");
}
function fold(line: string) {
  const out: string[] = [];
  for (let i = 0; i < line.length; i += 73) out.push((i ? " " : "") + line.slice(i, i + 73));
  return out.join("\r\n");
}

/** Adds minutes to a wall-clock date/time without any timezone conversion. */
function localStamp(date: string, time: string, addMin = 0) {
  const [y, m, d] = date.split("-").map(Number);
  const [hh, mm] = time.split(":").map(Number);
  const t = new Date(Date.UTC(y, m - 1, d, hh, mm + addMin));
  return `${t.getUTCFullYear()}${pad(t.getUTCMonth() + 1)}${pad(t.getUTCDate())}T${pad(t.getUTCHours())}${pad(t.getUTCMinutes())}00`;
}

export function buildIcs(e: CalendarEvent, now = new Date()): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(e.date) || !/^\d{2}:\d{2}$/.test(e.time)) throw new Error("bad date/time");
  const stamp = now.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const tz = e.timezone.replace(/[^A-Za-z0-9_/+-]/g, "");
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Beadup//Booking//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${text(e.uid)}@beadup`,
    `DTSTAMP:${stamp}`,
    `DTSTART;TZID=${tz}:${localStamp(e.date, e.time)}`,
    `DTEND;TZID=${tz}:${localStamp(e.date, e.time, Math.max(15, e.durationMin))}`,
    `SUMMARY:${text(e.title)}`,
    e.location ? `LOCATION:${text(e.location)}` : null,
    e.description ? `DESCRIPTION:${text(e.description)}` : null,
    "BEGIN:VALARM",
    "TRIGGER:-PT2H",
    "ACTION:DISPLAY",
    `DESCRIPTION:${text(e.title)}`,
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR",
  ].filter((l): l is string => l !== null);
  return lines.map(fold).join("\r\n") + "\r\n";
}

/** Converts a UTC instant to the wall-clock date and time in `timeZone`. */
export function wallClock(iso: string, timeZone: string): { date: string; time: string } {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" })
      .formatToParts(new Date(iso))
      .map((p) => [p.type, p.value]),
  );
  return { date: `${parts.year}-${parts.month}-${parts.day}`, time: `${parts.hour}:${parts.minute}` };
}
