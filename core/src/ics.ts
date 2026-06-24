// iCalendar (RFC 5545) generation for a poll's locked slot. Pure and runs
// anywhere Intl exists (Worker, Node, browser), so the API, CLI and client can
// all emit the same calendar.
import { pad, toMinutes } from "./time.js";
import { zonedTimeToUtc } from "./zone.js";
import { WEEKDAY_TOKENS } from "./days.js";

export interface IcsPoll {
  id: string;
  title: string;
  kind: "dates" | "weekdays";
  tz: string;
  slotMinutes: number;
  lockedSlot: string; // "YYYY-MM-DDThh:mm" (dates) or "monThh:mm" (weekdays)
}

export interface IcsOptions {
  url?: string; // poll URL, emitted as DESCRIPTION
  uid?: string; // override the generated UID (tests)
  now?: Date; // anchor for a weekday poll's first occurrence (default: today)
  dtstamp?: Date; // override DTSTAMP (tests); default: now
}

// RFC 5545 BYDAY code for a weekday token: "mon" -> "MO", "tue" -> "TU", …
function byDay(token: string): string {
  return token.slice(0, 2).toUpperCase();
}

const encoder = new TextEncoder();

// RFC 5545 §3.3.11: escape backslash, semicolon, comma and newlines in TEXT.
// Bare CR (and any other C0 control char) is neutralised so it can never leak
// into the output and be read as a line break — TAB and SPACE are kept (valid
// WSP in a TEXT value).
function escapeText(s: string): string {
  return s
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r\n|\r|\n/g, "\\n")
    .replace(/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/g, "");
}

// RFC 5545 §3.1: fold content lines longer than 75 octets. Folds on UTF-8 octet
// boundaries and never splits a code point, so multibyte titles (emoji, CJK)
// survive intact. Continuation lines are prefixed with a single space.
function foldLine(line: string): string {
  if (encoder.encode(line).length <= 75) return line;
  const out: string[] = [];
  let current = "";
  let bytes = 0;
  let budget = 75;
  for (const ch of line) {
    const w = encoder.encode(ch).length;
    if (bytes + w > budget) {
      out.push(current);
      current = ch;
      bytes = w;
      budget = 74; // continuation lines carry a leading space toward the 75
    } else {
      current += ch;
      bytes += w;
    }
  }
  out.push(current);
  return out.join("\r\n ");
}

// "YYYYMMDDTHHMMSSZ" for an absolute UTC instant.
function utcStamp(d: Date): string {
  return (
    `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}` +
    `T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`
  );
}

// "YYYYMMDDTHHMMSS" floating (no zone) — used for recurring weekday events so
// they fire at the same wall-clock time each week regardless of DST.
function floatingStamp(dateISO: string, time: string): string {
  return `${dateISO.replace(/-/g, "")}T${time.replace(":", "")}00`;
}

// Soonest date (YYYY-MM-DD) that falls on `token`'s weekday, on or after `now`.
// Computed in UTC (not local time, unlike days.ts's poll-creation resolver) so
// the RRULE anchor is deterministic regardless of where the export runs.
function nextWeekdayDate(token: string, now: Date): string {
  const target = WEEKDAY_TOKENS.indexOf(token);
  const current = (now.getUTCDay() + 6) % 7; // 0 = Monday
  const ahead = (target - current + 7) % 7;
  const d = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + ahead),
  );
  return d.toISOString().slice(0, 10);
}

// Add `minutes` to a wall-clock date+time, rolling the date forward if needed.
function addMinutes(
  dateISO: string,
  time: string,
  minutes: number,
): { date: string; time: string } {
  const total = toMinutes(time) + minutes;
  const dayShift = Math.floor(total / 1440);
  const mins = total % 1440;
  let date = dateISO;
  if (dayShift !== 0) {
    const base = new Date(`${dateISO}T00:00:00Z`);
    base.setUTCDate(base.getUTCDate() + dayShift);
    date = base.toISOString().slice(0, 10);
  }
  return {
    date,
    time: `${pad(Math.floor(mins / 60))}:${pad(mins % 60)}`,
  };
}

// A filesystem-safe ".ics" filename derived from the poll title.
export function icsFilename(title: string): string {
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return `${slug || "event"}.ics`;
}

// Build an iCalendar document with a single VEVENT for the poll's locked slot.
// Dated polls emit an absolute UTC event; weekday polls emit a weekly-recurring
// floating-time event (RRULE) anchored at the next occurrence.
export function buildLockedIcs(poll: IcsPoll, opts: IcsOptions = {}): string {
  const [day, time] = poll.lockedSlot.split("T");
  const now = opts.now ?? new Date();
  const dtstamp = utcStamp(opts.dtstamp ?? now);
  const uid = opts.uid ?? `${poll.id}-${poll.lockedSlot}@samkoma`;

  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//samkoma//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${uid}`,
    `DTSTAMP:${dtstamp}`,
    `SUMMARY:${escapeText(poll.title)}`,
  ];
  if (opts.url) lines.push(`DESCRIPTION:${escapeText(opts.url)}`);

  if (poll.kind === "weekdays") {
    const startDate = nextWeekdayDate(day, now);
    const end = addMinutes(startDate, time, poll.slotMinutes);
    lines.push(
      `DTSTART:${floatingStamp(startDate, time)}`,
      `DTEND:${floatingStamp(end.date, end.time)}`,
      `RRULE:FREQ=WEEKLY;BYDAY=${byDay(day)}`,
    );
  } else {
    const start = zonedTimeToUtc(day, time, poll.tz);
    const end = new Date(start.getTime() + poll.slotMinutes * 60000);
    lines.push(`DTSTART:${utcStamp(start)}`, `DTEND:${utcStamp(end)}`);
  }

  lines.push("END:VEVENT", "END:VCALENDAR");
  return lines.map(foldLine).join("\r\n") + "\r\n";
}
