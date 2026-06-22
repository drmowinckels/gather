import { pad } from "./time.js";

const WEEKDAYS: Record<string, number> = {
  mon: 0,
  tue: 1,
  wed: 2,
  thu: 3,
  fri: 4,
  sat: 5,
  sun: 6,
};

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function toISO(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function weekdayIndex(d: Date): number {
  return (d.getDay() + 6) % 7; // 0 = Monday … 6 = Sunday
}

// The soonest date that is the given weekday, on or after `today`.
function nextOccurrence(weekday: number, today: Date): string {
  const ahead = (weekday - weekdayIndex(today) + 7) % 7;
  return toISO(
    new Date(today.getFullYear(), today.getMonth(), today.getDate() + ahead),
  );
}

// Resolve a `--days` spec into sorted, de-duplicated ISO dates. Tokens may be
// ISO dates ("2026-07-15"), weekday names ("mon"), or weekday ranges
// ("mon-fri"). Weekdays resolve to their next upcoming occurrence.
export function resolveDays(spec: string, today: Date = new Date()): string[] {
  const out = new Set<string>();
  for (const raw of spec.split(",")) {
    const token = raw.trim().toLowerCase();
    if (!token) continue;
    if (ISO_DATE.test(token)) {
      out.add(token);
      continue;
    }
    const range = token.match(/^([a-z]{3})-([a-z]{3})$/);
    if (range) {
      const start = WEEKDAYS[range[1]];
      const end = WEEKDAYS[range[2]];
      if (start === undefined || end === undefined || start > end) {
        throw new Error(`Invalid day range: "${raw}"`);
      }
      for (let i = start; i <= end; i++) out.add(nextOccurrence(i, today));
      continue;
    }
    const wd = WEEKDAYS[token];
    if (wd === undefined) throw new Error(`Unrecognized day: "${raw}"`);
    out.add(nextOccurrence(wd, today));
  }
  if (out.size === 0) throw new Error("No days given (use --days)");
  return [...out].sort();
}
