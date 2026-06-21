import { describe, it, expect } from "vitest";
import {
  cycleNext,
  applyMark,
  marksFrom,
  splitMarks,
  type Marks,
} from "./paint";
import { timeSlots, slotKey, hourLabel } from "./datetime";

describe("paint cycle", () => {
  it("cycles busy -> yes -> maybe -> busy", () => {
    expect(cycleNext(undefined)).toBe("yes");
    expect(cycleNext("yes")).toBe("maybe");
    expect(cycleNext("maybe")).toBeUndefined();
  });

  it("applyMark sets/clears without mutating the input", () => {
    const start: Marks = new Map([["a", "yes"]]);
    const withMaybe = applyMark(start, "b", "maybe");
    expect([...withMaybe.entries()].sort()).toEqual([
      ["a", "yes"],
      ["b", "maybe"],
    ]);
    expect([...start.entries()]).toEqual([["a", "yes"]]); // unchanged

    const cleared = applyMark(withMaybe, "a", undefined);
    expect(cleared.has("a")).toBe(false);
  });

  it("round-trips through marksFrom / splitMarks (yes wins a duplicate)", () => {
    const marks = marksFrom(["x"], ["y", "x"]); // x is also available -> stays yes
    expect(marks.get("x")).toBe("yes");
    expect(marks.get("y")).toBe("maybe");
    const { slots, maybe } = splitMarks(marks);
    expect(slots).toEqual(["x"]);
    expect(maybe).toEqual(["y"]);
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
  });
});
