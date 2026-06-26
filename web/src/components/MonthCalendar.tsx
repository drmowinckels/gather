import { useMemo, useRef, useState } from "react";
import { DISPLAY_LOCALE } from "../lib/datetime";

// A localized calendar-month date picker with drag-to-paint selection. Replaces
// the native <input type="date"> (whose format we can't control) and a flat day
// list. Selection is a Set of canonical ISO dates ("YYYY-MM-DD").

const MONTH_TITLE_FMT = new Intl.DateTimeFormat(DISPLAY_LOCALE, {
  month: "long",
  year: "numeric",
});
const WEEKDAY_FMT = new Intl.DateTimeFormat(DISPLAY_LOCALE, {
  weekday: "short",
});
const FULL_DATE_FMT = new Intl.DateTimeFormat(DISPLAY_LOCALE, {
  weekday: "long",
  year: "numeric",
  month: "long",
  day: "numeric",
});

function isoOf(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate(),
  ).padStart(2, "0")}`;
}

// First day of the week per the viewer's locale (Monday across most of Europe,
// Sunday in the US). Returns a JS getDay() index (0 = Sunday … 6 = Saturday),
// falling back to Monday where Intl weekInfo is unavailable.
export function localeFirstDay(locale: string): number {
  try {
    const loc = new Intl.Locale(locale) as Intl.Locale & {
      weekInfo?: { firstDay?: number };
      getWeekInfo?: () => { firstDay?: number };
    };
    const firstDay = (loc.getWeekInfo?.() ?? loc.weekInfo)?.firstDay; // 1=Mon…7=Sun
    if (typeof firstDay === "number") return firstDay % 7; // → 0=Sun…6=Sat
  } catch {
    // unsupported locale tag or no weekInfo — fall back below
  }
  return 1; // Monday
}

const FIRST_DAY = localeFirstDay(DISPLAY_LOCALE);

// Weekday headers starting on the locale's first day. 2024-01-07 was a Sunday
// (getDay() === 0), so +dayIndex lands on each weekday name.
const WEEKDAY_HEADERS = Array.from({ length: 7 }, (_, i) =>
  WEEKDAY_FMT.format(new Date(2024, 0, 7 + ((FIRST_DAY + i) % 7))),
);

interface MonthCalendarProps {
  value: Set<string>;
  onChange: (updater: (prev: Set<string>) => Set<string>) => void;
  /** Dates before this ISO date are disabled. Defaults to today. */
  minDate?: string;
  /** Dates shown selected that can't be toggled off (e.g. a poll's existing days). */
  lockedDays?: Set<string>;
  /** "Now" — injectable so tests are deterministic. Defaults to the real date. */
  today?: Date;
}

export function MonthCalendar({
  value,
  onChange,
  minDate,
  lockedDays,
  today: nowProp,
}: MonthCalendarProps) {
  const today = useMemo(() => isoOf(nowProp ?? new Date()), [nowProp]);
  const floor = minDate ?? today;
  const currentMonth = useMemo(() => {
    const d = nowProp ?? new Date();
    return { year: d.getFullYear(), month: d.getMonth() };
  }, [nowProp]);
  const [view, setView] = useState(currentMonth);

  const dragging = useRef(false);
  const target = useRef(false); // true = selecting, false = deselecting
  const lastPainted = useRef<string | null>(null);

  const weeks = useMemo(() => {
    const first = new Date(view.year, view.month, 1);
    const lead = (first.getDay() - FIRST_DAY + 7) % 7; // offset to locale's first weekday
    const start = new Date(view.year, view.month, 1 - lead);
    return Array.from({ length: 6 }, (_, w) =>
      Array.from({ length: 7 }, (_, d) => {
        const date = new Date(
          start.getFullYear(),
          start.getMonth(),
          start.getDate() + w * 7 + d,
        );
        return { iso: isoOf(date), date };
      }),
    );
  }, [view]);

  const atFloor = isoOf(new Date(currentMonth.year, currentMonth.month, 1));
  const viewFirst = isoOf(new Date(view.year, view.month, 1));
  const canGoPrev = viewFirst > atFloor;

  function locked(iso: string): boolean {
    return lockedDays?.has(iso) ?? false;
  }
  // A day from an adjacent month, shown to fill the 6-week frame.
  function outOfView(iso: string): boolean {
    const [y, m] = iso.split("-").map(Number);
    return y !== view.year || m !== view.month + 1;
  }
  function disabled(iso: string): boolean {
    return iso < floor || locked(iso) || outOfView(iso);
  }

  function paint(iso: string) {
    if (disabled(iso) || lastPainted.current === iso) return;
    lastPainted.current = iso;
    const add = target.current;
    onChange((prev) => {
      const next = new Set(prev);
      if (add) next.add(iso);
      else next.delete(iso);
      return next;
    });
  }

  function start(iso: string, e: React.PointerEvent) {
    if (disabled(iso)) return;
    e.preventDefault();
    target.current = !value.has(iso);
    dragging.current = true;
    lastPainted.current = iso;
    onChange((prev) => {
      const next = new Set(prev);
      if (target.current) next.add(iso);
      else next.delete(iso);
      return next;
    });
  }

  function onPointerMove(e: React.PointerEvent) {
    if (!dragging.current) return;
    const el = document.elementFromPoint(e.clientX, e.clientY);
    const iso = el?.closest<HTMLElement>("[data-iso]")?.dataset.iso;
    if (iso) paint(iso);
  }

  function endDrag() {
    dragging.current = false;
    lastPainted.current = null;
  }

  function toggle(iso: string) {
    if (disabled(iso)) return;
    onChange((prev) => {
      const next = new Set(prev);
      if (next.has(iso)) next.delete(iso);
      else next.add(iso);
      return next;
    });
  }

  function shiftMonth(delta: number) {
    setView((v) => {
      const d = new Date(v.year, v.month + delta, 1);
      return { year: d.getFullYear(), month: d.getMonth() };
    });
  }

  return (
    <div
      className="calendar"
      style={{ userSelect: "none", maxWidth: 340 }}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerLeave={endDrag}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 10,
        }}
      >
        <button
          type="button"
          className="btn btn-outline btn-sm"
          onClick={() => shiftMonth(-1)}
          disabled={!canGoPrev}
          aria-label="Previous month"
        >
          ‹
        </button>
        <strong style={{ fontSize: 14 }} aria-live="polite">
          {MONTH_TITLE_FMT.format(new Date(view.year, view.month, 1))}
        </strong>
        <button
          type="button"
          className="btn btn-outline btn-sm"
          onClick={() => shiftMonth(1)}
          aria-label="Next month"
        >
          ›
        </button>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(7, 1fr)",
          gap: 4,
          fontSize: 11,
          fontWeight: 700,
          color: "var(--fg-subtle)",
          marginBottom: 4,
        }}
      >
        {WEEKDAY_HEADERS.map((w, i) => (
          <div key={i} style={{ textAlign: "center" }}>
            {w}
          </div>
        ))}
      </div>

      <div
        role="group"
        aria-label={`Choose dates in ${MONTH_TITLE_FMT.format(
          new Date(view.year, view.month, 1),
        )}`}
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(7, 1fr)",
          gap: 4,
        }}
      >
        {weeks.flat().map(({ iso, date }) => {
          const inMonth = date.getMonth() === view.month;
          const isSelected = value.has(iso);
          const isLocked = locked(iso);
          const isDisabled = disabled(iso);
          const isToday = iso === today;
          return (
            <button
              key={iso}
              type="button"
              data-iso={iso}
              aria-pressed={isSelected}
              aria-hidden={!inMonth}
              aria-label={FULL_DATE_FMT.format(date)}
              disabled={isDisabled && !isLocked}
              title={
                isLocked ? "Already in the poll — can't be removed" : undefined
              }
              onPointerDown={(e) => start(iso, e)}
              onKeyDown={(e) => {
                if (e.key === " " || e.key === "Enter") {
                  e.preventDefault();
                  toggle(iso);
                }
              }}
              style={{
                aspectRatio: "1 / 1",
                border: "none",
                borderRadius: 8,
                fontSize: 13,
                cursor: isDisabled ? "default" : "pointer",
                touchAction: "none",
                opacity: inMonth
                  ? isDisabled && !isSelected
                    ? 0.35
                    : 1
                  : 0.25,
                color: isSelected ? "var(--on-brand)" : "var(--fg)",
                background: isSelected ? "var(--brand)" : "var(--bg-elev-1)",
                boxShadow: isToday
                  ? "inset 0 0 0 2px var(--brand)"
                  : isSelected
                    ? "none"
                    : "inset 0 0 0 1px var(--border-subtle)",
              }}
            >
              {date.getDate()}
            </button>
          );
        })}
      </div>
    </div>
  );
}
