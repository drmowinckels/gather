import { useEffect, useMemo, useRef } from "react";
import { hourLabel, dayHeader } from "../lib/datetime";
import { modeFor, applyPaint, type PaintMode } from "../lib/paint";
import type { GridView } from "../lib/tz";

interface GridProps {
  view: GridView;
  value: Set<string>;
  onChange: (updater: (prev: Set<string>) => Set<string>) => void;
  onCommit?: () => void;
  disabled?: boolean;
}

const GUTTER = 46;
const FREE_BG =
  "linear-gradient(180deg, var(--brand), color-mix(in oklab, var(--brand) 78%, #000))";

export function AvailabilityGrid({
  view,
  value,
  onChange,
  onCommit,
  disabled = false,
}: GridProps) {
  const dragging = useRef(false);
  const mode = useRef<PaintMode>("fill");
  const commitRef = useRef(onCommit);
  commitRef.current = onCommit;

  const headers = useMemo(() => view.days.map((d) => dayHeader(d)), [view]);

  useEffect(() => {
    const end = () => {
      if (dragging.current) {
        dragging.current = false;
        commitRef.current?.();
      }
    };
    window.addEventListener("pointerup", end);
    window.addEventListener("pointercancel", end);
    return () => {
      window.removeEventListener("pointerup", end);
      window.removeEventListener("pointercancel", end);
    };
  }, []);

  function start(key: string, e: React.PointerEvent) {
    if (disabled) return;
    e.preventDefault();
    const m = modeFor(value, key);
    mode.current = m;
    dragging.current = true;
    onChange((prev) => applyPaint(prev, key, m));
  }

  function enter(key: string) {
    if (disabled || !dragging.current) return;
    onChange((prev) => applyPaint(prev, key, mode.current));
  }

  function toggleKey(key: string) {
    if (disabled) return;
    const m = modeFor(value, key);
    onChange((prev) => applyPaint(prev, key, m));
    commitRef.current?.();
  }

  return (
    <div style={{ userSelect: "none" }}>
      <div style={{ display: "flex", gap: 6, marginBottom: 6 }}>
        <div style={{ width: GUTTER, flex: "none" }} />
        {view.days.map((d, i) => (
          <div
            key={d}
            style={{
              flex: 1,
              minWidth: 44,
              textAlign: "center",
              fontSize: 12,
              fontWeight: 700,
              color: "var(--fg-muted)",
            }}
          >
            {headers[i].weekday} {headers[i].day}
          </div>
        ))}
      </div>

      {view.times.map((t) => (
        <div
          key={t}
          style={{ display: "flex", gap: 6, marginBottom: 6, alignItems: "center" }}
        >
          <div
            style={{
              width: GUTTER,
              flex: "none",
              textAlign: "right",
              fontFamily: "var(--font-mono)",
              fontSize: 11,
              color: "var(--fg-subtle)",
            }}
          >
            {hourLabel(t)}
          </div>
          {view.days.map((d, di) => {
            const key = view.keyAt(d, t);
            if (key === null) {
              // No canonical slot maps here (timezone-shift gap).
              return <div key={d} className="gridcell" style={{ visibility: "hidden" }} />;
            }
            const free = value.has(key);
            const h = headers[di];
            return (
              <button
                key={d}
                type="button"
                className="gridcell"
                aria-pressed={free}
                aria-label={`${h.weekday} ${h.day}, ${t} — ${free ? "free" : "busy"}`}
                disabled={disabled}
                onPointerDown={(e) => start(key, e)}
                onPointerEnter={() => enter(key)}
                onKeyDown={(e) => {
                  if (e.key === " " || e.key === "Enter") {
                    e.preventDefault();
                    toggleKey(key);
                  }
                }}
                style={{
                  background: free ? FREE_BG : "var(--bg-elev-1)",
                  boxShadow: free ? "none" : "inset 0 0 0 1px var(--border-subtle)",
                }}
              />
            );
          })}
        </div>
      ))}

      <div
        style={{
          display: "flex",
          gap: 18,
          marginTop: 14,
          fontSize: 12,
          color: "var(--fg-subtle)",
        }}
      >
        <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ width: 14, height: 14, borderRadius: 7, background: FREE_BG }} />
          free
        </span>
        <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span
            style={{
              width: 14,
              height: 14,
              borderRadius: 7,
              background: "var(--bg-elev-1)",
              boxShadow: "inset 0 0 0 1px var(--border-subtle)",
            }}
          />
          busy
        </span>
      </div>
    </div>
  );
}
