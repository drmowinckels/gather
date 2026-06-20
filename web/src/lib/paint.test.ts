import { describe, it, expect } from "vitest";
import { modeFor, applyPaint } from "./paint";
import { timeSlots, slotKey, hourLabel } from "./datetime";

describe("paint", () => {
  it("fills from a busy cell and erases from a free cell", () => {
    expect(modeFor(new Set(), "k")).toBe("fill");
    expect(modeFor(new Set(["k"]), "k")).toBe("erase");
  });

  it("applyPaint adds or removes without mutating the input", () => {
    const start = new Set(["a"]);
    const filled = applyPaint(start, "b", "fill");
    expect([...filled].sort()).toEqual(["a", "b"]);
    expect([...start]).toEqual(["a"]); // unchanged

    const erased = applyPaint(filled, "a", "erase");
    expect([...erased]).toEqual(["b"]);
  });
});

describe("slot helpers", () => {
  it("generates block start times", () => {
    expect(timeSlots("09:00", "11:00", 30)).toEqual([
      "09:00",
      "09:30",
      "10:00",
      "10:30",
    ]);
  });

  it("builds a slot key and labels only the hour", () => {
    expect(slotKey("2026-07-15", "09:30")).toBe("2026-07-15T09:30");
    expect(hourLabel("09:00")).toBe("9am");
    expect(hourLabel("09:30")).toBe("");
    expect(hourLabel("12:00")).toBe("12pm");
    expect(hourLabel("13:00")).toBe("1pm");
  });
});
