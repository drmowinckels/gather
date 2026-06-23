import { describe, it, expect, vi, afterEach } from "vitest";
import { useState } from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { AvailabilityGrid } from "./AvailabilityGrid";
import type { Marks } from "../lib/paint";
import type { GridView } from "../lib/tz";

const view: GridView = {
  days: ["2099-07-15"],
  times: ["09:00", "09:30"],
  dayLabels: ["Wed 15"],
  keyAt: (d, t) => `${d}T${t}`,
};

function Harness() {
  const [marks, setMarks] = useState<Marks>(new Map());
  return <AvailabilityGrid view={view} value={marks} onChange={setMarks} />;
}

// jsdom does not implement elementFromPoint; stand in for the hit-test.
function stubHitTest(el: Element | null) {
  document.elementFromPoint = vi.fn(
    () => el,
  ) as unknown as typeof document.elementFromPoint;
}

afterEach(() => {
  vi.restoreAllMocks();
  Reflect.deleteProperty(document, "elementFromPoint");
});

describe("AvailabilityGrid drag painting", () => {
  it("paints across cells via hit-testing during a drag (touch path)", () => {
    render(<Harness />);
    const cellA = screen.getByRole("button", { name: /09:00.*busy/i });
    const cellB = screen.getByRole("button", { name: /09:30.*busy/i });
    stubHitTest(cellB);

    fireEvent.pointerDown(cellA);
    expect(
      screen.getByRole("button", { name: /09:00.*available/i }),
    ).toBeTruthy();

    // A move (bubbling to the grid container) should paint the cell under the
    // pointer, even though no pointerenter fired on cell B.
    fireEvent.pointerMove(cellA, { clientX: 5, clientY: 5 });
    expect(
      screen.getByRole("button", { name: /09:30.*available/i }),
    ).toBeTruthy();

    fireEvent.pointerUp(window);
  });

  it("does not paint on move when no drag is in progress", () => {
    render(<Harness />);
    const cellB = screen.getByRole("button", { name: /09:30.*busy/i });

    // No elementFromPoint stub: the handler must early-return before hit-testing.
    fireEvent.pointerMove(cellB, { clientX: 5, clientY: 5 });
    expect(screen.getByRole("button", { name: /09:30.*busy/i })).toBeTruthy();
  });
});
