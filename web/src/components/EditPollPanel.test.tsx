import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const editPoll = vi.fn();
vi.mock("../lib/api", () => ({
  editPoll: (...args: unknown[]) => editPoll(...args),
  ApiError: class ApiError extends Error {
    code: string;
    status: number;
    constructor(code: string, status: number) {
      super(code);
      this.code = code;
      this.status = status;
    }
  },
}));

import { EditPollPanel } from "./EditPollPanel";
import { ApiError, type Poll } from "../lib/api";

const poll: Poll = {
  id: "abc123",
  title: "Team offsite",
  kind: "dates",
  days: ["2099-07-15", "2099-07-16"],
  from: "09:00",
  to: "15:00",
  slot: 30,
  tz: "Europe/Oslo",
  public: false,
  resultsHidden: false,
  deadline: null,
  closedAt: null,
  closed: false,
  lockedSlot: null,
  expiresAt: null,
  createdAt: "2099-01-01T00:00:00Z",
  responses: [],
};

function renderPanel() {
  const onSaved = vi.fn();
  const onClose = vi.fn();
  render(
    <EditPollPanel
      poll={poll}
      editToken="tok"
      onSaved={onSaved}
      onClose={onClose}
    />,
  );
  return { onSaved, onClose };
}

beforeEach(() => {
  editPoll.mockReset();
});

describe("EditPollPanel", () => {
  it("keeps Save disabled until something changes", async () => {
    const user = userEvent.setup();
    renderPanel();
    const save = screen.getByRole("button", { name: /save changes/i });
    expect(save).toBeDisabled();

    await user.type(screen.getByLabelText("Event name"), "!");
    expect(save).toBeEnabled();
  });

  it("sends only the changed fields and reports success", async () => {
    editPoll.mockResolvedValue({ ...poll, title: "Renamed" });
    const user = userEvent.setup();
    const { onSaved, onClose } = renderPanel();

    const title = screen.getByLabelText("Event name");
    await user.clear(title);
    await user.type(title, "Renamed");
    await user.click(screen.getByRole("button", { name: /save changes/i }));

    await waitFor(() => expect(editPoll).toHaveBeenCalledTimes(1));
    expect(editPoll.mock.calls[0][0]).toBe("abc123");
    expect(editPoll.mock.calls[0][1]).toEqual({ title: "Renamed" });
    expect(editPoll.mock.calls[0][2]).toBe("tok");
    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    expect(onClose).toHaveBeenCalled();
  });

  it("requires explicit confirmation before flipping a private poll public", async () => {
    editPoll.mockResolvedValue({ ...poll, public: true });
    const user = userEvent.setup();
    renderPanel();

    await user.click(
      screen.getByRole("checkbox", { name: /make results public/i }),
    );

    const save = screen.getByRole("button", { name: /save changes/i });
    expect(save).toBeDisabled();
    expect(screen.getByRole("alert")).toHaveTextContent(/reveals the names/i);

    await user.click(
      screen.getByRole("checkbox", { name: /make past responses public/i }),
    );
    expect(save).toBeEnabled();

    await user.click(save);
    await waitFor(() => expect(editPoll).toHaveBeenCalledTimes(1));
    expect(editPoll.mock.calls[0][1]).toEqual({ public: true });
  });

  it("maps a not_additive rejection to a friendly message and stays open", async () => {
    editPoll.mockRejectedValue(new ApiError("not_additive", 400));
    const user = userEvent.setup();
    const { onClose } = renderPanel();

    await user.type(screen.getByLabelText("Event name"), " 2");
    await user.click(screen.getByRole("button", { name: /save changes/i }));

    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent(/additive/i),
    );
    expect(onClose).not.toHaveBeenCalled();
  });
});
