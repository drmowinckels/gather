import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
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
    deadline: null,
    closedAt: null,
    closed: false,
    lockedSlot: null,
    expiresAt: null,
    capacity: null,
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

describe("GroupHeatmap — people filter", () => {
  const responses: PollResponse[] = [
    {
      name: "Ada",
      tz: "UTC",
      slots: ["2026-07-15T09:00", "2026-07-15T09:30"],
      maybe: [],
      updatedAt: "",
    },
    {
      name: "Kari",
      tz: "UTC",
      slots: ["2026-07-15T09:00"],
      maybe: [],
      updatedAt: "",
    },
  ];

  it("hides the filter with fewer than two respondents", () => {
    render(
      <GroupHeatmap poll={makePoll(responses.slice(0, 1))} viewerTz="UTC" />,
    );
    expect(
      screen.queryByRole("button", { name: /filter people/i }),
    ).not.toBeInTheDocument();
  });

  it("recomputes the tally over the selected subset", async () => {
    const user = userEvent.setup();
    render(<GroupHeatmap poll={makePoll(responses)} viewerTz="UTC" />);
    expect(screen.getByText("2 responses")).toBeInTheDocument();
    expect(screen.getByText("Available · 2")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /filter people/i }));
    await user.click(screen.getByRole("button", { name: "Kari" }));

    expect(screen.getByText("1 of 2 responses")).toBeInTheDocument();
    expect(screen.getByText("Available · 1")).toBeInTheDocument();
  });

  it("shows a recoverable empty state when everyone is filtered out", async () => {
    const user = userEvent.setup();
    render(<GroupHeatmap poll={makePoll(responses)} viewerTz="UTC" />);
    await user.click(screen.getByRole("button", { name: /filter people/i }));
    await user.click(screen.getByRole("button", { name: "Ada" }));
    await user.click(screen.getByRole("button", { name: "Kari" }));

    expect(screen.getByText("No one in this selection")).toBeInTheDocument();
    // the chips remain so the host can add someone back
    expect(screen.getByRole("button", { name: "Ada" })).toBeInTheDocument();
  });
});

describe("GroupHeatmap — accessibility", () => {
  const responses: PollResponse[] = [
    {
      name: "Ada",
      tz: "UTC",
      slots: ["2026-07-15T09:00"],
      maybe: [],
      updatedAt: "",
    },
  ];

  it("exposes a screen-reader table of the per-slot tally", () => {
    render(<GroupHeatmap poll={makePoll(responses)} viewerTz="UTC" />);
    const table = screen.getByRole("table");
    expect(table).toHaveTextContent(/Group availability by slot/i);
    expect(
      within(table).getByRole("rowheader", { name: /Wed 15, 09:00/ }),
    ).toBeInTheDocument();
  });

  it("pins the best-slot panel for sticky scrolling", () => {
    render(<GroupHeatmap poll={makePoll(responses)} viewerTz="UTC" />);
    expect(document.querySelector(".results-side")).toBeInTheDocument();
  });

  it("renders no host-selection buttons for a plain viewer", () => {
    render(<GroupHeatmap poll={makePoll(responses)} viewerTz="UTC" />);
    expect(
      screen.queryByRole("button", { name: /select to lock in/i }),
    ).not.toBeInTheDocument();
  });

  it("makes host cells keyboard-operable buttons that drive the lock target", async () => {
    const user = userEvent.setup();
    render(
      <GroupHeatmap
        poll={makePoll(responses)}
        viewerTz="UTC"
        isHost
        editToken="tok"
      />,
    );
    const cells = screen.getAllByRole("button", { name: /select to lock in/i });
    expect(cells.length).toBeGreaterThan(0);

    // Pick an empty slot via keyboard; the lock button retargets to it.
    const tenAm = screen.getByRole("button", {
      name: /Wed 15, 10:00.*select to lock in/i,
    });
    tenAm.focus();
    await user.keyboard("{Enter}");
    expect(
      screen.getByRole("button", { name: /lock in .*Wed 15, 10:00/i }),
    ).toBeInTheDocument();
  });
});

