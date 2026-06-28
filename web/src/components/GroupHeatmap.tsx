import { useMemo, useState } from "react";
import { responsesToCsv, csvFilename } from "@samkoma/core";
import { lockSlot, type Poll } from "../lib/api";
import { aggregate } from "../lib/heatmap";
import { formatHour } from "../lib/datetime";
import { downloadText } from "../lib/download";
import { buildGridView, formatSlotLabelInTz } from "../lib/tz";
import { GridScroll } from "./GridScroll";
import { PeopleFilter } from "./PeopleFilter";
import { useT } from "../i18n";

const BEST_SHADOW =
  "0 0 0 2px var(--brand), 0 0 14px color-mix(in oklab, var(--brand) 60%, transparent)";
const LOCK_SHADOW = "0 0 0 2px var(--border-strong)";
const SELECT_SHADOW = "0 0 0 2px var(--fg)";
// A slot that has reached the poll's per-slot capacity — ringed in green.
const FULL_RING = "0 0 0 3px var(--botanical)";
const HATCH =
  "repeating-linear-gradient(45deg, color-mix(in oklab, var(--brand) 24%, transparent) 0 4px, transparent 4px 8px)";

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
  const t = useT();
  const [locking, setLocking] = useState(false);
  const [hovered, setHovered] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);

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
      buildGridView(
        poll.kind,
        poll.days,
        poll.from,
        poll.to,
        poll.slot,
        poll.tz,
        viewerTz,
      ),
    [poll.kind, poll.days, poll.from, poll.to, poll.slot, poll.tz, viewerTz],
  );
  // Subset filter: anyone the host has toggled off is dropped from the tally.
  // Tracked as *excluded* names so a respondent who arrives later is counted by
  // default. The heatmap, ranking and counts all recompute over the subset.
  const [excluded, setExcluded] = useState<Set<string>>(new Set());
  const names = useMemo(
    () => poll.responses.map((r) => r.name),
    [poll.responses],
  );
  const filtered = useMemo(
    () => poll.responses.filter((r) => !excluded.has(r.name)),
    [poll.responses, excluded],
  );
  const agg = useMemo(() => aggregate(filtered), [filtered]);
  // Respondent count per self-assigned group, over the slots currently counted.
  const groupCounts = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of filtered) {
      const g = r.group?.trim();
      if (g) m.set(g, (m.get(g) ?? 0) + 1);
    }
    return [...m.entries()].sort(
      (a, b) => b[1] - a[1] || a[0].localeCompare(b[0]),
    );
  }, [filtered]);
  const filtering = excluded.size > 0;
  const label = (key: string) =>
    formatSlotLabelInTz(key, poll.kind, poll.tz, viewerTz);

  function toggleName(name: string) {
    setExcluded((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  }

  // Buckets for group-level filtering: one per group plus "Ungrouped". Built
  // from all responses (so a group keeps its toggle even when fully excluded).
  const filterGroups = useMemo(() => {
    const buckets = new Map<string, string[]>();
    for (const r of poll.responses) {
      const key = r.group?.trim() || "Ungrouped";
      const list = buckets.get(key) ?? [];
      list.push(r.name);
      buckets.set(key, list);
    }
    const ordered = [...buckets.entries()].sort((a, b) => {
      if (a[0] === "Ungrouped") return 1;
      if (b[0] === "Ungrouped") return -1;
      return a[0].localeCompare(b[0]);
    });
    return ordered.map(([labelText, members]) => ({
      label: labelText,
      members,
    }));
  }, [poll.responses]);

  // Toggle a whole bucket: if any member is currently counted, drop them all;
  // otherwise add them all back.
  function toggleGroup(members: string[]) {
    setExcluded((prev) => {
      const anyIncluded = members.some((m) => !prev.has(m));
      const next = new Set(prev);
      for (const m of members) {
        if (anyIncluded) next.add(m);
        else next.delete(m);
      }
      return next;
    });
  }

  // Export every response (not just the current subset) — the file is the full
  // record. Built in the browser from data already loaded, so it works for a
  // host viewing a private poll too.
  function exportCsv() {
    downloadText(
      csvFilename(poll.title),
      responsesToCsv(poll.responses),
      "text/csv;charset=utf-8",
    );
  }

  const header = (
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
        {t("heatmap.title")}
      </h2>
      <span
        style={{ display: "flex", alignItems: "center", gap: 12 }}
        className="subtle"
      >
        <span style={{ fontSize: 12 }}>
          {filtering
            ? t("heatmap.responsesOf", {
                total: agg.total,
                names: names.length,
              })
            : t("heatmap.responses", { count: agg.total })}
        </span>
        {poll.responses.length > 0 && (
          <button
            type="button"
            className="btn btn-outline btn-sm"
            onClick={exportCsv}
          >
            {t("heatmap.downloadCsv")}
          </button>
        )}
      </span>
    </div>
  );

  const filterBar =
    names.length >= 2 ? (
      <PeopleFilter
        names={names}
        excluded={excluded}
        groups={filterGroups}
        onToggle={toggleName}
        onToggleGroup={toggleGroup}
        onReset={() => setExcluded(new Set())}
      />
    ) : null;

  // Empty state covers "no responses", "responses but nobody is free in any
  // slot", and "you filtered everyone out" — agg.ranked is empty in all three.
  // The filter bar stays rendered so a host who over-filtered can recover.
  if (agg.ranked.length === 0) {
    return (
      <div className="card" style={{ padding: 24, margin: "26px 0" }}>
        {header}
        {filterBar}
        <div style={{ textAlign: "center", padding: "24px 4px" }}>
          <p style={{ fontWeight: 700, fontSize: 16, margin: 0 }}>
            {filtering
              ? t("heatmap.emptyFilteredTitle")
              : t("heatmap.emptyTitle")}
          </p>
          <p className="helper" style={{ margin: "8px auto 0", maxWidth: 360 }}>
            {filtering
              ? t("heatmap.emptyFilteredBody")
              : t("heatmap.emptyBody")}
          </p>
        </div>
      </div>
    );
  }

  const best = agg.ranked[0];
  const runnerUps = agg.ranked.slice(1, 5);

  // Screen-reader equivalent of the colour grid: every slot with any
  // availability, as plain text. The visual grid is aria-hidden for non-hosts,
  // so this table is their canonical source of the per-slot tally.
  const srRows = view.times.flatMap((time) =>
    view.days.flatMap((d) => {
      const key = view.keyAt(d, time);
      if (key === null) return [];
      const cell = agg.cells.get(key);
      const count = cell?.count ?? 0;
      const maybeN = cell?.maybe ?? 0;
      if (count === 0 && maybeN === 0) return [];
      return [{ key, count, maybeN }];
    }),
  );

  return (
    <div className="card" style={{ padding: 24, margin: "26px 0" }}>
      {header}
      {filterBar}

      {groupCounts.length > 0 && (
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: "4px 14px",
            margin: "0 0 14px",
            fontSize: 13,
            color: "var(--fg-muted)",
          }}
        >
          <span className="subtle">{t("heatmap.byGroup")}</span>
          {groupCounts.map(([g, n]) => (
            <span key={g}>
              {g} <strong style={{ color: "var(--fg)" }}>{n}</strong>
            </span>
          ))}
        </div>
      )}

      <table className="sr-only">
        <caption>
          {t("heatmap.srCaption", {
            total: agg.total,
            names: names.length,
            time: label(best.slot),
            count: best.count,
          })}
        </caption>
        <thead>
          <tr>
            <th scope="col">{t("heatmap.colTimeSlot")}</th>
            <th scope="col">{t("heatmap.colAvailable")}</th>
            <th scope="col">{t("heatmap.colMaybe")}</th>
          </tr>
        </thead>
        <tbody>
          {srRows.map(({ key, count, maybeN }) => (
            <tr key={key}>
              <th scope="row">{label(key)}</th>
              <td>
                {t("heatmap.srCount", { count, total: agg.total })}
                {poll.capacity != null && count >= poll.capacity
                  ? t("heatmap.srFull")
                  : ""}
              </td>
              <td>{maybeN}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="results-grid">
        <div onMouseLeave={() => setHovered(null)} aria-hidden={!isHost}>
          <GridScroll>
            <div className="grid-rows">
              <div style={{ display: "flex", gap: 5, marginBottom: 5 }}>
                <div
                  className="grid-gutter"
                  style={{ width: 46, flex: "none" }}
                />
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
                    {view.dayLabels[i]}
                  </div>
                ))}
              </div>

              {view.times.map((time) => (
                <div
                  key={time}
                  style={{
                    display: "flex",
                    gap: 5,
                    marginBottom: 5,
                    alignItems: "center",
                  }}
                >
                  <div
                    className="grid-gutter"
                    style={{
                      width: 46,
                      flex: "none",
                      textAlign: "right",
                      fontFamily: "var(--font-mono)",
                      fontSize: 11,
                      color: "var(--fg-subtle)",
                    }}
                  >
                    {formatHour(time)}
                  </div>
                  {view.days.map((d) => {
                    const key = view.keyAt(d, time);
                    if (key === null) {
                      return (
                        <div
                          key={d}
                          className="heatcell"
                          style={{ visibility: "hidden" }}
                        />
                      );
                    }
                    const cell = agg.cells.get(key);
                    const count = cell?.count ?? 0;
                    const maybeN = cell?.maybe ?? 0;
                    const pct = Math.round((count / agg.total) * 100);
                    const isBest = key === agg.bestKey;
                    const isLocked = key === poll.lockedSlot;
                    const isSelected =
                      isHost && key === (selected ?? agg.bestKey);
                    const empty = count === 0 && maybeN === 0;
                    const isFull =
                      poll.capacity != null && count >= poll.capacity;
                    const base =
                      count > 0
                        ? `color-mix(in oklab, var(--brand) min(${pct}%, var(--heat-cap)), var(--heat-base))`
                        : "transparent";
                    const desc =
                      (empty
                        ? t("heatmap.cellEmpty", { time: label(key) })
                        : t("heatmap.cellAvailable", {
                            time: label(key),
                            count,
                            total: agg.total,
                          }) +
                          (maybeN
                            ? t("heatmap.cellMaybeSuffix", { count: maybeN })
                            : "")) +
                      (isFull ? t("heatmap.cellFullSuffix") : "");
                    const baseShadow = isLocked
                      ? LOCK_SHADOW
                      : isSelected
                        ? SELECT_SHADOW
                        : empty
                          ? "inset 0 0 0 1px var(--border-subtle)"
                          : isBest
                            ? BEST_SHADOW
                            : "none";
                    const cellStyle = {
                      cursor: isHost ? "pointer" : "default",
                      background: maybeN > 0 ? `${HATCH}, ${base}` : base,
                      boxShadow: isFull
                        ? baseShadow === "none"
                          ? FULL_RING
                          : `${baseShadow}, ${FULL_RING}`
                        : baseShadow,
                      color: "var(--fg)",
                    } as const;
                    const content =
                      count > 0 ? count : maybeN > 0 ? maybeN : "";
                    return isHost ? (
                      <button
                        key={d}
                        type="button"
                        className="heatcell"
                        aria-pressed={isSelected}
                        aria-label={t("heatmap.cellAriaLockable", { desc })}
                        onMouseEnter={() => setHovered(key)}
                        onClick={() => setSelected(key)}
                        title={desc}
                        style={cellStyle}
                      >
                        {content}
                      </button>
                    ) : (
                      <div
                        key={d}
                        className="heatcell"
                        onMouseEnter={() => setHovered(key)}
                        title={desc}
                        style={cellStyle}
                      >
                        {content}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </GridScroll>

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
            <span
              style={{
                display: "flex",
                alignItems: "center",
                gap: 5,
                marginLeft: 6,
              }}
            >
              <span
                style={{
                  width: 14,
                  height: 14,
                  borderRadius: 4,
                  background: HATCH,
                }}
              />
              {t("heatmap.legendMaybe")}
            </span>
            {poll.capacity != null && (
              <span
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 5,
                }}
              >
                <span
                  style={{
                    width: 14,
                    height: 14,
                    borderRadius: 4,
                    boxShadow: "inset 0 0 0 2px var(--botanical)",
                  }}
                />
                {t("heatmap.legendFull")}
              </span>
            )}
          </div>
        </div>

        <div className="results-side">
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
              {t("heatmap.bestSlot")}
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
              {t("heatmap.bestSlotCount", {
                count: best.count,
                total: agg.total,
              })}
              {best.maybe > 0
                ? t("heatmap.bestSlotMaybeSuffix", { count: best.maybe })
                : ""}
              {best.count === agg.total ? t("heatmap.bestSlotAllIn") : ""}
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
                {t("heatmap.runnerUps")}
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

          {(() => {
            const key = hovered ?? agg.bestKey;
            const cell = key ? agg.cells.get(key) : undefined;
            if (!key || !cell) return null;
            return (
              <div
                style={{
                  marginTop: 18,
                  paddingTop: 16,
                  borderTop: "1px solid var(--border-subtle)",
                }}
              >
                <div
                  style={{
                    fontSize: 11,
                    color: "var(--fg-subtle)",
                    marginBottom: 6,
                  }}
                >
                  {hovered ? t("heatmap.thisSlot") : t("heatmap.bestSlot")}
                </div>
                <div style={{ fontWeight: 700, fontSize: 13 }}>
                  {label(key)}
                </div>
                {cell.count > 0 && (
                  <>
                    <div
                      style={{
                        fontSize: 12,
                        color: "var(--botanical)",
                        marginTop: 4,
                      }}
                    >
                      {t("heatmap.detailAvailable", { count: cell.count })}
                    </div>
                    <div
                      style={{
                        fontSize: 12,
                        color: "var(--fg-muted)",
                        marginTop: 4,
                        lineHeight: 1.5,
                      }}
                    >
                      {cell.names.join(", ")}
                    </div>
                  </>
                )}
                {cell.maybe > 0 && (
                  <>
                    <div
                      style={{
                        fontSize: 12,
                        color: "var(--fg-subtle)",
                        marginTop: 8,
                      }}
                    >
                      {t("heatmap.detailMaybe", { count: cell.maybe })}
                    </div>
                    <div
                      style={{
                        fontSize: 12,
                        color: "var(--fg-muted)",
                        marginTop: 4,
                        lineHeight: 1.5,
                      }}
                    >
                      {cell.maybeNames.join(", ")}
                    </div>
                  </>
                )}
              </div>
            );
          })()}

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
                    📌 {t("heatmap.lockedLabel")}{" "}
                    <strong>{label(poll.lockedSlot)}</strong>
                  </div>
                  <button
                    type="button"
                    className="btn btn-outline btn-sm"
                    onClick={() => setLock(null)}
                    disabled={locking}
                  >
                    {locking ? "…" : t("heatmap.unlock")}
                  </button>
                </>
              ) : (
                (() => {
                  const target = selected ?? best.slot;
                  return (
                    <>
                      <button
                        type="button"
                        className="btn btn-primary"
                        style={{ width: "100%" }}
                        onClick={() => setLock(target)}
                        disabled={locking}
                      >
                        {locking
                          ? t("heatmap.locking")
                          : t("heatmap.lockIn", { time: label(target) })}
                      </button>
                      <p
                        className="subtle"
                        style={{ fontSize: 12, margin: "8px 0 0" }}
                      >
                        {selected
                          ? t("heatmap.pickHintSelected")
                          : t("heatmap.pickHintDefault")}
                      </p>
                    </>
                  );
                })()
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
