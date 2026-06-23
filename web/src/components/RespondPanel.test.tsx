import { describe, it, expect, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { RespondPanel } from "./RespondPanel";
import { saveOwnMarks } from "../lib/storage";
import type { Poll } from "../lib/api";

const tz = "Europe/Oslo";

const poll: Poll = {
  id: "abc123",
  title: "Team offsite",
  kind: "dates",
  days: ["2099-07-15"],
  from: "09:00",
  to: "10:00",
  slot: 30,
  tz,
  public: true,
  lockedSlot: null,
  expiresAt: null,
  createdAt: "2099-01-01T00:00:00Z",
  responses: [],
};

beforeEach(() => {
  localStorage.clear();
});

describe("RespondPanel", () => {
  it("does not clobber in-progress painting when poll.responses changes", async () => {
    // Seed a previously-saved mark so the one-time restore has something to load.
    saveOwnMarks(poll.id, { slots: ["2099-07-15T09:00"], maybe: [] });
    const user = userEvent.setup();

    const { rerender } = render(<RespondPanel poll={poll} viewerTz={tz} />);

    // 09:00 was restored from the cache; paint 09:30 too (not yet saved).
    const cell0930 = screen.getByRole("button", { name: /09:30.*busy/i });
    cell0930.focus();
    await user.keyboard("{Enter}");
    expect(
      screen.getByRole("button", { name: /09:30.*available/i }),
    ).toBeTruthy();

    // A response merge (e.g. someone else's autosave) changes the prop. The
    // restore effect must not re-run and reset 09:30 back to the cached state.
    rerender(
      <RespondPanel
        poll={{
          ...poll,
          responses: [
            {
              name: "Someone",
              tz,
              slots: ["2099-07-15T09:00"],
              maybe: [],
              updatedAt: "x",
            },
          ],
        }}
        viewerTz={tz}
      />,
    );

    expect(
      screen.getByRole("button", { name: /09:30.*available/i }),
    ).toBeTruthy();
    expect(
      screen.getByRole("button", { name: /09:00.*available/i }),
    ).toBeTruthy();
  });
});
