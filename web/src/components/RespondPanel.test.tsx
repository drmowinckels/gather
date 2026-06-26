import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { RespondPanel } from "./RespondPanel";
import { saveOwnMarks } from "../lib/storage";
import { submitSlots, type Poll } from "../lib/api";

vi.mock("../lib/api", async (orig) => {
  const actual = await orig<typeof import("../lib/api")>();
  return { ...actual, submitSlots: vi.fn() };
});

const submitMock = vi.mocked(submitSlots);

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
  resultsHidden: false,
  deadline: null,
  closedAt: null,
  closed: false,
  lockedSlot: null,
  expiresAt: null,
  createdAt: "2099-01-01T00:00:00Z",
  responses: [],
};

beforeEach(() => {
  localStorage.clear();
  submitMock.mockReset();
});

function response(over: Partial<import("../lib/api").PollResponse> = {}) {
  return {
    name: "Ada",
    tz,
    slots: [],
    maybe: [],
    updatedAt: "x",
    ...over,
  };
}

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

  it("claims a name on first save, then re-sends the stored token", async () => {
    const user = userEvent.setup();
    submitMock.mockResolvedValueOnce(response({ responseToken: "tok123" }));
    render(<RespondPanel poll={poll} viewerTz={tz} />);

    await user.type(screen.getByLabelText(/your name/i), "Ada");
    await user.click(
      screen.getByRole("button", { name: /save availability/i }),
    );

    await waitFor(() => expect(submitMock).toHaveBeenCalledTimes(1));
    expect(submitMock.mock.calls[0][1].secret).toBeUndefined();

    submitMock.mockResolvedValueOnce(response());
    await user.click(
      screen.getByRole("button", { name: /save availability/i }),
    );
    await waitFor(() => expect(submitMock).toHaveBeenCalledTimes(2));
    expect(submitMock.mock.calls[1][1].secret).toBe("tok123");
  });

  it("overlays busy slots from an uploaded .ics (client-side only)", async () => {
    const { container } = render(<RespondPanel poll={poll} viewerTz={tz} />);
    // 07:00–07:30 UTC == 09:00–09:30 Oslo (the poll's first slot).
    const cal = [
      "BEGIN:VCALENDAR",
      "BEGIN:VEVENT",
      "DTSTART:20990715T070000Z",
      "DTEND:20990715T073000Z",
      "END:VEVENT",
      "END:VCALENDAR",
    ].join("\r\n");
    const file = new File([cal], "cal.ics", { type: "text/calendar" });
    // jsdom's File lacks .text(); real browsers have it.
    Object.defineProperty(file, "text", { value: () => Promise.resolve(cal) });
    const input = container.querySelector(
      'input[type="file"]',
    ) as HTMLInputElement;
    fireEvent.change(input, { target: { files: [file] } });

    expect(await screen.findByText(/busy slot/i)).toBeTruthy();
    // a conflict dot is rendered on the clashing cell
    expect(
      screen.getByRole("button", { name: /09:00.*calendar conflict/i }),
    ).toBeTruthy();
    expect(submitMock).not.toHaveBeenCalled(); // nothing uploaded
  });

  it("shows a closed notice (no save) when the poll is closed", () => {
    render(<RespondPanel poll={{ ...poll, closed: true }} viewerTz={tz} />);
    expect(screen.getByText(/responding is closed/i)).toBeTruthy();
    expect(
      screen.queryByRole("button", { name: /save availability/i }),
    ).toBeNull();
  });

  it("marks every slot available with Select all, and wipes with Clear all", async () => {
    const user = userEvent.setup();
    render(<RespondPanel poll={poll} viewerTz={tz} />);

    // poll is 09:00–10:00, 30-min slots, one day → two paintable cells
    expect(
      screen.queryAllByRole("button", { name: /available$/i }).length,
    ).toBe(0);
    await user.click(screen.getByRole("button", { name: /select all/i }));
    expect(
      screen.getAllByRole("button", { name: /09:00.*available/i }).length,
    ).toBeGreaterThan(0);
    expect(screen.getByText(/all slots marked available/i)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /clear all/i }));
    expect(
      screen.getByRole("button", { name: /09:00.*busy/i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/all slots cleared/i)).toBeInTheDocument();
  });

  it("keeps the calendar-overlay file input keyboard-reachable", () => {
    const { container } = render(<RespondPanel poll={poll} viewerTz={tz} />);
    const input = container.querySelector(
      'input[type="file"]',
    ) as HTMLInputElement;
    // display:none would drop it from the tab order; sr-only keeps it focusable.
    expect(input.style.display).not.toBe("none");
    expect(input).toHaveClass("sr-only");
  });

  it("announces save progress in a polite live region", async () => {
    const user = userEvent.setup();
    let resolveSave: (v: ReturnType<typeof response>) => void = () => {};
    submitMock.mockImplementation(
      () =>
        new Promise((res) => {
          resolveSave = res;
        }),
    );
    render(<RespondPanel poll={poll} viewerTz={tz} />);

    await user.type(screen.getByLabelText(/your name/i), "Ada");
    await user.click(
      screen.getByRole("button", { name: /save availability/i }),
    );

    const live = screen.getByText(/saving your availability/i);
    expect(live).toHaveAttribute("aria-live", "polite");
    resolveSave(response({ responseToken: "t" }));
    await waitFor(() =>
      expect(screen.getByText(/availability saved/i)).toBeInTheDocument(),
    );
  });

  it("sends a typed password as the secret and keeps using it", async () => {
    const user = userEvent.setup();
    submitMock.mockResolvedValue(response()); // password path → no token returned
    render(<RespondPanel poll={poll} viewerTz={tz} />);

    await user.type(screen.getByLabelText(/your name/i), "Ada");
    await user.type(screen.getByLabelText(/edit password/i), "pw123");
    await user.click(
      screen.getByRole("button", { name: /save availability/i }),
    );

    await waitFor(() => expect(submitMock).toHaveBeenCalledTimes(1));
    expect(submitMock.mock.calls[0][1].secret).toBe("pw123");
  });
});
