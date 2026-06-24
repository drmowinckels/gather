import { useEffect, useRef } from "react";
import { hourLabel } from "../lib/datetime";
import { cycleNext, applyMark, type Status, type Marks } from "../lib/paint";
import type { GridView } from "../lib/tz";

interface GridProps {
  view: GridView;
  value: Marks;
  onChange: (updater: (prev: Marks) => Marks) => void;
  onCommit?: () => void;
  disabled?: boolean;
  // Canonical slot keys that clash with the viewer's imported calendar; marked
  // with a conflict dot.
  busyKeys?: Set<string>;
}

const GUTTER = 46;
const YES_BG =
  "linear-gradient(180deg, var(--brand), color-mix(in oklab, var(--brand) 78%, #000))";
// Diagonal hatch reads as "tentative".
const MAYBE_BG =
  "repeating-linear-gradient(45deg, color-mix(in oklab, var(--brand) 55%, var(--bg-elev-1)) 0 5px, var(--bg-elev-1) 5px 10px)";
const BUSY_BG = "var(--bg-elev-1)";

function bgFor(status: Status | undefined): string {
  return status === "yes" ? YES_BG : status === "maybe" ? MAYBE_BG : BUSY_BG;
}

export function AvailabilityGrid({
  view,
  value,
  onChange,
  onCommit,
  disabled = false,
  busyKeys,
}: GridProps) {
  const dragging = useRef(false);
  const target = useRef<Status | undefined>(undefined);
  const lastPainted = useRef<string | null>(null);
  const commitRef = useRef(onCommit);
  commitRef.current = onCommit;

  useEffect(() => {
    const end = () => {
      if (dragging.current) {
        dragging.current = false;
        lastPainted.current = null;
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
    const next = cycleNext(value.get(key));
    target.current = next;
    dragging.current = true;
    lastPainted.current = key;
    onChange((prev) => applyMark(prev, key, next));
  }

  function paintAt(key: string) {
    if (disabled || !dragging.current || lastPainted.current === key) return;
    lastPainted.current = key;
    onChange((prev) => applyMark(prev, key, target.current));
  }

  // Continue the drag via hit-testing rather than per-cell pointerenter, which
  // never fires for the moving finger on touch devices (the first cell captures
  // the pointer). Works for mouse and touch alike.
  function onPointerMove(e: React.PointerEvent) {
    if (!dragging.current) return;
    const el = document.elementFromPoint(e.clientX, e.clientY);
    const key = el?.closest<HTMLElement>("[data-key]")?.dataset.key;
    if (key) paintAt(key);
  }

  function toggleKey(key: string) {
    if (disabled) return;
    const next = cycleNext(value.get(key));
    onChange((prev) => applyMark(prev, key, next));
    commitRef.current?.();
  }

  return (
    <div style={{ userSelect: "none" }} onPointerMove={onPointerMove}>
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
            {view.dayLabels[i]}
          </div>
        ))}
      </div>

      {view.times.map((t) => (
        <div
          key={t}
          style={{
            display: "flex",
            gap: 6,
            marginBottom: 6,
            alignItems: "center",
          }}
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
              return (
                <div
                  key={d}
                  className="gridcell"
                  style={{ visibility: "hidden" }}
                />
              );
            }
            const status = value.get(key);
            const calBusy = busyKeys?.has(key) ?? false;
            const word =
              status === "yes"
                ? "available"
                : status === "maybe"
                  ? "maybe"
                  : "busy";
            return (
              <button
                key={d}
                type="button"
                className="gridcell"
                data-key={key}
                aria-label={`${view.dayLabels[di]}, ${t} — ${word}${
                  calBusy ? " — calendar conflict" : ""
                }`}
                disabled={disabled}
                onPointerDown={(e) => start(key, e)}
                onKeyDown={(e) => {
                  if (e.key === " " || e.key === "Enter") {
                    e.preventDefault();
                    toggleKey(key);
                  }
                }}
                style={{
                  position: "relative",
                  background: bgFor(status),
                  touchAction: "none",
                  boxShadow:
                    status === undefined
                      ? "inset 0 0 0 1px var(--border-subtle)"
                      : "none",
                }}
              >
                {calBusy && (
                  <span
                    aria-hidden="true"
                    title="Busy in your calendar"
                    style={{
                      position: "absolute",
                      top: 2,
                      right: 2,
                      width: 6,
                      height: 6,
                      borderRadius: 3,
                      background: "#c0533f",
                    }}
                  />
                )}
              </button>
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
          flexWrap: "wrap",
        }}
      >
        <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span
            style={{
              width: 14,
              height: 14,
              borderRadius: 7,
              background: YES_BG,
            }}
          />
          available
        </span>
        <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span
            style={{
              width: 14,
              height: 14,
              borderRadius: 7,
              background: MAYBE_BG,
            }}
          />
          maybe
        </span>
        <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span
            style={{
              width: 14,
              height: 14,
              borderRadius: 7,
              background: BUSY_BG,
              boxShadow: "inset 0 0 0 1px var(--border-subtle)",
            }}
          />
          busy
        </span>
      </div>
    </div>
  );
}
