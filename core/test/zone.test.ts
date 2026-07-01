import { describe, it, expect } from "vitest";
import {
  zonedTimeToUtc,
  partsInTz,
  existsInTz,
  overlapWindow,
} from "../src/zone.js";

describe("zonedTimeToUtc", () => {
  it("interprets a wall time using the date's own DST offset", () => {
    // Oslo is +1 in January (CET) and +2 in July (CEST).
    expect(
      zonedTimeToUtc("2026-01-15", "12:00", "Europe/Oslo").toISOString(),
    ).toBe("2026-01-15T11:00:00.000Z");
    expect(
      zonedTimeToUtc("2026-07-15", "12:00", "Europe/Oslo").toISOString(),
    ).toBe("2026-07-15T10:00:00.000Z");
  });

  it("handles a fractional-offset zone and treats UTC as identity", () => {
    expect(
      zonedTimeToUtc("2026-07-15", "12:00", "Asia/Kolkata").toISOString(),
    ).toBe("2026-07-15T06:30:00.000Z");
    expect(zonedTimeToUtc("2026-01-01", "09:00", "UTC").toISOString()).toBe(
      "2026-01-01T09:00:00.000Z",
    );
  });
});

describe("partsInTz", () => {
  it("renders a UTC instant in a target zone across the day boundary", () => {
    expect(
      partsInTz(new Date("2026-07-15T02:00:00.000Z"), "America/New_York"),
    ).toEqual({ date: "2026-07-14", time: "22:00" });
  });
});

describe("existsInTz", () => {
  it("is false inside a spring-forward gap", () => {
    // 2026-03-29 Oslo jumps 02:00 -> 03:00, so 02:30 does not exist.
    expect(existsInTz("2026-03-29", "01:30", "Europe/Oslo")).toBe(true);
    expect(existsInTz("2026-03-29", "02:30", "Europe/Oslo")).toBe(false);
  });
});

describe("overlapWindow", () => {
  it("intersects two zones' 9-17 windows in the canonical zone", () => {
    // NY 09-17 EDT (13:00-21:00 UTC) ∩ Oslo 09-17 CEST (07:00-15:00 UTC)
    // = 13:00-15:00 UTC = 15:00-17:00 in Oslo.
    const r = overlapWindow(
      ["America/New_York", "Europe/Oslo"],
      "09:00",
      "17:00",
      ["2026-06-29"],
      "Europe/Oslo",
    );
    expect(r).toEqual({
      from: "15:00",
      to: "17:00",
      empty: false,
      wraps: false,
      durationMin: 120,
    });
  });

  it("reports empty when no instant works in every zone", () => {
    // Honolulu (-10) works 19:00-03:00 UTC, Dubai (+4) works 05:00-13:00 UTC —
    // they never coincide, even across the date line.
    const r = overlapWindow(
      ["Pacific/Honolulu", "Asia/Dubai"],
      "09:00",
      "17:00",
      ["2026-06-29"],
      "UTC",
    );
    expect(r).toMatchObject({ empty: true, from: null, to: null });
  });

  it("pairs one zone's afternoon with another's next morning", () => {
    // The classic US-west / Sydney single hour: LA 16:00 = Sydney 09:00 next
    // day, both inside 09-17. In Oslo that lands at 01:00-02:00.
    const r = overlapWindow(
      ["America/Los_Angeles", "Australia/Sydney"],
      "09:00",
      "17:00",
      ["2026-06-29"],
      "Europe/Oslo",
    );
    expect(r).toMatchObject({
      from: "01:00",
      to: "02:00",
      empty: false,
      durationMin: 60,
    });
  });

  it("returns the zone's own window for a single zone", () => {
    const r = overlapWindow(
      ["Asia/Tokyo"],
      "09:00",
      "17:00",
      ["2026-06-29"],
      "UTC",
    );
    // Tokyo +9: 09:00-17:00 local = 00:00-08:00 UTC.
    expect(r).toMatchObject({ from: "00:00", to: "08:00", wraps: false });
  });

  it("flags a window that crosses midnight in the canonical zone", () => {
    // Honolulu -10: 09:00-17:00 local = 19:00 UTC to 03:00 UTC next day.
    const r = overlapWindow(
      ["Pacific/Honolulu"],
      "09:00",
      "17:00",
      ["2026-06-29"],
      "UTC",
    );
    expect(r).toMatchObject({ from: "19:00", to: "03:00", wraps: true });
  });

  it("narrows to the hours common to both sides of a DST boundary", () => {
    // Oslo springs forward 2026-03-29. On 03-28 (CET +1) the NY∩Oslo overlap is
    // 14:00-17:00 Oslo; on 03-30 (CEST +2) it is 15:00-17:00. The intersection
    // across both days is 15:00-17:00.
    const single = overlapWindow(
      ["America/New_York", "Europe/Oslo"],
      "09:00",
      "17:00",
      ["2026-03-28"],
      "Europe/Oslo",
    );
    expect(single).toMatchObject({ from: "14:00", to: "17:00" });

    const span = overlapWindow(
      ["America/New_York", "Europe/Oslo"],
      "09:00",
      "17:00",
      ["2026-03-28", "2026-03-30"],
      "Europe/Oslo",
    );
    expect(span).toMatchObject({ from: "15:00", to: "17:00" });
  });

  it("rejects a working window where from is not before to", () => {
    expect(() =>
      overlapWindow(["UTC"], "17:00", "09:00", ["2026-06-29"], "UTC"),
    ).toThrow(/earlier than/);
  });
});
