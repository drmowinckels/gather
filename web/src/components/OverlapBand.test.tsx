import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { overlapWindow } from "@samkoma/core";
import { OverlapBand } from "./OverlapBand";

const DAY = "2026-06-29";

// Mirror the page: the host is folded into the covered zones, and the band's
// highlighted columns come from the same overlapWindow result that fills from/to.
function renderBand(zones: string[], homeTz = "Africa/Abidjan") {
  const all = [homeTz, ...zones.filter((z) => z !== homeTz)];
  const overlap = overlapWindow(all, "09:00", "17:00", [DAY], homeTz);
  return render(
    <OverlapBand
      zones={zones}
      workFrom="09:00"
      workTo="17:00"
      homeTz={homeTz}
      refDate={DAY}
      overlap={overlap}
    />,
  );
}

describe("OverlapBand", () => {
  it("renders a row per covered zone with its city label and offset", () => {
    renderBand(["Asia/Tokyo", "Asia/Dubai"]);
    expect(screen.getByRole("row", { name: /Tokyo/ })).toBeInTheDocument();
    expect(screen.getByRole("row", { name: /Dubai/ })).toBeInTheDocument();
    expect(screen.getByText(/GMT\+9/)).toBeInTheDocument();
  });

  it("marks the all-zones overlap columns (home included)", () => {
    // Home Dubai + Bangkok + Tokyo overlap at home hours 09,10,11.
    const { container } = renderBand(
      ["Asia/Bangkok", "Asia/Tokyo"],
      "Asia/Dubai",
    );
    // Three overlap columns × two covered-zone rows.
    const overlapCells = container.querySelectorAll(".tzband-cell.overlap");
    expect(overlapCells).toHaveLength(6);
  });

  it("announces the overlap count for assistive tech", () => {
    renderBand(["Asia/Bangkok", "Asia/Tokyo"], "Asia/Dubai");
    expect(
      screen.getByText(/3 hours work in every region/i),
    ).toBeInTheDocument();
  });

  it("shows no overlap columns when zones never coincide", () => {
    const { container } = renderBand(["Pacific/Honolulu", "Asia/Dubai"]);
    expect(container.querySelectorAll(".tzband-cell.overlap")).toHaveLength(0);
    expect(
      screen.getByText(/no hour works in every region/i),
    ).toBeInTheDocument();
  });
});
