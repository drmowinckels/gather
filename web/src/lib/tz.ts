import { timeSlots, dayHeader } from "./datetime";

function fmtParts(
  instant: Date,
  tz: string,
  withSeconds: boolean,
): Record<string, string> {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    ...(withSeconds ? { second: "2-digit" } : {}),
  });
  const map: Record<string, string> = {};
  for (const p of dtf.formatToParts(instant)) map[p.type] = p.value;
  return map;
}

function tzOffsetMs(instant: Date, tz: string): number {
  const m = fmtParts(instant, tz, true);
  const asUTC = Date.UTC(
    +m.year,
    +m.month - 1,
    +m.day,
    +m.hour,
    +m.minute,
    +m.second,
  );
  return asUTC - instant.getTime();
}

// Interpret a wall-clock (date + HH:MM) in `tz` and return the UTC instant.
export function zonedTimeToUtc(dateISO: string, time: string, tz: string): Date {
  const [y, mo, d] = dateISO.split("-").map(Number);
  const [h, mi] = time.split(":").map(Number);
  const wall = Date.UTC(y, mo - 1, d, h, mi);
  let ts = wall;
  // One correction resolves the offset; a second settles DST edge cases.
  for (let i = 0; i < 2; i++) {
    const next = wall - tzOffsetMs(new Date(ts), tz);
    if (next === ts) break;
    ts = next;
  }
  return new Date(ts);
}

// Render a UTC instant as wall-clock (date + HH:MM) in `tz`.
export function partsInTz(
  instant: Date,
  tz: string,
): { date: string; time: string } {
  const m = fmtParts(instant, tz, false);
  return { date: `${m.year}-${m.month}-${m.day}`, time: `${m.hour}:${m.minute}` };
}

export interface GridView {
  days: string[]; // viewer-local ISO dates
  times: string[]; // viewer-local HH:MM
  keyAt: (day: string, time: string) => string | null; // canonical slot key, or gap
}

// Build the grid as the viewer sees it. Canonical slot keys (in the poll's
// timezone) are converted to the viewer's local day/time; painting and
// aggregation still use the canonical keys, so two people in different zones who
// pick the same absolute time land on the same slot.
export function buildGridView(
  days: string[],
  from: string,
  to: string,
  slot: number,
  pollTz: string,
  viewerTz: string,
): GridView {
  const times = timeSlots(from, to, slot);
  if (pollTz === viewerTz) {
    return { days, times, keyAt: (d, t) => `${d}T${t}` };
  }

  const map = new Map<string, string>();
  const daySet = new Set<string>();
  const timeSet = new Set<string>();
  for (const d of days) {
    for (const t of times) {
      const key = `${d}T${t}`;
      const local = partsInTz(zonedTimeToUtc(d, t, pollTz), viewerTz);
      map.set(`${local.date}T${local.time}`, key);
      daySet.add(local.date);
      timeSet.add(local.time);
    }
  }
  return {
    days: [...daySet].sort(),
    times: [...timeSet].sort(),
    keyAt: (d, t) => map.get(`${d}T${t}`) ?? null,
  };
}

// "2026-07-16T12:00" (canonical, in pollTz) -> "Wed 16, 14:00" in viewerTz.
export function formatSlotLabelInTz(
  canonicalKey: string,
  pollTz: string,
  viewerTz: string,
): string {
  const [day, time] = canonicalKey.split("T");
  if (pollTz === viewerTz) {
    const h = dayHeader(day);
    return `${h.weekday} ${h.day}, ${time}`;
  }
  const local = partsInTz(zonedTimeToUtc(day, time, pollTz), viewerTz);
  const h = dayHeader(local.date);
  return `${h.weekday} ${h.day}, ${local.time}`;
}
