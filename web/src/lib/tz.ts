import {
  timeSlots,
  localizedDateFormat,
  formatDayLabel,
  formatTime,
} from "./datetime";
import { zonedTimeToUtc, partsInTz, existsInTz } from "@samkoma/core";

// DST-aware tz conversion is shared domain logic; it lives in @samkoma/core
// (also used by the .ics export) and is re-exported here so the rest of the web
// app keeps importing it from this module.
export { zonedTimeToUtc, partsInTz, existsInTz };

export type PollKind = "dates" | "weekdays";

const WEEKDAY_ORDER = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
const WEEKDAY_SHORT: Intl.DateTimeFormatOptions = { weekday: "short" };

// "mon" -> "Mon" / "man." in the viewer's locale. 2024-01-01 was a Monday.
export function weekdayLabel(token: string): string {
  const i = WEEKDAY_ORDER.indexOf(token);
  return i < 0
    ? token
    : localizedDateFormat(WEEKDAY_SHORT).format(new Date(2024, 0, 1 + i));
}

function dateLabel(iso: string): string {
  return formatDayLabel(iso);
}

export interface GridView {
  days: string[]; // column keys (viewer-local ISO dates, or weekday tokens)
  times: string[]; // viewer-local HH:MM
  dayLabels: string[]; // header label per column, parallel to `days`
  keyAt: (day: string, time: string) => string | null; // canonical slot key, or gap
}

// Build the grid as the viewer sees it. For dated polls, canonical slot keys
// (in the poll's timezone) are converted to the viewer's local day/time, so two
// people in different zones who pick the same absolute time land on the same
// slot. Weekday polls are timezone-naive: everyone uses the poll's home tz.
export function buildGridView(
  kind: PollKind,
  days: string[],
  from: string,
  to: string,
  slot: number,
  pollTz: string,
  viewerTz: string,
): GridView {
  const times = timeSlots(from, to, slot);

  if (kind === "weekdays") {
    return {
      days,
      times,
      dayLabels: days.map(weekdayLabel),
      keyAt: (d, t) => `${d}T${t}`,
    };
  }

  if (pollTz === viewerTz) {
    // Skip wall times that don't exist (spring-forward gap) on a given date.
    const valid = new Set<string>();
    for (const d of days)
      for (const t of times)
        if (existsInTz(d, t, pollTz)) valid.add(`${d}T${t}`);
    return {
      days,
      times,
      dayLabels: days.map(dateLabel),
      keyAt: (d, t) => (valid.has(`${d}T${t}`) ? `${d}T${t}` : null),
    };
  }

  const map = new Map<string, string>();
  const daySet = new Set<string>();
  const timeSet = new Set<string>();
  for (const d of days) {
    for (const t of times) {
      const utc = zonedTimeToUtc(d, t, pollTz);
      const src = partsInTz(utc, pollTz);
      if (src.date !== d || src.time !== t) continue; // skipped DST gap slot
      const local = partsInTz(utc, viewerTz);
      map.set(`${local.date}T${local.time}`, `${d}T${t}`);
      daySet.add(local.date);
      timeSet.add(local.time);
    }
  }
  const localDays = [...daySet].sort();
  return {
    days: localDays,
    times: [...timeSet].sort(),
    dayLabels: localDays.map(dateLabel),
    keyAt: (d, t) => map.get(`${d}T${t}`) ?? null,
  };
}

// Canonical key -> human label. Dates convert to the viewer's tz ("Wed 16, 14:00");
// weekday keys ("monT09:00") render in the poll's tz ("Mon 09:00").
export function formatSlotLabelInTz(
  canonicalKey: string,
  kind: PollKind,
  pollTz: string,
  viewerTz: string,
): string {
  const [day, time] = canonicalKey.split("T");
  if (kind === "weekdays") {
    return `${weekdayLabel(day)} ${formatTime(time)}`;
  }
  if (pollTz === viewerTz) {
    return `${formatDayLabel(day)}, ${formatTime(time)}`;
  }
  const local = partsInTz(zonedTimeToUtc(day, time, pollTz), viewerTz);
  return `${formatDayLabel(local.date)}, ${formatTime(local.time)}`;
}
