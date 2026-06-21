import { useMemo, useState } from "react";
import { lockSlot, type Poll } from "../lib/api";
import { aggregate } from "../lib/heatmap";
import { hourLabel, dayHeader } from "../lib/datetime";
import { buildGridView, formatSlotLabelInTz } from "../lib/tz";

const BEST_SHADOW =
  "0 0 0 2px var(--brand), 0 0 14px color-mix(in oklab, var(--brand) 60%, transparent)";
const LOCK_SHADOW = "0 0 0 2px var(--border-strong)";

export function GroupHeatmap({
  poll,
  viewerTz,
  isHost = false,
  editToken,
  onLockChange,
}: {
  poll: Poll;
  viewerTz: string;
  isHost?: boolean;
  editToken?: string | null;
  onLockChange?: (poll: Poll) => void;
}) {
  const [locking, setLocking] = useState(false);

  async function setLock(slot: string | null) {
    if (!editToken) return;
    setLocking(true);
    try {
      onLockChange?.(await lockSlot(poll.id, slot, editToken));
    } catch {
      // surfaced minimally; lock is a host convenience
    } finally {
      setLocking(false);
    }
  }

  const view = useMemo(
    () =>
      buildGridView(poll.days, poll.from, poll.to, poll.slot, poll.tz, viewerTz),
    [poll.days, poll.from, poll.to, poll.slot, poll.tz, viewerTz],
  );
  const headers = useMemo(() => view.days.map((d) => dayHeader(d)), [view]);
  const agg = useMemo(() => aggregate(poll.responses), [poll.responses]);
  const label = (key: string) => formatSlotLabelInTz(key, poll.tz, viewerTz);

  // Empty state covers both "no responses" and "responses but nobody is free in
  // any slot" — in the latter, agg.ranked is empty and there's no best slot.
  if (agg.ranked.length === 0) {
    return (
      <div
        className="card"
        style={{ padding: "36px 28px", textAlign: "center", margin: "26px 0" }}
      >
        <p style={{ fontWeight: 700, fontSize: 16, margin: 0 }}>
          No availability yet
        </p>
        <p className="helper" style={{ margin: "8px auto 0", maxWidth: 360 }}>
          Once people paint their free times, the group's best slot lights up
          here.
        </p>
      </div>
    );
  }

  const best = agg.ranked[0];
  const runnerUps = agg.ranked.slice(1, 5);

  return (
    <div className="card" style={{ padding: 24, margin: "26px 0" }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "baseline",
          gap: 12,
          marginBottom: 18,
          flexWrap: "wrap",
        }}
      >
        <h2 style={{ fontWeight: 700, fontSize: 18, margin: 0 }}>
          Group availability
        </h2>
        <span className="subtle" style={{ fontSize: 12 }}>
          {agg.total} {agg.total === 1 ? "response" : "responses"}
        </span>
      </div>

      <div className="results-grid">
        <div>
          <div style={{ display: "flex", gap: 5, marginBottom: 5 }}>
            <div style={{ width: 46, flex: "none" }} />
            {view.days.map((d, i) => (
              <div
                key={d}
                style={{
                  flex: 1,
                  minWidth: 40,
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
              style={{ display: "flex", gap: 5, marginBottom: 5, alignItems: "center" }}
            >
              <div
                style={{
                  width: 46,
                  flex: "none",
                  textAlign: "right",
                  fontFamily: "var(--font-mono)",
                  fontSize: 11,
                  color: "var(--fg-subtle)",
                }}
              >
                {hourLabel(t)}
              </div>
              {view.days.map((d) => {
                const key = view.keyAt(d, t);
                if (key === null) {
                  return <div key={d} className="heatcell" style={{ visibility: "hidden" }} />;
                }
                const cell = agg.cells.get(key);
                const count = cell?.count ?? 0;
                const pct = Math.round((count / agg.total) * 100);
                const isBest = key === agg.bestKey;
                const isLocked = key === poll.lockedSlot;
                return (
                  <div
                    key={d}
                    className="heatcell"
                    title={
                      count > 0
                        ? `${label(key)} — ${count}/${agg.total} free: ${cell!.names.join(", ")}`
                        : `${label(key)} — nobody yet`
                    }
                    style={{
                      background:
                        count === 0
                          ? "transparent"
                          : `color-mix(in oklab, var(--brand) ${pct}%, var(--heat-base))`,
                      boxShadow: isLocked
                        ? LOCK_SHADOW
                        : count === 0
                          ? "inset 0 0 0 1px var(--border-subtle)"
                          : isBest
                            ? BEST_SHADOW
                            : "none",
                      color: pct >= 55 ? "var(--on-brand)" : "var(--fg-subtle)",
                    }}
                  >
                    {count > 0 ? count : ""}
                  </div>
                );
              })}
            </div>
          ))}

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              marginTop: 16,
              fontSize: 12,
              color: "var(--fg-subtle)",
            }}
          >
            <span>0</span>
            <div
              style={{
                flex: 1,
                height: 10,
                borderRadius: 9999,
                background:
                  "linear-gradient(to right, color-mix(in oklab, var(--brand) 10%, var(--heat-base)), var(--brand))",
              }}
            />
            <span>{agg.total}</span>
          </div>
        </div>

        <div>
          <div
            style={{
              background: "var(--brand)",
              color: "var(--on-brand)",
              borderRadius: 14,
              padding: "18px 20px",
            }}
          >
            <div
              style={{
                fontSize: 11,
                letterSpacing: ".16em",
                textTransform: "uppercase",
                fontWeight: 700,
                opacity: 0.85,
              }}
            >
              Best slot
            </div>
            <div
              style={{
                fontWeight: 800,
                fontSize: 22,
                letterSpacing: "-0.02em",
                lineHeight: 1.1,
                marginTop: 6,
              }}
            >
              {label(best.slot)}
            </div>
            <div style={{ fontSize: 13, marginTop: 8, opacity: 0.9 }}>
              {best.count} / {agg.total} available
              {best.count === agg.total ? " · all in" : ""}
            </div>
          </div>

          {runnerUps.length > 0 && (
            <div style={{ marginTop: 18 }}>
              <div
                style={{
                  fontSize: 11,
                  letterSpacing: ".16em",
                  textTransform: "uppercase",
                  fontWeight: 700,
                  color: "var(--fg-subtle)",
                  marginBottom: 10,
                }}
              >
                Runner-ups
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {runnerUps.map((r) => (
                  <div
                    key={r.slot}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      fontSize: 14,
                    }}
                  >
                    <span>{label(r.slot)}</span>
                    <span className="subtle">
                      {r.count}/{agg.total}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {isHost && editToken && (
            <div
              style={{
                marginTop: 18,
                paddingTop: 16,
                borderTop: "1px solid var(--border-subtle)",
              }}
            >
              {poll.lockedSlot ? (
                <>
                  <div style={{ fontSize: 13, marginBottom: 8 }}>
                    📌 Locked: <strong>{label(poll.lockedSlot)}</strong>
                  </div>
                  <button
                    type="button"
                    className="btn btn-outline btn-sm"
                    onClick={() => setLock(null)}
                    disabled={locking}
                  >
                    {locking ? "…" : "Unlock"}
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  className="btn btn-primary"
                  style={{ width: "100%" }}
                  onClick={() => setLock(best.slot)}
                  disabled={locking}
                >
                  {locking ? "Locking…" : `Lock in ${label(best.slot)}`}
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
