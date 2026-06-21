import { describe, it, expect } from "vitest";
import { rankSlots } from "../src/aggregate";

const responses = [
  { name: "Ada", slots: ["2026-07-15T09:00", "2026-07-15T09:30"], maybe: [] },
  { name: "Kari", slots: ["2026-07-15T09:00"], maybe: ["2026-07-15T09:30"] },
  { name: "Sam", slots: ["2026-07-15T09:00"], maybe: [] },
];

describe("rankSlots", () => {
  it("counts available and maybe separately, with names", () => {
    const { total, results } = rankSlots(responses);
    expect(total).toBe(3);
    expect(results[0]).toEqual({
      slot: "2026-07-15T09:00",
      count: 3,
      names: ["Ada", "Kari", "Sam"],
      maybe: 0,
      maybeNames: [],
    });
    const second = results[1];
    expect(second.slot).toBe("2026-07-15T09:30");
    expect(second.count).toBe(1); // Ada available
    expect(second.maybe).toBe(1); // Kari maybe
    expect(second.maybeNames).toEqual(["Kari"]);
  });

  it("ranks available first, then available+maybe as a tiebreak", () => {
    const r = rankSlots([
      { name: "A", slots: ["d1"], maybe: ["d2"] },
      { name: "B", slots: ["d2"], maybe: [] }, // d2: 1 available
      { name: "C", slots: ["d1"], maybe: [] }, // d1: 2 available
    ]);
    // d1 has 2 available, d2 has 1 available (+1 maybe) -> d1 first
    expect(r.results.map((x) => x.slot)).toEqual(["d1", "d2"]);
  });

  it("includes maybe-only slots (below any available slot)", () => {
    const r = rankSlots([{ name: "A", slots: [], maybe: ["x"] }]);
    expect(r.results).toHaveLength(1);
    expect(r.results[0]).toMatchObject({ slot: "x", count: 0, maybe: 1 });
  });

  it("handles no responses", () => {
    expect(rankSlots([])).toEqual({ total: 0, results: [] });
  });
});
