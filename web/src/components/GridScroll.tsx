import { useEffect, useRef, useState, type ReactNode } from "react";

// Horizontal scroll container for the day grids. A poll spanning many days is
// wider than its card, but overlay scrollbars (macOS, touch) stay hidden until
// you scroll — so the grid looks complete when it isn't. We fade the trailing
// edge while there are more columns to the right, and clear it at the end.
export function GridScroll({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [more, setMore] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => {
      setMore(el.scrollWidth - el.clientWidth - el.scrollLeft > 1);
    };
    update();
    el.addEventListener("scroll", update, { passive: true });
    // Width changes (window resize, sidebar appearing at the breakpoint) flip
    // whether the grid overflows; ResizeObserver is absent in some test envs.
    const ro =
      typeof ResizeObserver !== "undefined" ? new ResizeObserver(update) : null;
    ro?.observe(el);
    window.addEventListener("resize", update);
    return () => {
      el.removeEventListener("scroll", update);
      ro?.disconnect();
      window.removeEventListener("resize", update);
    };
  }, []);

  return (
    <div className="grid-scroll-wrap" data-more={more ? "" : undefined}>
      <div className="grid-scroll" ref={ref}>
        {children}
      </div>
    </div>
  );
}
