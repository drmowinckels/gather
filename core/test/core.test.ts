import { describe, it, expect } from "vitest";
import {
  resolveDays,
  parseWeekdays,
  timeSlots,
  minutesToTime,
  validSlotKeys,
  slotKey,
  tallySlots,
  rankCells,
  responsesToCsv,
  csvFilename,
} from "../src/index";

describe("resolveDays", () => {
  const today = new Date(2026, 5, 20); // Sat 2026-06-20

  it("dedupes and sorts ISO dates", () => {
    expect(resolveDays("2026-07-16,2026-07-15,2026-07-15", today)).toEqual([
      "2026-07-15",
      "2026-07-16",
    ]);
  });

  it("expands a weekday range to the next upcoming occurrences", () => {
    const days = resolveDays("mon-fri", today);
    expect(days).toHaveLength(5);
    expect(days.map((d) => new Date(`${d}T00:00:00`).getDay()).sort()).toEqual([
      1, 2, 3, 4, 5,
    ]);
  });

  it("throws on an unknown token or inverted range", () => {
    expect(() => resolveDays("nope", today)).toThrow();
    expect(() => resolveDays("fri-mon", today)).toThrow(/range/i);
  });
});

describe("parseWeekdays", () => {
  it("keeps weekday tokens (not dates), deduped and week-ordered", () => {
    expect(parseWeekdays("fri,mon,mon")).toEqual(["mon", "fri"]);
    expect(parseWeekdays("mon-fri")).toEqual([
      "mon",
      "tue",
      "wed",
      "thu",
      "fri",
    ]);
  });

  it("throws on unknown weekday or inverted range", () => {
    expect(() => parseWeekdays("funday")).toThrow(/weekday/i);
    expect(() => parseWeekdays("fri-mon")).toThrow(/range/i);
  });
});

describe("slot grid", () => {
  it("steps start times within [from, to)", () => {
    expect(timeSlots("09:00", "10:30", 30)).toEqual([
      "09:00",
      "09:30",
      "10:00",
    ]);
    expect(timeSlots("09:00", "09:00", 30)).toEqual([]);
  });

  it("formats minutes-after-midnight as HH:MM", () => {
    expect(minutesToTime(0)).toBe("00:00");
    expect(minutesToTime(540)).toBe("09:00");
    expect(minutesToTime(1439)).toBe("23:59");
  });

  it("builds every valid slot key across days", () => {
    const keys = validSlotKeys(
      ["2026-07-15", "2026-07-16"],
      "09:00",
      "10:00",
      30,
    );
    expect(keys.size).toBe(4);
    expect(keys.has(slotKey("2026-07-15", "09:30"))).toBe(true);
    expect(keys.has(slotKey("2026-07-15", "10:00"))).toBe(false); // 10:00 has no full slot before 10:00 end
  });

  it("builds weekday keys when days are weekday tokens (kind-agnostic)", () => {
    const keys = validSlotKeys(["mon", "wed"], "09:00", "10:00", 30);
    expect(keys.size).toBe(4);
    expect(keys.has("monT09:00")).toBe(true);
    expect(keys.has("wedT09:30")).toBe(true);
  });
});

describe("ranking", () => {
  const responses = [
    { name: "Ada", slots: ["2026-07-15T09:00", "2026-07-15T09:30"], maybe: [] },
    { name: "Kari", slots: ["2026-07-15T09:00"], maybe: ["2026-07-15T09:30"] },
  ];

  it("ranks by available, then available-or-maybe, then earliest", () => {
    const ranked = rankCells(tallySlots(responses));
    expect(ranked[0]).toMatchObject({
      slot: "2026-07-15T09:00",
      count: 2,
      names: ["Ada", "Kari"],
    });
    expect(ranked[1]).toMatchObject({
      slot: "2026-07-15T09:30",
      count: 1,
      maybe: 1,
      maybeNames: ["Kari"],
    });
  });
});

describe("responsesToCsv", () => {
  it("emits a tidy row per painted slot, ordered by slot then status then name", () => {
    const csv = responsesToCsv([
      {
        name: "Ada",
        slots: ["2026-07-15T09:00", "2026-07-15T09:30"],
        maybe: [],
        group: "Eng",
      },
      {
        name: "Kari",
        slots: ["2026-07-15T09:00"],
        maybe: ["2026-07-15T09:30"],
      },
    ]);
    expect(csv).toBe(
      "name,slot,status,group\r\n" +
        "Ada,2026-07-15T09:00,available,Eng\r\n" +
        "Kari,2026-07-15T09:00,available,\r\n" +
        "Ada,2026-07-15T09:30,available,Eng\r\n" +
        "Kari,2026-07-15T09:30,maybe,\r\n",
    );
  });

  it("quotes fields with commas, quotes or newlines (RFC 4180)", () => {
    const csv = responsesToCsv([
      { name: 'O"Hara, Inc', slots: ["2026-07-15T09:00"] },
    ]);
    expect(csv).toContain('"O""Hara, Inc",2026-07-15T09:00,available');
  });

  it("returns just the header when there are no painted slots", () => {
    expect(responsesToCsv([{ name: "Ada", slots: [], maybe: [] }])).toBe(
      "name,slot,status,group\r\n",
    );
  });
});

describe("csvFilename", () => {
  it("slugs the title into a safe -availability.csv name", () => {
    expect(csvFilename("Team Offsite — September!")).toBe(
      "team-offsite-september-availability.csv",
    );
  });

  it("falls back to a default for an empty slug", () => {
    expect(csvFilename("✨")).toBe("poll-availability.csv");
  });
});
