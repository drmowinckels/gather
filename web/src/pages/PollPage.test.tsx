import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Routes, Route, useLocation } from "react-router-dom";
import type { Poll } from "../lib/api";

const getPoll = vi.fn();
const editPoll = vi.fn();
vi.mock("../lib/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../lib/api")>()),
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
  deadline: null,
  closedAt: null,
  closed: false,
  lockedSlot: null,
  expiresAt: null,
  capacity: null,
  defaultAvailable: false,
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

  it("lets the host close the poll", async () => {
    localStorage.setItem("samkoma:edit:p1", "tok");
    getPoll.mockResolvedValue({ ...hiddenPoll, resultsHidden: false });
    editPoll.mockResolvedValue({
      ...hiddenPoll,
      resultsHidden: false,
      closed: true,
      closedAt: "2099-01-02T00:00:00Z",
    });
    const user = userEvent.setup();
    renderAt();

    const close = await screen.findByRole("button", { name: /close now/i });
    await user.click(close);
    await waitFor(() =>
      expect(editPoll).toHaveBeenCalledWith("p1", { closed: true }, "tok"),
    );
  });

  it("toggles a share QR code", async () => {
    getPoll.mockResolvedValue({ ...hiddenPoll, resultsHidden: false });
    const user = userEvent.setup();
    renderAt();

    const qrBtn = await screen.findByRole("button", { name: /^qr$/i });
    await user.click(qrBtn);
    expect(
      screen.getByRole("img", { name: /qr code linking to this poll/i }),
    ).toBeTruthy();
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

function NewProbe() {
  const loc = useLocation();
  const template = (loc.state as { template?: { title?: string } } | null)
    ?.template;
  return (
    <div data-testid="new-page">
      {template ? `dup:${template.title}` : "fresh"}
    </div>
  );
}

describe("PollPage duplicate", () => {
  it("navigates to /new with a template built from the poll", async () => {
    getPoll.mockResolvedValue({ ...hiddenPoll, resultsHidden: false });
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={["/e/p1"]}>
        <Routes>
          <Route path="/e/:id" element={<PollPage />} />
          <Route path="/new" element={<NewProbe />} />
        </Routes>
      </MemoryRouter>,
    );

    const dup = await screen.findByRole("button", { name: /duplicate/i });
    await user.click(dup);

    expect(await screen.findByTestId("new-page")).toHaveTextContent(
      "dup:Team offsite",
    );
  });
});
