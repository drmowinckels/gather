// In-browser .ics parsing for the "overlay my calendar" feature. Everything here
// is pure and runs entirely client-side — parsed events never leave the browser.
// We extract busy time ranges, then map them onto the poll's slot grid.
import { zonedTimeToUtc, partsInTz, type PollKind } from "./tz";
import { timeSlots, toMinutes, WEEKDAY_TOKENS } from "@samkoma/core";

// RFC 5545 BYDAY codes ("MO".."SU"), parallel to WEEKDAY_TOKENS.
const BYDAY_CODES = WEEKDAY_TOKENS.map((t) => t.slice(0, 2).toUpperCase());

export interface BusyInterval {
  start: number; // epoch ms, inclusive
  end: number; // epoch ms, exclusive
}

export interface OverlayWindow {
  start: number;
  end: number;
}

interface Prop {
  name: string;
  params: Record<string, string>;
  value: string;
}

// RFC 5545 §3.1: unfold continuation lines (a CRLF followed by space/tab).
function unfold(text: string): string[] {
  return text
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/\n[ \t]/g, "")
    .split("\n");
}

function parseProp(line: string): Prop | null {
  const colon = line.indexOf(":");
  if (colon < 0) return null;
  const head = line.slice(0, colon);
  const value = line.slice(colon + 1);
  const [name, ...paramParts] = head.split(";");
  const params: Record<string, string> = {};
  for (const p of paramParts) {
    const eq = p.indexOf("=");
    if (eq > 0) params[p.slice(0, eq).toUpperCase()] = p.slice(eq + 1);
  }
  return { name: name.toUpperCase(), params, value };
}

// An instant resolved to epoch ms, but keeping its wall date/time + zone so
// recurrence can step in wall-clock space (DST-correct) rather than fixed ms.
interface Instant {
  ms: number;
  allDay: boolean;
  date: string; // wall date "YYYY-MM-DD"
  time: string; // wall time "HH:MM"
  zone: string; // IANA zone, or "UTC" for a `...Z` value
}

// Parse a DATE / DATE-TIME property. UTC (`...Z` → zone "UTC"), zoned (`TZID=`),
// or floating (interpreted in `defaultTz`); date-only is all-day.
function parseInstant(prop: Prop, defaultTz: string): Instant | null {
  const v = prop.value.trim();
  if (prop.params.VALUE === "DATE" || /^\d{8}$/.test(v)) {
    const date = `${v.slice(0, 4)}-${v.slice(4, 6)}-${v.slice(6, 8)}`;
    return {
      ms: zonedTimeToUtc(date, "00:00", defaultTz).getTime(),
      allDay: true,
      date,
      time: "00:00",
      zone: defaultTz,
    };
  }
  const m = v.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})?(Z)?$/);
  if (!m) return null;
  const [, y, mo, da, hh, mi, , z] = m;
  const date = `${y}-${mo}-${da}`;
  const time = `${hh}:${mi}`;
  const zone = z === "Z" ? "UTC" : prop.params.TZID || defaultTz;
  return {
    ms: zonedTimeToUtc(date, time, zone).getTime(),
    allDay: false,
    date,
    time,
    zone,
  };
}

// ISO 8601 duration (e.g. PT1H30M, P1D) → milliseconds.
function parseDuration(s: string): number {
  const m = s
    .trim()
    .match(
      /^(-)?P(?:(\d+)W)?(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/,
    );
  if (!m) return 0;
  const [, sign, w, d, h, mi, sec] = m;
  const total =
    (+(w || 0) * 7 + +(d || 0)) * 86400 +
    +(h || 0) * 3600 +
    +(mi || 0) * 60 +
    +(sec || 0);
  return (sign ? -1 : 1) * total * 1000;
}

function parseRrule(v: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const part of v.split(";")) {
    const [k, val] = part.split("=");
    if (k && val) out[k.toUpperCase()] = val;
  }
  return out;
}