describe("GroupHeatmap — groups", () => {
  it("shows per-group respondent tallies when responses are tagged", () => {
    const responses: PollResponse[] = [
      {
        name: "Ada",
        tz: "UTC",
        slots: ["2026-07-15T09:00"],
        maybe: [],
        group: "Eng",
        updatedAt: "",
      },
      {
        name: "Kari",
        tz: "UTC",
        slots: ["2026-07-15T09:00"],
        maybe: [],
        group: "Eng",
        updatedAt: "",
      },
      {
        name: "Cy",
        tz: "UTC",
        slots: ["2026-07-15T09:00"],
        maybe: [],
        group: "Design",
        updatedAt: "",
      },
    ];
    render(<GroupHeatmap poll={makePoll(responses)} viewerTz="UTC" />);
    const byGroup = screen.getByText(/by group/i).closest("div")!;
    expect(byGroup).toHaveTextContent(/Eng\s*2/);
    expect(byGroup).toHaveTextContent(/Design\s*1/);
  });

  it("shows no group line when nobody is tagged", () => {
    const responses: PollResponse[] = [
      {
        name: "Ada",
        tz: "UTC",
        slots: ["2026-07-15T09:00"],
        maybe: [],
        updatedAt: "",
      },
    ];
    render(<GroupHeatmap poll={makePoll(responses)} viewerTz="UTC" />);
    expect(screen.queryByText(/by group/i)).not.toBeInTheDocument();
  });

  it("scopes the tally to a group via the filter", async () => {
    const user = userEvent.setup();
    const responses: PollResponse[] = [
      {
        name: "Ada",
        tz: "UTC",
        slots: ["2026-07-15T09:00"],
        maybe: [],
        group: "Eng",
        updatedAt: "",
      },
      {
        name: "Kari",
        tz: "UTC",
        slots: ["2026-07-15T09:00"],
        maybe: [],
        group: "Eng",
        updatedAt: "",
      },
      {
        name: "Cy",
        tz: "UTC",
        slots: ["2026-07-15T09:00"],
        maybe: [],
        group: "Design",
        updatedAt: "",
      },
    ];
    render(<GroupHeatmap poll={makePoll(responses)} viewerTz="UTC" />);
    expect(screen.getByText("3 responses")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /filter people/i }));
    // drop the Design bucket → count Eng only
    await user.click(screen.getByRole("button", { name: /^Design 1\/1/ }));

    expect(screen.getByText("2 of 3 responses")).toBeInTheDocument();
    expect(screen.getByText("Available · 2")).toBeInTheDocument();
  });

  it("offers an Ungrouped bucket and toggles it", async () => {
    const user = userEvent.setup();
    const responses: PollResponse[] = [
      {
        name: "Ada",
        tz: "UTC",
        slots: ["2026-07-15T09:00"],
        maybe: [],
        group: "Eng",
        updatedAt: "",
      },
      {
        name: "Bea",
        tz: "UTC",
        slots: ["2026-07-15T09:00"],
        maybe: [],
        updatedAt: "",
      },
    ];
    render(<GroupHeatmap poll={makePoll(responses)} viewerTz="UTC" />);
    await user.click(screen.getByRole("button", { name: /filter people/i }));
    await user.click(screen.getByRole("button", { name: /^Ungrouped 1\/1/ }));

    expect(screen.getByText("1 of 2 responses")).toBeInTheDocument();
  });
});

describe("GroupHeatmap — capacity", () => {
  const responses: PollResponse[] = [
    {
      name: "Ada",
      tz: "UTC",
      slots: ["2026-07-15T09:00"],
      maybe: [],
      updatedAt: "",
    },
    {
      name: "Kari",
      tz: "UTC",
      slots: ["2026-07-15T09:00"],
      maybe: [],
      updatedAt: "",
    },
  ];

  it("marks a slot full once it reaches the capacity, with a legend key", () => {
    render(
      <GroupHeatmap
        poll={{ ...makePoll(responses), capacity: 2 }}
        viewerTz="UTC"
      />,
    );
    // the 09:00 slot has 2 available and capacity is 2 → full
    const table = screen.getByRole("table");
    expect(
      within(table).getByRole("rowheader", { name: /Wed 15, 09:00/ }),
    ).toBeInTheDocument();
    expect(table).toHaveTextContent(/2 of 2 \(full\)/);
    expect(screen.getByText("full")).toBeInTheDocument();
  });

  it("shows no full marker when under capacity", () => {
    render(
      <GroupHeatmap
        poll={{ ...makePoll(responses), capacity: 5 }}
        viewerTz="UTC"
      />,
    );
    expect(screen.getByRole("table")).not.toHaveTextContent(/\(full\)/);
  });
});

describe("GroupHeatmap — CSV export", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("downloads all responses as CSV from the header button", async () => {
    const parts: string[] = [];
    vi.stubGlobal(
      "Blob",
      class {
        constructor(chunks: string[]) {
          parts.push(chunks.join(""));
        }
      },
    );
    const createObjectURL = vi.fn(() => "blob:mock");
    vi.stubGlobal("URL", { createObjectURL, revokeObjectURL: vi.fn() });
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    const user = userEvent.setup();

    const responses: PollResponse[] = [
      {
        name: "Ada",
        tz: "UTC",
        slots: ["2026-07-15T09:00"],
        maybe: [],
        updatedAt: "",
      },
    ];
    render(<GroupHeatmap poll={makePoll(responses)} viewerTz="UTC" />);
    await user.click(screen.getByRole("button", { name: /download csv/i }));

    expect(createObjectURL).toHaveBeenCalledOnce();
    expect(parts[0]).toContain("Ada,2026-07-15T09:00,available");
  });

  it("offers no CSV button before anyone has responded", () => {
    render(<GroupHeatmap poll={makePoll([])} viewerTz="UTC" />);
    expect(
      screen.queryByRole("button", { name: /download csv/i }),
    ).not.toBeInTheDocument();
  });
});
