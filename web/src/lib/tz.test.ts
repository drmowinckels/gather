import { describe, it, expect } from "vitest";
import {
  zonedTimeToUtc,
  partsInTz,
  buildGridView,
  formatSlotLabelInTz,
  existsInTz,
} from "./tz";

describe("zonedTimeToUtc", () => {
  it("interprets a wall time in a zone (summer DST offset)", () => {
    // 2026-07-15 is CEST (UTC+2): 12:00 Oslo == 10:00 UTC
    expect(
      zonedTimeToUtc("2026-07-15", "12:00", "Europe/Oslo").toISOString(),
    ).toBe("2026-07-15T10:00:00.000Z");
  });

  it("handles a fractional-offset zone (+05:30)", () => {
    // 12:00 Asia/Kolkata == 06:30 UTC
    expect(
      zonedTimeToUtc("2026-07-15", "12:00", "Asia/Kolkata").toISOString(),
    ).toBe("2026-07-15T06:30:00.000Z");
  });

  it("treats UTC as identity", () => {
    expect(zonedTimeToUtc("2026-01-01", "09:00", "UTC").toISOString()).toBe(
      "2026-01-01T09:00:00.000Z",
    );
  });

  it("uses each date's own DST offset (winter = CET +1, not summer +2)", () => {
    // Same wall time, two dates: Oslo is +1 in January, +2 in July.
    expect(
      zonedTimeToUtc("2026-01-15", "12:00", "Europe/Oslo").toISOString(),
    ).toBe("2026-01-15T11:00:00.000Z");
    expect(
      zonedTimeToUtc("2026-07-15", "12:00", "Europe/Oslo").toISOString(),
    ).toBe("2026-07-15T10:00:00.000Z");
  });
});

describe("partsInTz", () => {
  it("renders a UTC instant in a target zone, crossing the day boundary", () => {
    // 06:30 UTC in New York (EDT, -4) == previous day 02:30
    const inst = new Date("2026-07-15T06:30:00.000Z");
    expect(partsInTz(inst, "America/New_York")).toEqual({
      date: "2026-07-15",
      time: "02:30",
    });
    // 02:00 UTC in New York == previous calendar day 22:00
    expect(
      partsInTz(new Date("2026-07-15T02:00:00.000Z"), "America/New_York"),
    ).toEqual({ date: "2026-07-14", time: "22:00" });
  });
});

