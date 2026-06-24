import { describe, it, expect } from "vitest";
import {
  parseIcsBusy,
  busySlotKeys,
  overlayWindow,
  type OverlayWindow,
} from "./icsImport";

function ics(...lines: string[]): string {
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "BEGIN:VEVENT",
    ...lines,
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");
}

// Wide window covering the 2026-07 test dates.
const WIN: OverlayWindow = {
  start: Date.UTC(2026, 6, 1),
  end: Date.UTC(2026, 7, 1),
};

describe("parseIcsBusy", () => {
  it("parses a UTC event into one interval", () => {
    const { busy, skipped } = parseIcsBusy(
      ics("DTSTART:20260715T080000Z", "DTEND:20260715T083000Z"),
      "UTC",
      WIN,
    );
    expect(skipped).toBe(0);
    expect(busy).toHaveLength(1);
    expect(busy[0].start).toBe(Date.UTC(2026, 6, 15, 8, 0));
    expect(busy[0].end).toBe(Date.UTC(2026, 6, 15, 8, 30));
  });

  it("interprets a zoned (TZID) event", () => {
    const { busy } = parseIcsBusy(
      ics(
        "DTSTART;TZID=Europe/Oslo:20260715T100000",
        "DTEND;TZID=Europe/Oslo:20260715T103000",
      ),
      "UTC",
      WIN,
    );
    // 10:00 Oslo (CEST +2) == 08:00 UTC
    expect(busy[0].start).toBe(Date.UTC(2026, 6, 15, 8, 0));
  });

  it("treats a floating time as the default tz, and DURATION as the length", () => {
    const { busy } = parseIcsBusy(
      ics("DTSTART:20260715T100000", "DURATION:PT1H"),
      "Europe/Oslo",
      WIN,
    );
    expect(busy[0].start).toBe(Date.UTC(2026, 6, 15, 8, 0));
    expect(busy[0].end).toBe(Date.UTC(2026, 6, 15, 9, 0));
  });

  it("treats a VALUE=DATE event as all-day (24h)", () => {
    const { busy } = parseIcsBusy(
      ics("DTSTART;VALUE=DATE:20260715"),
      "UTC",
      WIN,
    );
    expect(busy[0].end - busy[0].start).toBe(86_400_000);
  });

  it("expands a weekly RRULE within the window", () => {
    const { busy } = parseIcsBusy(
      ics(
        "DTSTART:20260701T080000Z",
        "DTEND:20260701T083000Z",
        "RRULE:FREQ=WEEKLY;COUNT=3",
      ),
      "UTC",
      WIN,
    );
    expect(busy).toHaveLength(3);
    expect(busy[1].start).toBe(busy[0].start + 7 * 86_400_000);
  });

  it("keeps a recurring TZID event at the same wall time across a DST change", () => {
    // Weekly Wed 09:00 Oslo, spanning the 2026-03-29 spring-forward (CET→CEST).
    const win = { start: Date.UTC(2026, 2, 1), end: Date.UTC(2026, 3, 15) };
    const { busy } = parseIcsBusy(
      ics(
        "DTSTART;TZID=Europe/Oslo:20260311T090000",
        "DTEND;TZID=Europe/Oslo:20260311T093000",
        "RRULE:FREQ=WEEKLY",
      ),
      "UTC",
      win,
    );
    // Every occurrence must be 09:00 Oslo: 08:00Z before the change, 07:00Z after
    // — never an hour adrift.
    const offsets = busy.map((b) => {
      const d = new Date(b.start);
      return `${d.getUTCHours()}:${String(d.getUTCMinutes()).padStart(2, "0")}`;
    });
    expect(offsets).toContain("8:00"); // CET (+1), pre-DST
    expect(offsets).toContain("7:00"); // CEST (+2), post-DST
    expect(offsets).not.toContain("9:00"); // would mean wall-clock drifted
  });

  it("expands weekly BYDAY occurrences (sorted, COUNT-limited)", () => {
    const win = { start: Date.UTC(2026, 6, 1), end: Date.UTC(2026, 7, 1) };
    const { busy } = parseIcsBusy(
      ics(
        "DTSTART:20260701T080000Z", // 2026-07-01 is a Wednesday
        "DTEND:20260701T083000Z",
        "RRULE:FREQ=WEEKLY;BYDAY=MO,WE;COUNT=3",
      ),
      "UTC",
      win,
    );
    // Wed 7/1, Mon 7/6, Wed 7/8 — the pre-start Monday is not emitted.
    expect(busy).toHaveLength(3);
    expect(busy.map((b) => new Date(b.start).getUTCDate())).toEqual([1, 6, 8]);
  });

  it("counts an unsupported RRULE as skipped but keeps the base occurrence", () => {
    const { busy, skipped } = parseIcsBusy(
      ics(
        "DTSTART:20260715T080000Z",
        "DTEND:20260715T083000Z",
        "RRULE:FREQ=MONTHLY",
      ),
      "UTC",
      WIN,
    );
    expect(skipped).toBe(1);
    expect(busy).toHaveLength(1);
  });

  it("unfolds folded content lines", () => {
    const folded =
      "BEGIN:VCALENDAR\r\nBEGIN:VEVENT\r\nDTSTART:20260715T0800\r\n 00Z\r\nDTEND:20260715T083000Z\r\nEND:VEVENT\r\nEND:VCALENDAR";
    const { busy } = parseIcsBusy(folded, "UTC", WIN);
    expect(busy[0].start).toBe(Date.UTC(2026, 6, 15, 8, 0));
  });

  it("ignores a zero-length or malformed event", () => {
    const { busy } = parseIcsBusy(ics("SUMMARY:no times"), "UTC", WIN);
    expect(busy).toHaveLength(0);
  });
});

