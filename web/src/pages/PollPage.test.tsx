import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import type { Poll } from "../lib/api";

const getPoll = vi.fn();
const editPoll = vi.fn();
vi.mock("../lib/api", () => ({
  getPoll: (...a: unknown[]) => getPoll(...a),
  editPoll: (...a: unknown[]) => editPoll(...a),
  icsUrl: (id: string) => `https://api.test/v1/polls/${id}/ics`,
  ApiError: class ApiError extends Error {
    status = 0;
    code = "";
  },
}));
vi.mock("../components/GroupHeatmap", () => ({
  GroupHeatmap: () => <div data-testid="heatmap" />,
}));
vi.mock("../components/RespondPanel", () => ({
  RespondPanel: () => <div data-testid="respond" />,
}));

import { PollPage } from "./PollPage";

const hiddenPoll: Poll = {
  id: "p1",
  title: "Team offsite",
  kind: "dates",
  days: ["2099-07-15"],
  from: "09:00",
  to: "11:00",
  slot: 30,
  tz: "Europe/Oslo",
  public: true,
  resultsHidden: true,
  lockedSlot: null,
  expiresAt: null,
  createdAt: "2099-01-01T00:00:00Z",
  responses: [
    { name: "Ada", tz: "Europe/Oslo", slots: [], maybe: [], updatedAt: "x" },
  ],
};

function renderAt() {
  return render(
    <MemoryRouter initialEntries={["/e/p1"]}>
      <Routes>
        <Route path="/e/:id" element={<PollPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  localStorage.clear();
  getPoll.mockReset();
  editPoll.mockReset();
});

describe("PollPage hidden-results reveal", () => {
  it("lets the host reveal a hidden public poll", async () => {
    localStorage.setItem("samkoma:edit:p1", "tok"); // makes this viewer the host
    getPoll.mockResolvedValue(hiddenPoll);
    editPoll.mockResolvedValue({ ...hiddenPoll, resultsHidden: false });
    const user = userEvent.setup();
    renderAt();

    const reveal = await screen.findByRole("button", {
      name: /reveal results/i,
    });
    await user.click(reveal);

    await waitFor(() =>
      expect(editPoll).toHaveBeenCalledWith(
        "p1",
        { resultsHidden: false },
        "tok",
      ),
    );
  });

  it("shows the curtain (no reveal button) to a non-host", async () => {
    getPoll.mockResolvedValue(hiddenPoll); // no edit token in storage
    renderAt();

    expect(await screen.findByText(/results hidden for now/i)).toBeTruthy();
    expect(
      screen.queryByRole("button", { name: /reveal results/i }),
    ).toBeNull();
  });
});
