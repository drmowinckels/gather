// Timezone conversion shared by the web grid and the .ics export. A slot key is
// a wall-clock time in the poll's canonical tz; turning it into an absolute
// instant (or relabeling it in another zone) is DST-aware domain logic, so it
// lives here rather than being duplicated per consumer.

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
