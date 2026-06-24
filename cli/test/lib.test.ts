import { describe, it, expect } from "vitest";
import {
  resolveDays,
  parseSlot,
  parseTime,
  parseDeadline,
  buildCreateBody,
  buildEditBody,
} from "../src/lib";

const today = new Date(2026, 5, 20); // local midnight, weekday-agnostic anchor
const dayMs = 86_400_000;

function weekday(iso: string): number {
  return new Date(`${iso}T00:00:00`).getDay(); // 0=Sun … 6=Sat
}
function daysFromToday(iso: string): number {
  const d = new Date(`${iso}T00:00:00`);
  const base = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  return Math.round((d.getTime() - base.getTime()) / dayMs);
}

describe("resolveDays", () => {
  it("passes through ISO dates, sorted and de-duplicated", () => {
    expect(resolveDays("2026-07-16, 2026-07-15, 2026-07-15", today)).toEqual([
      "2026-07-15",
      "2026-07-16",
    ]);
  });

  it("resolves a weekday to its next upcoming occurrence", () => {
    const [d] = resolveDays("mon", today);
    expect(weekday(d)).toBe(1); // Monday
    expect(daysFromToday(d)).toBeGreaterThanOrEqual(0);
    expect(daysFromToday(d)).toBeLessThan(7);
  });

  it("expands a weekday range to each day", () => {
    const days = resolveDays("mon-fri", today);
    expect(days).toHaveLength(5);
    expect(days.map(weekday).sort()).toEqual([1, 2, 3, 4, 5]);
    expect([...days]).toEqual([...days].sort()); // already sorted
  });

  it("mixes ISO dates and weekdays", () => {
    expect(resolveDays("2026-12-31,wed", today).length).toBe(2);
  });

  it("rejects unknown tokens and backwards ranges", () => {
    expect(() => resolveDays("funday", today)).toThrow();
    expect(() => resolveDays("fri-mon", today)).toThrow();
    expect(() => resolveDays("", today)).toThrow();
  });
});

describe("parseSlot", () => {
  it("accepts 15/30/60 with optional trailing m", () => {
    expect(parseSlot("30m")).toBe(30);
    expect(parseSlot("60")).toBe(60);
    expect(parseSlot("15")).toBe(15);
  });
  it("rejects other sizes", () => {
    expect(() => parseSlot("45")).toThrow();
  });
});

describe("parseTime", () => {
  it("accepts HH:MM and rejects junk", () => {
    expect(parseTime("09:00", "--from")).toBe("09:00");
    expect(() => parseTime("9:00", "--from")).toThrow();
    expect(() => parseTime("25:00", "--to")).toThrow();
  });
});

describe("buildCreateBody", () => {
  it("builds a valid poll body with defaults", () => {
    const body = buildCreateBody(
      {
        title: "  Team offsite ",
        days: "2026-07-15",
        tz: "Europe/Oslo",
        public: true,
      },
      today,
    );
    expect(body).toEqual({
      title: "Team offsite",
      kind: "dates",
      days: ["2026-07-15"],
      from: "09:00",
      to: "17:00",
      slot: 30,
      tz: "Europe/Oslo",
      public: true,
      resultsHidden: false,
    });
  });

  it("keeps weekday tokens (no date resolution) when weekdays is set", () => {
    const body = buildCreateBody({
      title: "Standup",
      days: "mon-wed",
      tz: "UTC",
      public: false,
      weekdays: true,
    });
    expect(body.kind).toBe("weekdays");
    expect(body.days).toEqual(["mon", "tue", "wed"]);
  });

  it("normalizes --deadline to ISO and rejects junk", () => {
    expect(parseDeadline("2099-07-10T17:00:00Z")).toBe(
      "2099-07-10T17:00:00.000Z",
    );
    expect(() => parseDeadline("not-a-date")).toThrow(/deadline/i);
    const body = buildCreateBody(
      {
        title: "x",
        days: "mon",
        tz: "UTC",
        public: true,
        deadline: "2099-07-10T17:00:00Z",
      },
      today,
    );
    expect(body.deadline).toBe("2099-07-10T17:00:00.000Z");
  });

  it("sets resultsHidden from --hide-results", () => {
    const body = buildCreateBody(
      { title: "x", days: "mon", tz: "UTC", public: true, hideResults: true },
      today,
    );
    expect(body.resultsHidden).toBe(true);
  });

  it("rejects an empty title and an inverted time range", () => {
    expect(() =>
      buildCreateBody(
        { title: "  ", days: "mon", tz: "UTC", public: false },
        today,
      ),
    ).toThrow();
    expect(() =>
      buildCreateBody(
        {
          title: "x",
          days: "mon",
          from: "15:00",
          to: "09:00",
          tz: "UTC",
          public: false,
        },
        today,
      ),
    ).toThrow();
  });
});

describe("buildEditBody", () => {
  it("includes only the fields that were passed", () => {
    expect(buildEditBody({ title: "  Renamed " }, today)).toEqual({
      title: "Renamed",
    });
    expect(buildEditBody({ days: "2026-07-15,2026-07-16" }, today)).toEqual({
      days: ["2026-07-15", "2026-07-16"],
    });
    expect(buildEditBody({ from: "08:00" }, today)).toEqual({ from: "08:00" });
    expect(buildEditBody({ public: true }, today)).toEqual({ public: true });
    expect(buildEditBody({ public: false }, today)).toEqual({ public: false });
    expect(buildEditBody({ resultsHidden: true }, today)).toEqual({
      resultsHidden: true,
    });
    expect(buildEditBody({ resultsHidden: false }, today)).toEqual({
      resultsHidden: false,
    });
  });

  it("throws when nothing is passed", () => {
    expect(() => buildEditBody({}, today)).toThrow();
  });

  it("validates an inverted range only when both ends are given", () => {
    expect(() =>
      buildEditBody({ from: "15:00", to: "09:00" }, today),
    ).toThrow();
    expect(buildEditBody({ from: "20:00" }, today)).toEqual({ from: "20:00" }); // server checks vs existing 'to'
  });

  it("rejects an empty title and a bad slot", () => {
    expect(() => buildEditBody({ title: "   " }, today)).toThrow();
    expect(() => buildEditBody({ slot: "45" }, today)).toThrow();
  });
});
