export function listTimezones(): string[] {
  const sof = (
    Intl as unknown as { supportedValuesOf?: (k: string) => string[] }
  ).supportedValuesOf;
  if (typeof sof === "function") {
    try {
      return sof("timeZone");
    } catch {
      // fall through to a small default set
    }
  }
  return [
    "UTC",
    "Europe/Oslo",
    "Europe/London",
    "America/New_York",
    "America/Los_Angeles",
    "Asia/Tokyo",
  ];
}

export function browserTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

export function tzOffsetLabel(tz: string): string {
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      timeZoneName: "shortOffset",
    }).formatToParts(new Date());
    const name = parts.find((p) => p.type === "timeZoneName")?.value;
    return name ?? "";
  } catch {
    return "";
  }
}

const ISO = (d: Date): string =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate(),
  ).padStart(2, "0")}`;

// Hoisted: building Intl.DateTimeFormat is expensive; these are reused across
// renders (the grid re-renders on every paint frame during a drag).
const WEEKDAY_DAY_FMT = new Intl.DateTimeFormat("en-US", {
  weekday: "short",
  day: "numeric",
});
const WEEKDAY_FMT = new Intl.DateTimeFormat("en-US", { weekday: "short" });
const DAY_FMT = new Intl.DateTimeFormat("en-US", { day: "numeric" });
const RANGE_FMT = new Intl.DateTimeFormat("en-US", {
  weekday: "short",
  month: "short",
  day: "numeric",
});

export interface DayOption {
  iso: string;
  label: string;
}

export function upcomingDays(count: number, start = new Date()): DayOption[] {
  const out: DayOption[] = [];
  for (let i = 0; i < count; i++) {
    const d = new Date(
      start.getFullYear(),
      start.getMonth(),
      start.getDate() + i,
    );
    out.push({ iso: ISO(d), label: WEEKDAY_DAY_FMT.format(d) });
  }
  return out;
}

// Slot-grid helpers live in @samkoma/core (shared with the API). Re-exported so
// the rest of the web app keeps importing them from this datetime module.
export { timeSlots, slotKey } from "@samkoma/core";

// Label shown in the time gutter — only on the hour, e.g. "9am", "12pm".
export function hourLabel(time: string): string {
  const [h, m] = time.split(":").map(Number);
  if (m !== 0) return "";
  const ampm = h >= 12 ? "pm" : "am";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}${ampm}`;
}

export function dayHeader(iso: string): { weekday: string; day: string } {
  const d = new Date(`${iso}T00:00:00`);
  return { weekday: WEEKDAY_FMT.format(d), day: DAY_FMT.format(d) };
}

// "2026-07-16T12:00" -> "Wed 16, 12:00"
export function formatSlotLabel(key: string): string {
  const [day, time] = key.split("T");
  const h = dayHeader(day);
  return `${h.weekday} ${h.day}, ${time}`;
}

export function formatDayRange(days: string[]): string {
  if (days.length === 0) return "No days yet";
  const sorted = [...days].sort();
  const label = (iso: string) => RANGE_FMT.format(new Date(`${iso}T00:00:00`));
  if (sorted.length === 1) return label(sorted[0]);
  return `${label(sorted[0])} – ${label(sorted[sorted.length - 1])} · ${sorted.length} days`;
}
