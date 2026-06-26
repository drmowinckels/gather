import { describe, it, expect } from "vitest";
import { pollToTemplate } from "./duplicate";
import type { Poll } from "./api";

function makePoll(overrides: Partial<Poll> = {}): Poll {
  return {
    id: "p1",
    title: "Team offsite",
    kind: "dates",
    days: ["2026-07-15", "2026-07-16"],
    from: "09:00",
    to: "17:00",
    slot: 30,
    tz: "Europe/Oslo",
    public: false,
    resultsHidden: true,
    deadline: null,
    closedAt: null,
    closed: false,
    lockedSlot: "2026-07-15T09:00",
    expiresAt: "2026-07-30",
    createdAt: "2026-07-01T00:00:00Z",
    responses: [],
    ...overrides,
  };
}

describe("pollToTemplate", () => {
  it("carries the reusable settings and drops specific calendar dates", () => {
    const t = pollToTemplate(makePoll());
    expect(t).toEqual({
      title: "Team offsite",
      kind: "dates",
      days: [],
      from: "09:00",
      to: "17:00",
      slot: 30,
      tz: "Europe/Oslo",
      public: false,
      resultsHidden: true,
    });
  });

  it("keeps recurring weekday tokens", () => {
    const t = pollToTemplate(
      makePoll({ kind: "weekdays", days: ["mon", "wed"] }),
    );
    expect(t.days).toEqual(["mon", "wed"]);
  });
});
