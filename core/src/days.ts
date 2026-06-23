import { pad } from "./time.js";

const WEEKDAY_TOKENS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
const WEEKDAYS: Record<string, number> = Object.fromEntries(
  WEEKDAY_TOKENS.map((t, i) => [t, i]),
);

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

// Parse a day spec into sorted, de-duplicated weekday tokens (mon–sun) for a
// weekday poll — unlike resolveDays, weekdays are kept as tokens, not resolved
// to calendar dates. Tokens may be weekdays ("mon") or ranges ("mon-fri").
export function parseWeekdays(spec: string): string[] {
  const order = (t: string) => WEEKDAYS[t];
  const out = new Set<string>();
  for (const raw of spec.split(",")) {
    const token = raw.trim().toLowerCase();
    if (!token) continue;
    const range = token.match(/^([a-z]{3})-([a-z]{3})$/);
    if (range) {
      const start = WEEKDAYS[range[1]];
      const end = WEEKDAYS[range[2]];
      if (start === undefined || end === undefined || start > end) {
        throw new Error(`Invalid weekday range: "${raw}"`);
      }
      for (let i = start; i <= end; i++) out.add(WEEKDAY_TOKENS[i]);
      continue;
    }
    if (WEEKDAYS[token] === undefined) {
      throw new Error(`Unrecognized weekday: "${raw}"`);
    }
    out.add(token);
  }
  if (out.size === 0) throw new Error("No weekdays given (use --days mon-fri)");
  return [...out].sort((a, b) => order(a) - order(b));
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
