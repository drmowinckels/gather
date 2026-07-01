import { useMemo, useRef, useState } from "react";
import { localizedDateFormat, getDisplayLocale } from "../lib/datetime";
import { useT, useLocale } from "../i18n";

// A localized calendar-month date picker with drag-to-paint selection. Replaces
// the native <input type="date"> (whose format we can't control) and a flat day
// list. Selection is a Set of canonical ISO dates ("YYYY-MM-DD").

const MONTH_TITLE_OPTS: Intl.DateTimeFormatOptions = {
  month: "long",
  year: "numeric",
};
const WEEKDAY_OPTS: Intl.DateTimeFormatOptions = { weekday: "short" };
const FULL_DATE_OPTS: Intl.DateTimeFormatOptions = {
  weekday: "long",
  year: "numeric",
  month: "long",
  day: "numeric",
};

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

interface MonthCalendarProps {
  value: Set<string>;
  onChange: (updater: (prev: Set<string>) => Set<string>) => void;
  /** Dates before this ISO date are disabled. Defaults to today. */
  minDate?: string;
  /** Dates shown selected that can't be toggled off (e.g. a poll's existing days). */
  lockedDays?: Set<string>;
  /** "Now" — injectable so tests are deterministic. Defaults to the real date. */
  today?: Date;
  /** How many consecutive months to show side by side. Defaults to 1. */
  months?: number;
}

export function MonthCalendar({
  value,
  onChange,
  minDate,
  lockedDays,
  today: nowProp,
  months = 1,
}: MonthCalendarProps) {
  const t = useT();
  const [locale] = useLocale();
  const today = useMemo(() => isoOf(nowProp ?? new Date()), [nowProp]);
  const floor = minDate ?? today;

  // First day of week and the weekday headers follow the chosen language
  // (Monday-first "man." in Norwegian, Sunday-first "Sun" in English). Recompute
  // when the locale changes; the formatter cache keys on the locale too.
  const firstDay = useMemo(() => localeFirstDay(getDisplayLocale()), [locale]);
  // 2024-01-07 was a Sunday (getDay() === 0), so +dayIndex lands on each weekday.
  const weekdayHeaders = useMemo(
    () =>
      Array.from({ length: 7 }, (_, i) =>
        localizedDateFormat(WEEKDAY_OPTS).format(
          new Date(2024, 0, 7 + ((firstDay + i) % 7)),
        ),
      ),
    [locale, firstDay],
  );
  const currentMonth = useMemo(() => {
    const d = nowProp ?? new Date();
    return { year: d.getFullYear(), month: d.getMonth() };
  }, [nowProp]);
  const [view, setView] = useState(currentMonth);

  const dragging = useRef(false);
  const target = useRef(false); // true = selecting, false = deselecting
  const lastPainted = useRef<string | null>(null);

  // The `months` consecutive months to show, the first being `view`.
  const panels = useMemo(
    () =>
      Array.from({ length: months }, (_, i) => {
        const d = new Date(view.year, view.month + i, 1);
        return { year: d.getFullYear(), month: d.getMonth() };
      }),
    [view, months],
  );

  // The 6-week frame (locale-aligned) for each panel.
  const weeksByPanel = useMemo(
    () =>
      panels.map((pv) => {
        const first = new Date(pv.year, pv.month, 1);
        const lead = (first.getDay() - firstDay + 7) % 7;
        const start = new Date(pv.year, pv.month, 1 - lead);
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
      }),
    [panels, firstDay],
  );

  const atFloor = isoOf(new Date(currentMonth.year, currentMonth.month, 1));
  const viewFirst = isoOf(new Date(view.year, view.month, 1));
  const canGoPrev = viewFirst > atFloor;

  // Months currently on screen, as year*12+month keys, for the adjacent-day test.
  const shownMonths = useMemo(
    () => new Set(panels.map((p) => p.year * 12 + p.month)),
    [panels],
  );

  function locked(iso: string): boolean {
    return lockedDays?.has(iso) ?? false;
  }
  function inMonth(date: Date, pv: { year: number; month: number }): boolean {
    return date.getFullYear() === pv.year && date.getMonth() === pv.month;
  }
  // A day that belongs to none of the shown months (frame filler).
  function adjacent(iso: string): boolean {
    const [y, m] = iso.split("-").map(Number);
    return !shownMonths.has(y * 12 + (m - 1));
  }
  function disabled(iso: string): boolean {
    return iso < floor || locked(iso) || adjacent(iso);
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

  const monthTitle = (pv: { year: number; month: number }) =>
    localizedDateFormat(MONTH_TITLE_OPTS).format(
      new Date(pv.year, pv.month, 1),
    );

  return (
    <div
      className="calendar calendar-cols"
      style={{ userSelect: "none" }}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerLeave={endDrag}
    >
      {panels.map((pv, panelIndex) => (
        <div className="calendar-col" key={`${pv.year}-${pv.month}`}>
          <div className="calendar-col-head">
            {panelIndex === 0 ? (
              <button
                type="button"
                className="btn btn-outline btn-sm"
                onClick={() => shiftMonth(-1)}
                disabled={!canGoPrev}
                aria-label={t("calendar.prevMonth")}
              >
                ‹
              </button>
            ) : (
              <span className="calendar-arrow-spacer" />
            )}
            <strong style={{ fontSize: 14 }} aria-live="polite">
              {monthTitle(pv)}
            </strong>
            {panelIndex === panels.length - 1 ? (
              <button
                type="button"
                className="btn btn-outline btn-sm"
                onClick={() => shiftMonth(1)}
                aria-label={t("calendar.nextMonth")}
              >
                ›
              </button>
            ) : (
              <span className="calendar-arrow-spacer" />
            )}
          </div>

          <div className="calendar-weekdays">
            {weekdayHeaders.map((w, i) => (
              <div key={i} style={{ textAlign: "center" }}>
                {w}
              </div>
            ))}
          </div>

          <div
            role="group"
            aria-label={t("calendar.chooseDatesIn", { month: monthTitle(pv) })}
            className="calendar-grid"
          >
            {weeksByPanel[panelIndex].flat().map(({ iso, date }) => {
              const own = inMonth(date, pv);
              // In a multi-month view, frame-filler days belong to a neighbouring
              // visible month — render a blank cell instead of a duplicate button.
              if (!own && months > 1) {
                return <div key={`${panelIndex}-${iso}`} aria-hidden="true" />;
              }
              const isSelected = value.has(iso);
              const isLocked = locked(iso);
              const isDisabled = disabled(iso);
              const isToday = iso === today;
              return (
                <button
                  key={`${panelIndex}-${iso}`}
                  type="button"
                  data-iso={iso}
                  aria-pressed={isSelected}
                  aria-hidden={!own}
                  aria-label={localizedDateFormat(FULL_DATE_OPTS).format(date)}
                  disabled={isDisabled && !isLocked}
                  title={isLocked ? t("calendar.lockedDay") : undefined}
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
                    opacity: own
                      ? isDisabled && !isSelected
                        ? 0.35
                        : 1
                      : 0.25,
                    color: isSelected ? "var(--on-brand)" : "var(--fg)",
                    background: isSelected
                      ? "var(--brand)"
                      : "var(--bg-elev-1)",
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
      ))}
    </div>
  );
}
