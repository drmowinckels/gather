import { describe, it, expect } from "vitest";
import { timeSlots, validSlotKeys } from "@samkoma/core";

describe("timeSlots", () => {
  it("returns block start times within [from, to)", () => {
    expect(timeSlots("09:00", "11:00", 30)).toEqual([
      "09:00",
      "09:30",
      "10:00",
      "10:30",
    ]);
  });

  it("excludes a trailing partial block", () => {
    expect(timeSlots("09:00", "10:00", 45)).toEqual(["09:00"]);
  });

  it("supports 60-minute slots", () => {
    expect(timeSlots("09:00", "12:00", 60)).toEqual([
      "09:00",
      "10:00",
      "11:00",
    ]);
  });
});

describe("validSlotKeys", () => {
  it("is the cross product of days and slot times", () => {
    const keys = validSlotKeys(
      ["2026-07-15", "2026-07-16"],
      "09:00",
      "10:00",
      30,
    );
    expect(keys).toEqual(
      new Set([
        "2026-07-15T09:00",
        "2026-07-15T09:30",
        "2026-07-16T09:00",
        "2026-07-16T09:30",
      ]),
    );
  });
});
