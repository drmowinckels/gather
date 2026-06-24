import { describe, it, expect } from "vitest";
import { zonedTimeToUtc, partsInTz, existsInTz } from "../src/zone.js";

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
