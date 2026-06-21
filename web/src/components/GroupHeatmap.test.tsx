import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { GroupHeatmap } from "./GroupHeatmap";
import type { Poll, PollResponse } from "../lib/api";

function makePoll(responses: PollResponse[]): Poll {
  return {
    id: "p1",
    title: "Test",
    days: ["2026-07-15"], // a Wednesday
    from: "09:00",
    to: "11:00",
    slot: 30,
    tz: "UTC",
    public: true,
    lockedSlot: null,
    expiresAt: null,
    createdAt: "2026-07-01T00:00:00Z",
    responses,
  };
}

describe("GroupHeatmap", () => {
  it("shows the empty state (no crash) when responses have no painted slots", () => {
    const responses = [{ name: "Ada", tz: "UTC", slots: [], updatedAt: "" }];
    render(<GroupHeatmap poll={makePoll(responses)} viewerTz="UTC" />);
    expect(screen.getByText("No availability yet")).toBeInTheDocument();
  });

  it("renders the best slot when there is availability", () => {
    const responses = [
      { name: "Ada", tz: "UTC", slots: ["2026-07-15T09:00"], updatedAt: "" },
    ];
    render(<GroupHeatmap poll={makePoll(responses)} viewerTz="UTC" />);
    expect(screen.getByText(/Wed 15, 09:00/)).toBeInTheDocument();
  });
});
