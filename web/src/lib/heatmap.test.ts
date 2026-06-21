import { describe, it, expect } from "vitest";
import { aggregate } from "./heatmap";
import { formatSlotLabel } from "./datetime";
import type { PollResponse } from "./api";

const r = (name: string, slots: string[], maybe: string[] = []): PollResponse => ({
  name,
  tz: "UTC",
  slots,
  maybe,
  updatedAt: "2026-07-01T00:00:00Z",
});

describe("aggregate", () => {
  it("counts available + maybe per slot, ranks, and picks the best", () => {
    const agg = aggregate([
      r("Ada", ["2026-07-15T09:00", "2026-07-15T09:30"]),
      r("Kari", ["2026-07-15T09:00"], ["2026-07-15T09:30"]),
      r("Sam", ["2026-07-15T09:00"]),
    ]);
    expect(agg.total).toBe(3);
    expect(agg.bestKey).toBe("2026-07-15T09:00");
    expect(agg.cells.get("2026-07-15T09:00")).toEqual({
      count: 3,
      names: ["Ada", "Kari", "Sam"],
      maybe: 0,
      maybeNames: [],
    });
    expect(agg.cells.get("2026-07-15T09:30")).toMatchObject({
      count: 1,
      maybe: 1,
      maybeNames: ["Kari"],
    });
  });

  it("includes maybe-only slots and is empty with no marks", () => {
    expect(aggregate([r("A", [], ["x"])]).ranked).toHaveLength(1);
    const none = aggregate([r("A", [], [])]);
    expect(none).toMatchObject({ total: 1, bestKey: null });
    expect(none.ranked).toEqual([]);
  });
});

describe("formatSlotLabel", () => {
  it("renders a human label from a slot key", () => {
    expect(formatSlotLabel("2026-07-15T12:00")).toBe("Wed 15, 12:00");
  });
});
