import { describe, it, expect } from "vitest";
import {
  zonedTimeToUtc,
  partsInTz,
  buildGridView,
  formatSlotLabelInTz,
} from "./tz";

describe("zonedTimeToUtc", () => {
  it("interprets a wall time in a zone (summer DST offset)", () => {
    // 2026-07-15 is CEST (UTC+2): 12:00 Oslo == 10:00 UTC
    expect(zonedTimeToUtc("2026-07-15", "12:00", "Europe/Oslo").toISOString()).toBe(
      "2026-07-15T10:00:00.000Z",
    );
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
    expect(partsInTz(new Date("2026-07-15T02:00:00.000Z"), "America/New_York")).toEqual(
      { date: "2026-07-14", time: "22:00" },
    );
  });
});

describe("buildGridView", () => {
  it("is the identity grid when viewer tz equals poll tz", () => {
    const v = buildGridView(
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

  it("pushes slots onto the previous local day when the offset crosses midnight", () => {
    // 00:00–00:30 Oslo (CEST, +2) == 22:00–22:30 the previous day in UTC
    const v = buildGridView(
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

describe("formatSlotLabelInTz", () => {
  it("relabels a canonical slot in the viewer's zone", () => {
    // 2026-07-15 12:00 Oslo -> 06:00 New York, same calendar day (Wed 15)
    expect(
      formatSlotLabelInTz("2026-07-15T12:00", "Europe/Oslo", "America/New_York"),
    ).toBe("Wed 15, 06:00");
  });

  it("keeps the poll-tz label when zones match", () => {
    expect(formatSlotLabelInTz("2026-07-15T12:00", "UTC", "UTC")).toBe(
      "Wed 15, 12:00",
    );
  });
});
