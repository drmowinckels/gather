import { describe, it, expect } from "vitest";
import { buildOverlapBand, overlapHourSet } from "./overlap";
import type { OverlapResult } from "@samkoma/core";

describe("buildOverlapBand", () => {
  it("anchors columns to home-tz hours and shows each zone's local hour", () => {
    // Home Abidjan (+0). At home 00:00, Tokyo (+9) is 09:00 and Dubai (+4) 04:00.
    const band = buildOverlapBand(
      ["Asia/Tokyo", "Asia/Dubai"],
      "09:00",
      "17:00",
      "Africa/Abidjan",
      "2026-06-29",
    );
    expect(band.hours).toHaveLength(24);
    expect(band.rows.map((r) => r.zone)).toEqual(["Asia/Tokyo", "Asia/Dubai"]);
    expect(band.rows[0].cells[0].hour).toBe(9); // Tokyo at home midnight
    expect(band.rows[1].cells[0].hour).toBe(4); // Dubai at home midnight
  });

  it("carries the host's own working hours on the home axis", () => {
    const band = buildOverlapBand(
      ["Asia/Tokyo"],
      "09:00",
      "17:00",
      "Asia/Dubai",
      "2026-06-29",
    );
    // The home row works 09:00-16:00 → only those columns are in-window.
    expect(band.homeCells[8].inWindow).toBe(false);
    expect(band.homeCells[9].inWindow).toBe(true);
    expect(band.homeCells[16].inWindow).toBe(true);
    expect(band.homeCells[17].inWindow).toBe(false);
  });

  it("marks a zone's own working hours as in-window", () => {
    const band = buildOverlapBand(
      ["Asia/Tokyo"],
      "09:00",
      "17:00",
      "Africa/Abidjan",
      "2026-06-29",
    );
    // Tokyo works 09:00-16:00 local = home 00:00-07:00.
    expect(band.rows[0].cells[0].inWindow).toBe(true); // home 00 → Tokyo 09
    expect(band.rows[0].cells[7].inWindow).toBe(true); // home 07 → Tokyo 16
    expect(band.rows[0].cells[8].inWindow).toBe(false); // home 08 → Tokyo 17
  });
});

describe("overlapHourSet", () => {
  const result = (over: Partial<OverlapResult>): OverlapResult => ({
    from: null,
    to: null,
    empty: false,
    wraps: false,
    durationMin: 0,
    ...over,
  });

  it("maps a window to the home-tz hour columns it covers", () => {
    const set = overlapHourSet(result({ from: "15:00", to: "17:00" }));
    expect(set.flatMap((on, h) => (on ? [h] : []))).toEqual([15, 16]);
  });

  it("is all-false for an empty result", () => {
    const set = overlapHourSet(result({ empty: true }));
    expect(set.some(Boolean)).toBe(false);
  });

  it("handles a window that wraps past midnight", () => {
    const set = overlapHourSet(
      result({ from: "22:00", to: "02:00", wraps: true }),
    );
    expect(set.flatMap((on, h) => (on ? [h] : []))).toEqual([0, 1, 22, 23]);
  });
});