describe("busySlotKeys", () => {
  const datesPoll = {
    kind: "dates" as const,
    days: ["2026-07-15"],
    from: "09:00",
    to: "12:00",
    slot: 30,
    tz: "Europe/Oslo",
  };

  it("marks the dated slots an interval overlaps (poll tz)", () => {
    // 10:00–10:45 Oslo overlaps the 10:00 and 10:30 slots.
    const busy = [
      { start: Date.UTC(2026, 6, 15, 8, 0), end: Date.UTC(2026, 6, 15, 8, 45) },
    ];
    const keys = busySlotKeys(datesPoll, busy);
    expect(keys.has("2026-07-15T10:00")).toBe(true);
    expect(keys.has("2026-07-15T10:30")).toBe(true);
    expect(keys.has("2026-07-15T09:00")).toBe(false);
    expect(keys.has("2026-07-15T11:00")).toBe(false);
  });

  it("maps an interval onto matching weekday columns", () => {
    const weekdayPoll = {
      ...datesPoll,
      kind: "weekdays" as const,
      days: ["wed"],
    };
    // 2026-07-15 is a Wednesday; 10:00–10:30 Oslo.
    const busy = [
      { start: Date.UTC(2026, 6, 15, 8, 0), end: Date.UTC(2026, 6, 15, 8, 30) },
    ];
    const keys = busySlotKeys(weekdayPoll, busy);
    expect(keys.has("wedT10:00")).toBe(true);
    expect(keys.has("wedT09:00")).toBe(false);
  });

  it("ignores weekdays not in the poll", () => {
    const weekdayPoll = {
      ...datesPoll,
      kind: "weekdays" as const,
      days: ["mon"],
    };
    const busy = [
      { start: Date.UTC(2026, 6, 15, 8, 0), end: Date.UTC(2026, 6, 15, 8, 30) },
    ]; // a Wednesday
    expect(busySlotKeys(weekdayPoll, busy).size).toBe(0);
  });
});

describe("overlayWindow", () => {
  it("spans a dated poll's days", () => {
    const w = overlayWindow({
      kind: "dates",
      days: ["2026-07-15", "2026-07-17"],
      tz: "UTC",
    });
    expect(w.start).toBe(Date.UTC(2026, 6, 15));
    expect(w.end).toBe(Date.UTC(2026, 6, 18)); // last day + 1
  });

  it("spans ~8 weeks from now for a weekday poll", () => {
    const now = new Date(Date.UTC(2026, 6, 1));
    const w = overlayWindow(
      { kind: "weekdays", days: ["mon"], tz: "UTC" },
      now,
    );
    expect(w.end - w.start).toBe(56 * 86_400_000);
  });
});
