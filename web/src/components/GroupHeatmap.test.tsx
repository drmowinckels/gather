import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { GroupHeatmap } from "./GroupHeatmap";
import type { Poll, PollResponse } from "../lib/api";

function makePoll(responses: PollResponse[]): Poll {
  return {
    id: "p1",
    title: "Test",
    kind: "dates",
    days: ["2026-07-15"], // a Wednesday
    from: "09:00",
    to: "11:00",
    slot: 30,
    tz: "UTC",
    public: true,
    resultsHidden: false,
    lockedSlot: null,
    expiresAt: null,
    createdAt: "2026-07-01T00:00:00Z",
    responses,
  };
}

describe("GroupHeatmap", () => {
  it("shows the empty state (no crash) when responses have no painted slots", () => {
    const responses = [
      { name: "Ada", tz: "UTC", slots: [], maybe: [], updatedAt: "" },
    ];
    render(<GroupHeatmap poll={makePoll(responses)} viewerTz="UTC" />);
    expect(screen.getByText("No availability yet")).toBeInTheDocument();
  });

  it("renders the best slot when there is availability", () => {
    const responses = [
      {
        name: "Ada",
        tz: "UTC",
        slots: ["2026-07-15T09:00"],
        maybe: [],
        updatedAt: "",
      },
    ];
    render(<GroupHeatmap poll={makePoll(responses)} viewerTz="UTC" />);
    // appears in the best-slot card and the hovered/best detail panel
    expect(screen.getAllByText(/Wed 15, 09:00/).length).toBeGreaterThan(0);
    expect(screen.getByText("Available · 1")).toBeInTheDocument();
  });
});