function untilMs(v: string): number {
  const r = parseInstant({ name: "UNTIL", params: {}, value: v }, "UTC");
  return r ? r.ms : Infinity;
}

interface RawEvent {
  start?: Instant;
  endMs?: number;
  durationMs?: number;
  rrule?: Record<string, string>;
}

function durationMs(ev: RawEvent): number {
  if (ev.start && ev.endMs != null) return ev.endMs - ev.start.ms;
  if (ev.durationMs) return ev.durationMs;
  if (ev.start?.allDay) return 86_400_000;
  return 0;
}

function addDays(iso: string, n: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

function weekdayIndex(iso: string): number {
  return (new Date(`${iso}T00:00:00Z`).getUTCDay() + 6) % 7; // 0 = Monday
}

// Expand an event into busy intervals overlapping the window. Non-recurring →
// one interval. FREQ=DAILY/WEEKLY (incl. BYDAY for weekly) are expanded in
// wall-clock space — each occurrence is re-resolved through the event's zone, so
// a recurring event stays at the same local time across DST transitions. Any
// other FREQ yields just the base occurrence and is counted as skipped.
function expand(
  ev: RawEvent,
  win: OverlayWindow,
  onSkip: () => void,
): BusyInterval[] {
  const st = ev.start;
  const dur = durationMs(ev);
  if (!st || dur <= 0) return [];
  const at = (date: string): number =>
    zonedTimeToUtc(date, st.time, st.zone).getTime();
  const base: BusyInterval = { start: st.ms, end: st.ms + dur };

  if (!ev.rrule) return overlapsWindow(base, win) ? [base] : [];

  const freq = ev.rrule.FREQ?.toUpperCase();
  if (freq !== "DAILY" && freq !== "WEEKLY") {
    onSkip();
    return overlapsWindow(base, win) ? [base] : [];
  }

  const interval = Math.max(1, Number.parseInt(ev.rrule.INTERVAL || "1", 10));
  const until = ev.rrule.UNTIL ? untilMs(ev.rrule.UNTIL) : Infinity;
  const maxCount = ev.rrule.COUNT
    ? Number.parseInt(ev.rrule.COUNT, 10)
    : Infinity;
  const stepDays = (freq === "WEEKLY" ? 7 : 1) * interval;
  // Weekly BYDAY → day offsets from the week's Monday (sorted chronologically);
  // default: the event's own weekday.
  const byday =
    freq === "WEEKLY" && ev.rrule.BYDAY
      ? ev.rrule.BYDAY.split(",")
          .map((d) => BYDAY_CODES.indexOf(d.trim().slice(-2)))
          .filter((i) => i >= 0)
          .sort((a, b) => a - b)
      : null;
  const anchor = byday?.length
    ? addDays(st.date, -weekdayIndex(st.date))
    : st.date;
  // The window bounds expansion; the natural break ends it first. The hard cap
  // is only a backstop against an absurd window and can't truncate in practice.
  const maxCycles = Math.min(
    5000,
    Math.max(0, Math.ceil((win.end - st.ms) / (stepDays * 86_400_000))) + 2,
  );

  const out: BusyInterval[] = [];
  let count = 0;
  for (let cycle = 0; cycle <= maxCycles && count < maxCount; cycle++) {
    const cycleStart = addDays(anchor, cycle * stepDays);
    if (at(cycleStart) > win.end) break; // the whole cycle is past the window
    const dates = byday?.length
      ? byday.map((off) => addDays(cycleStart, off))
      : [cycleStart];
    for (const date of dates) {
      if (count >= maxCount) break;
      const ms = at(date);
      if (ms < st.ms || ms > until) continue; // before DTSTART, or past UNTIL
      count++;
      const occ = { start: ms, end: ms + dur };
      if (overlapsWindow(occ, win)) out.push(occ);
    }
  }
  return out;
}

function overlapsWindow(i: BusyInterval, win: OverlayWindow): boolean {
  return i.start < win.end && i.end > win.start;
}

export function parseIcsBusy(
  text: string,
  defaultTz: string,
  win: OverlayWindow,
): { busy: BusyInterval[]; skipped: number } {
  const busy: BusyInterval[] = [];
  let skipped = 0;
  let ev: RawEvent | null = null;
  for (const line of unfold(text)) {
    const u = line.toUpperCase();
    if (u === "BEGIN:VEVENT") {
      ev = {};
      continue;
    }
    if (u === "END:VEVENT") {
      if (ev) busy.push(...expand(ev, win, () => skipped++));
      ev = null;
      continue;
    }
    if (!ev) continue;
    const prop = parseProp(line);
    if (!prop) continue;
    if (prop.name === "DTSTART") {
      const r = parseInstant(prop, defaultTz);
      if (r) ev.start = r;
    } else if (prop.name === "DTEND") {
      const r = parseInstant(prop, defaultTz);
      if (r) ev.endMs = r.ms;
    } else if (prop.name === "DURATION") {
      ev.durationMs = parseDuration(prop.value);
    } else if (prop.name === "RRULE") {
      ev.rrule = parseRrule(prop.value);
    }
  }
  return { busy, skipped };
}

// The instant range the overlay cares about: a dated poll's own span, or ~8
// weeks from `now` for a weekday poll (enough to sample the weekly pattern).
export function overlayWindow(
  poll: { kind: PollKind; days: string[]; tz: string },
  now: Date = new Date(),
): OverlayWindow {
  if (poll.kind === "weekdays") {
    const start = now.getTime();
    return { start, end: start + 56 * 86_400_000 };
  }
  const sorted = [...poll.days].sort();
  const first = zonedTimeToUtc(sorted[0], "00:00", poll.tz).getTime();
  const last =
    zonedTimeToUtc(sorted[sorted.length - 1], "00:00", poll.tz).getTime() +
    86_400_000;
  return { start: first, end: last };
}

function weekdayToken(iso: string): string {
  return WEEKDAY_TOKENS[weekdayIndex(iso)];
}

// Split an interval into per-local-day {date, [startMin,endMin)} portions in tz.
function localDayPortions(
  startMs: number,
  endMs: number,
  tz: string,
): { date: string; startMin: number; endMin: number }[] {
  const s = partsInTz(new Date(startMs), tz);
  const e = partsInTz(new Date(endMs), tz);
  const out: { date: string; startMin: number; endMin: number }[] = [];
  let date = s.date;
  let startMin = toMinutes(s.time);
  while (date < e.date) {
    out.push({ date, startMin, endMin: 1440 });
    date = addDays(date, 1);
    startMin = 0;
  }
  const endMin = date === e.date ? toMinutes(e.time) : 1440;
  if (endMin > startMin) out.push({ date, startMin, endMin });
  return out;
}

// Canonical slot keys the busy intervals cover, for overlaying on the grid.
export function busySlotKeys(
  poll: {
    kind: PollKind;
    days: string[];
    from: string;
    to: string;
    slot: number;
    tz: string;
  },
  busy: BusyInterval[],
): Set<string> {
  const out = new Set<string>();
  const times = timeSlots(poll.from, poll.to, poll.slot);
  const slotMs = poll.slot * 60_000;

  if (poll.kind === "weekdays") {
    const dayset = new Set(poll.days);
    for (const iv of busy) {
      for (const p of localDayPortions(iv.start, iv.end, poll.tz)) {
        const token = weekdayToken(p.date);
        if (!dayset.has(token)) continue;
        for (const t of times) {
          const m = toMinutes(t);
          if (m < p.endMin && m + poll.slot > p.startMin) {
            out.add(`${token}T${t}`);
          }
        }
      }
    }
    return out;
  }

  for (const day of poll.days) {
    for (const t of times) {
      const start = zonedTimeToUtc(day, t, poll.tz).getTime();
      const end = start + slotMs;
      if (busy.some((iv) => iv.start < end && iv.end > start)) {
        out.add(`${day}T${t}`);
      }
    }
  }
  return out;
}
