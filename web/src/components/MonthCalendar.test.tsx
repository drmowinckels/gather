import { describe, it, expect, afterEach, vi } from "vitest";
import { useState } from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MonthCalendar, localeFirstDay } from "./MonthCalendar";

const weekInfoSupported = (() => {
  try {
    const l = new Intl.Locale("en-US") as Intl.Locale & {
      weekInfo?: unknown;
      getWeekInfo?: () => unknown;
    };
    return Boolean(l.getWeekInfo?.() ?? l.weekInfo);
  } catch {
    return false;
  }
})();

// Fixed "now" so the rendered month and the past/future split are deterministic.
const NOW = new Date(2026, 6, 15); // Wed 2026-07-15

function Harness({
  initial = new Set<string>(),
  locked,
}: {
  initial?: Set<string>;
  locked?: Set<string>;
}) {
  const [value, setValue] = useState(initial);
  return (
    <MonthCalendar
      value={value}
      onChange={setValue}
      lockedDays={locked}
      today={NOW}
    />
  );
}

function cell(iso: string): HTMLButtonElement {
  const el = document.querySelector<HTMLButtonElement>(`[data-iso="${iso}"]`);
  if (!el) throw new Error(`no calendar cell for ${iso}`);
  return el;
}

function stubHitTest(el: Element | null) {
  document.elementFromPoint = vi.fn(
    () => el,
  ) as unknown as typeof document.elementFromPoint;
}

afterEach(() => {
  vi.restoreAllMocks();
  Reflect.deleteProperty(document, "elementFromPoint");
});

describe("MonthCalendar", () => {
  it("renders the reference month and 42 day cells", () => {
    render(<Harness />);
    expect(screen.getByText(/2026/)).toBeTruthy();
    expect(screen.getAllByRole("gridcell")).toHaveLength(42);
  });

  it("toggles a future day on and off", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    expect(cell("2026-07-20")).toHaveAttribute("aria-pressed", "false");
    await user.click(cell("2026-07-20"));
    expect(cell("2026-07-20")).toHaveAttribute("aria-pressed", "true");
    await user.click(cell("2026-07-20"));
    expect(cell("2026-07-20")).toHaveAttribute("aria-pressed", "false");
  });

  it("disables past days but allows today", () => {
    render(<Harness />);
    expect(cell("2026-07-14")).toBeDisabled(); // yesterday
    expect(cell("2026-07-15")).not.toBeDisabled(); // today
  });

  it("paints across days during a drag", () => {
    render(<Harness />);
    stubHitTest(cell("2026-07-22"));
    fireEvent.pointerDown(cell("2026-07-20"));
    expect(cell("2026-07-20")).toHaveAttribute("aria-pressed", "true");
    fireEvent.pointerMove(cell("2026-07-20"), { clientX: 5, clientY: 5 });
    expect(cell("2026-07-22")).toHaveAttribute("aria-pressed", "true");
    fireEvent.pointerUp(cell("2026-07-20"));
  });

  it("keeps locked days selected and refuses to toggle them off", async () => {
    const user = userEvent.setup();
    render(
      <Harness
        initial={new Set(["2026-07-20"])}
        locked={new Set(["2026-07-20"])}
      />,
    );
    expect(cell("2026-07-20")).toHaveAttribute("aria-pressed", "true");
    await user.click(cell("2026-07-20"));
    expect(cell("2026-07-20")).toHaveAttribute("aria-pressed", "true"); // unchanged
  });

  it("derives the first day of week from the locale (Monday fallback)", () => {
    expect(localeFirstDay("!!!-invalid")).toBe(1); // bad tag → Monday
    expect(localeFirstDay("en-US")).toBeGreaterThanOrEqual(0);
    expect(localeFirstDay("en-US")).toBeLessThanOrEqual(6);
    if (weekInfoSupported) {
      expect(localeFirstDay("en-US")).toBe(0); // Sunday
      expect(localeFirstDay("nb-NO")).toBe(1); // Monday
    }
  });

  it("navigates months and disables Previous at the reference month", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    expect(
      screen.getByRole("button", { name: /previous month/i }),
    ).toBeDisabled();
    await user.click(screen.getByRole("button", { name: /next month/i }));
    expect(cell("2026-08-10")).not.toBeDisabled();
    expect(
      screen.getByRole("button", { name: /previous month/i }),
    ).not.toBeDisabled();
  });
});