describe("buildGridView", () => {
  it("is the identity grid when viewer tz equals poll tz", () => {
    const v = buildGridView(
      "dates",
      ["2026-07-15"],
      "09:00",
      "10:00",
      30,
      "Europe/Oslo",
      "Europe/Oslo",
    );
    expect(v.days).toEqual(["2026-07-15"]);
    expect(v.times).toEqual(["09:00", "09:30"]);
    expect(v.keyAt("2026-07-15", "09:00")).toBe("2026-07-15T09:00");
  });

  it("shifts local times but maps cells back to canonical keys (Oslo poll → NY viewer)", () => {
    const v = buildGridView(
      "dates",
      ["2026-07-15"],
      "12:00",
      "13:00",
      30,
      "Europe/Oslo",
      "America/New_York",
    );
    // 12:00 Oslo (CEST) == 06:00 New York (EDT)
    expect(v.times).toEqual(["06:00", "06:30"]);
    expect(v.keyAt("2026-07-15", "06:00")).toBe("2026-07-15T12:00");
    expect(v.keyAt("2026-07-15", "06:30")).toBe("2026-07-15T12:30");
    // a cell with no canonical slot is a gap
    expect(v.keyAt("2026-07-15", "09:00")).toBeNull();
  });

  it("converts each day with its own DST offset across a poll that spans seasons", () => {
    // A poll listing a winter and a summer day, viewed from UTC: the SAME poll
    // wall-time (12:00 Oslo) lands at different UTC times per date — proving the
    // conversion is per-date DST-aware, not a single fixed shift.
    const v = buildGridView(
      "dates",
      ["2026-01-15", "2026-07-15"],
      "12:00",
      "12:30",
      30,
      "Europe/Oslo",
      "UTC",
    );
    // Jan 12:00 Oslo (CET +1) -> 11:00 UTC; Jul 12:00 Oslo (CEST +2) -> 10:00 UTC
    expect(v.keyAt("2026-01-15", "11:00")).toBe("2026-01-15T12:00");
    expect(v.keyAt("2026-07-15", "10:00")).toBe("2026-07-15T12:00");
    // and not the other way around
    expect(v.keyAt("2026-01-15", "10:00")).toBeNull();
    expect(v.keyAt("2026-07-15", "11:00")).toBeNull();
  });

  it("drops slots that fall in a spring-forward gap (same tz)", () => {
    // 2026-03-29 Europe/Oslo: clocks jump 02:00 -> 03:00, so 02:00/02:30 vanish.
    const v = buildGridView(
      "dates",
      ["2026-03-29"],
      "01:00",
      "04:00",
      30,
      "Europe/Oslo",
      "Europe/Oslo",
    );
    expect(v.keyAt("2026-03-29", "01:30")).toBe("2026-03-29T01:30");
    expect(v.keyAt("2026-03-29", "02:00")).toBeNull();
    expect(v.keyAt("2026-03-29", "02:30")).toBeNull();
    expect(v.keyAt("2026-03-29", "03:00")).toBe("2026-03-29T03:00");
    expect(v.keyAt("2026-03-29", "03:30")).toBe("2026-03-29T03:30");
  });

  it("pushes slots onto the previous local day when the offset crosses midnight", () => {
    // 00:00–00:30 Oslo (CEST, +2) == 22:00–22:30 the previous day in UTC
    const v = buildGridView(
      "dates",
      ["2026-07-15"],
      "00:00",
      "01:00",
      30,
      "Europe/Oslo",
      "UTC",
    );
    expect(v.days).toEqual(["2026-07-14"]);
    expect(v.keyAt("2026-07-14", "22:00")).toBe("2026-07-15T00:00");
  });
});

describe("existsInTz", () => {
  it("is true for a normal wall time and false inside a spring-forward gap", () => {
    expect(existsInTz("2026-03-29", "01:30", "Europe/Oslo")).toBe(true);
    expect(existsInTz("2026-03-29", "02:30", "Europe/Oslo")).toBe(false);
    expect(existsInTz("2026-03-29", "03:30", "Europe/Oslo")).toBe(true);
  });
});

describe("formatSlotLabelInTz", () => {
  it("relabels a canonical slot in the viewer's zone", () => {
    // 2026-07-15 12:00 Oslo -> 06:00 New York, same calendar day (Wed 15)
    expect(
      formatSlotLabelInTz(
        "2026-07-15T12:00",
        "dates",
        "Europe/Oslo",
        "America/New_York",
      ),
    ).toBe("Wed 15, 06:00");
  });

  it("keeps the poll-tz label when zones match", () => {
    expect(formatSlotLabelInTz("2026-07-15T12:00", "dates", "UTC", "UTC")).toBe(
      "Wed 15, 12:00",
    );
  });
});

describe("weekday polls", () => {
  it("builds a timezone-naive weekday grid with localized headers", () => {
    const v = buildGridView(
      "weekdays",
      ["mon", "wed"],
      "09:00",
      "10:00",
      30,
      "Europe/Oslo",
      "America/New_York", // ignored for weekday polls
    );
    expect(v.days).toEqual(["mon", "wed"]);
    expect(v.dayLabels).toEqual(["Mon", "Wed"]);
    expect(v.keyAt("mon", "09:30")).toBe("monT09:30");
  });

  it("labels a weekday slot key without tz conversion", () => {
    expect(
      formatSlotLabelInTz("monT09:00", "weekdays", "Europe/Oslo", "UTC"),
    ).toBe("Mon 09:00");
  });
});
