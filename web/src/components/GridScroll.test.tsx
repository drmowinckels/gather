import { describe, it, expect } from "vitest";
import { render, fireEvent } from "@testing-library/react";
import { GridScroll } from "./GridScroll";

// jsdom doesn't lay out, so scrollWidth/clientWidth are 0; fake the metrics the
// edge-fade logic reads, then fire scroll to recompute.
function setMetrics(
  el: HTMLElement,
  m: { scrollWidth: number; clientWidth: number; scrollLeft: number },
) {
  Object.defineProperty(el, "scrollWidth", {
    value: m.scrollWidth,
    configurable: true,
  });
  Object.defineProperty(el, "clientWidth", {
    value: m.clientWidth,
    configurable: true,
  });
  el.scrollLeft = m.scrollLeft;
}

describe("GridScroll trailing-edge fade", () => {
  it("marks data-more while columns sit off-screen to the right, and clears it at the end", () => {
    const { container } = render(
      <GridScroll>
        <div>grid</div>
      </GridScroll>,
    );
    const wrap = container.querySelector(".grid-scroll-wrap") as HTMLElement;
    const scroll = container.querySelector(".grid-scroll") as HTMLElement;

    // Wider content, scrolled to the start → more to the right.
    setMetrics(scroll, { scrollWidth: 1000, clientWidth: 300, scrollLeft: 0 });
    fireEvent.scroll(scroll);
    expect(wrap.hasAttribute("data-more")).toBe(true);

    // Scrolled to the end → nothing more to the right.
    setMetrics(scroll, {
      scrollWidth: 1000,
      clientWidth: 300,
      scrollLeft: 700,
    });
    fireEvent.scroll(scroll);
    expect(wrap.hasAttribute("data-more")).toBe(false);
  });

  it("never marks data-more when the content fits", () => {
    const { container } = render(
      <GridScroll>
        <div>grid</div>
      </GridScroll>,
    );
    const wrap = container.querySelector(".grid-scroll-wrap") as HTMLElement;
    const scroll = container.querySelector(".grid-scroll") as HTMLElement;

    setMetrics(scroll, { scrollWidth: 300, clientWidth: 300, scrollLeft: 0 });
    fireEvent.scroll(scroll);
    expect(wrap.hasAttribute("data-more")).toBe(false);
  });
});
