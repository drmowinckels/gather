// Timezone conversion shared by the web grid and the .ics export. A slot key is
// a wall-clock time in the poll's canonical tz; turning it into an absolute
// instant (or relabeling it in another zone) is DST-aware domain logic, so it
// lives here rather than being duplicated per consumer.

import { toMinutes, minutesToTime } from "./time.js";

// Intl.DateTimeFormat is expensive to construct; reuse one per (tz, withSeconds).
const FMT_CACHE = new Map<string, Intl.DateTimeFormat>();

function formatter(tz: string, withSeconds: boolean): Intl.DateTimeFormat {
  const key = `${tz}:${withSeconds}`;
  let f = FMT_CACHE.get(key);
  if (!f) {
    f = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      ...(withSeconds ? { second: "2-digit" } : {}),
    });
    FMT_CACHE.set(key, f);
  }
  return f;
}

function fmtParts(
  instant: Date,
  tz: string,
  withSeconds: boolean,
): Record<string, string> {
  const map: Record<string, string> = {};
  for (const p of formatter(tz, withSeconds).formatToParts(instant)) {
    map[p.type] = p.value;
  }
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
export function zonedTimeToUtc(
  dateISO: string,
  time: string,
  tz: string,
): Date {
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
  return {
    date: `${m.year}-${m.month}-${m.day}`,
    time: `${m.hour}:${m.minute}`,
  };
}

// A wall-clock time exists in `tz` iff it round-trips. It won't when it falls in
// the gap of a spring-forward transition (e.g. 02:30 when clocks jump 02:00→03:00).
export function existsInTz(dateISO: string, time: string, tz: string): boolean {
  const back = partsInTz(zonedTimeToUtc(dateISO, time, tz), tz);
  return back.date === dateISO && back.time === time;
}

export interface OverlapResult {
  // The overlapping window in the canonical zone, as "HH:MM"; null when empty.
  // When `wraps` is true these still describe the window, but `from` is later
  // than `to` because it crosses midnight.
  from: string | null;
  to: string | null;
  // No instant exists where every covered zone is inside its working window.
  empty: boolean;
  // The overlap crosses midnight in the canonical zone, so it can't be expressed
  // as a single from<to window; the consumer should warn rather than auto-fill.
  wraps: boolean;
  // Length of the overlap in minutes (0 when empty).
  durationMin: number;
}

function fmtMin(min: number): string {
  return minutesToTime(((min % 1440) + 1440) % 1440);
}

// The wall-clock window, in `canonicalTz`, during which every covered zone is
// inside its local working window [localFrom, localTo). This is the time-of-day
// (offset) model, not a same-date interval intersection: an instant is "good"
// when each zone's *local clock* reads within the window, so it correctly pairs
// one zone's afternoon with another's next morning (e.g. US-west 16:00 = Sydney
// 09:00 next day). Offsets are sampled per polled day at midday; a span crossing
// a DST boundary narrows the result to the hours that hold on every day. Returns
// `empty` when no such instant exists, and flags `wraps` when the window crosses
// midnight in the canonical zone (not expressible as a single from<to window).
export function overlapWindow(
  zones: string[],
  localFrom: string,
  localTo: string,
  days: string[],
  canonicalTz: string,
): OverlapResult {
  if (zones.length === 0) throw new Error("overlapWindow: no zones given");
  if (days.length === 0) throw new Error("overlapWindow: no days given");
  if (toMinutes(localFrom) >= toMinutes(localTo)) {
    throw new Error("overlapWindow: localFrom must be earlier than localTo");
  }
  const fromMin = toMinutes(localFrom);
  const toMin = toMinutes(localTo);

  // Each zone's offset from the canonical zone, in minutes, per polled day —
  // sampled at midday so a DST edge inside the working window doesn't skew it.
  // Distinct vectors collapse identical days, so a poll spanning one DST change
  // yields two vectors to satisfy, not one per calendar day.
  const vectors = new Map<string, number[]>();
  for (const day of days) {
    const homeMidday = zonedTimeToUtc(day, "12:00", canonicalTz);
    const vec = zones.map(
      (z) => toMinutes(partsInTz(homeMidday, z).time) - 720,
    );
    vectors.set(vec.join(","), vec);
  }
  const vecList = [...vectors.values()];

  // A canonical minute-of-day is good when, on every distinct day, every zone's
  // local clock at that instant is inside its working window.
  const good = new Array<boolean>(1440);
  let total = 0;
  for (let t = 0; t < 1440; t++) {
    good[t] = vecList.every((vec) =>
      vec.every((delta) => {
        const local = (((t + delta) % 1440) + 1440) % 1440;
        return local >= fromMin && local < toMin;
      }),
    );
    if (good[t]) total++;
  }

  if (total === 0) {
    return { from: null, to: null, empty: true, wraps: false, durationMin: 0 };
  }

  // Longest contiguous run on the 24h circle. Scanning from a non-good minute
  // keeps a midnight-spanning run in one piece. If the good set is disjoint (only
  // possible across DST vectors), the shorter run is intentionally dropped — we
  // suggest a single window, not several.
  const offset = good.indexOf(false);
  let bestStart = 0;
  let bestLen = 0;
  let curStart = 0;
  let curLen = 0;
  for (let k = 0; k < 1440; k++) {
    const t = (offset + k) % 1440;
    if (good[t]) {
      if (curLen === 0) curStart = t;
      curLen++;
      if (curLen > bestLen) {
        bestLen = curLen;
        bestStart = curStart;
      }
    } else {
      curLen = 0;
    }
  }

  const from = fmtMin(bestStart);
  const to = fmtMin(bestStart + bestLen);
  return { from, to, empty: false, wraps: from >= to, durationMin: bestLen };
}
