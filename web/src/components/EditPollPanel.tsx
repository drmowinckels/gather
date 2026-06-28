import { useMemo, useState } from "react";
import { editPoll, ApiError, type Poll, type EditPollInput } from "../lib/api";
import { MonthCalendar } from "./MonthCalendar";
import { weekdayLabel } from "../lib/tz";
import { useT } from "../i18n";
import type { TKey } from "../i18n";

const WEEKDAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];

const ERROR_TEXT: Record<string, TKey> = {
  not_additive: "edit.error.notAdditive",
  from_after_to: "edit.error.fromAfterTo",
  slot_change_unsupported: "edit.error.slotChangeUnsupported",
  invalid_body: "edit.error.invalidBody",
};

export function EditPollPanel({
  poll,
  editToken,
  onSaved,
  onClose,
}: {
  poll: Poll;
  editToken: string;
  onSaved: (poll: Poll) => void;
  onClose: () => void;
}) {
  const t = useT();
  const [title, setTitle] = useState(poll.title);
  const [added, setAdded] = useState<string[]>([]);
  const [from, setFrom] = useState(poll.from);
  const [to, setTo] = useState(poll.to);
  const [isPublic, setIsPublic] = useState(poll.public);
  const [resultsHidden, setResultsHidden] = useState(poll.resultsHidden);
  const [confirmPublic, setConfirmPublic] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Flipping a private poll public retroactively exposes the names and
  // availability of everyone who already answered, so require explicit consent.
  const goingPublic = !poll.public && isPublic;

  const currentDays = useMemo(() => [...poll.days].sort(), [poll.days]);
  const lockedDays = useMemo(() => new Set(currentDays), [currentDays]);
  const calendarValue = useMemo(
    () => new Set([...currentDays, ...added]),
    [currentDays, added],
  );

  // Existing days are locked, so the calendar only ever toggles added days.
  function onCalendarChange(updater: (prev: Set<string>) => Set<string>) {
    setAdded((prevAdded) => {
      const next = updater(new Set([...currentDays, ...prevAdded]));
      return [...next].filter((d) => !lockedDays.has(d)).sort();
    });
  }

  // Only send fields the host actually changed; the server is the source of
  // truth for the additive-only and from < to rules.
  const patch: EditPollInput = {};
  if (title.trim() && title.trim() !== poll.title) patch.title = title.trim();
  if (added.length > 0) patch.days = [...currentDays, ...added].sort();
  if (from !== poll.from) patch.from = from;
  if (to !== poll.to) patch.to = to;
  if (isPublic !== poll.public) patch.public = isPublic;
  if (resultsHidden !== poll.resultsHidden) patch.resultsHidden = resultsHidden;
  const dirty = Object.keys(patch).length > 0;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!dirty || saving || (goingPublic && !confirmPublic)) return;
    setSaving(true);
    setError(null);
    try {
      const updated = await editPoll(poll.id, patch, editToken);
      onSaved(updated);
      onClose();
    } catch (err) {
      setError(
        err instanceof ApiError
          ? t(ERROR_TEXT[err.code] ?? "edit.error.generic")
          : t("edit.error.network"),
      );
      setSaving(false);
    }
  }

  return (
    <form
      className="card"
      style={{
        padding: 22,
        margin: "26px 0",
      }}
      onSubmit={onSubmit}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
        }}
      >
        <span className="fieldlbl">✏️ {t("edit.heading")}</span>
        <button
          type="button"
          className="btn btn-outline btn-sm"
          onClick={onClose}
        >
          {t("edit.close")}
        </button>
      </div>

      {error && (
        <div className="error-banner" style={{ margin: "14px 0" }} role="alert">
          {error}
        </div>
      )}

      <div className="field" style={{ marginTop: 14 }}>
        <label className="fieldlbl" htmlFor="edit-title">
          {t("edit.eventName")}
        </label>
        <input
          id="edit-title"
          className="input"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={200}
        />
      </div>

      <div className="field">
        <span className="fieldlbl">{t("edit.days")}</span>
        {poll.kind === "weekdays" ? (
          <div className="chips">
            {WEEKDAYS.map((wd) => {
              const selected = calendarValue.has(wd);
              const isLocked = lockedDays.has(wd);
              return (
                <button
                  key={wd}
                  type="button"
                  className={`chip${selected ? " on" : ""}`}
                  aria-pressed={selected}
                  disabled={isLocked}
                  title={isLocked ? t("edit.existingDay") : undefined}
                  onClick={() =>
                    onCalendarChange((prev) => {
                      const next = new Set(prev);
                      if (next.has(wd)) next.delete(wd);
                      else next.add(wd);
                      return next;
                    })
                  }
                >
                  {weekdayLabel(wd)}
                </button>
              );
            })}
          </div>
        ) : (
          <MonthCalendar
            value={calendarValue}
            onChange={onCalendarChange}
            lockedDays={lockedDays}
          />
        )}
        <p className="subtle" style={{ margin: "10px 0 0", fontSize: 12 }}>
          {t("edit.daysHelp")}
        </p>
      </div>

      <div className="field-row field">
        <div>
          <label className="fieldlbl" htmlFor="edit-from">
            {t("edit.noEarlierThan")}
          </label>
          <input
            id="edit-from"
            type="time"
            className="input"
            max={poll.from}
            value={from}
            onChange={(e) => setFrom(e.target.value)}
          />
        </div>
        <div>
          <label className="fieldlbl" htmlFor="edit-to">
            {t("edit.noLaterThan")}
          </label>
          <input
            id="edit-to"
            type="time"
            className="input"
            min={poll.to}
            value={to}
            onChange={(e) => setTo(e.target.value)}
          />
        </div>
        <div>
          <span className="fieldlbl">{t("edit.slotSize")}</span>
          <p
            className="input"
            style={{
              display: "flex",
              alignItems: "center",
              color: "var(--fg-muted)",
            }}
          >
            {t("edit.slotMinutes", { slot: poll.slot })}
          </p>
        </div>
      </div>
      <p className="subtle" style={{ margin: "-8px 0 16px", fontSize: 12 }}>
        {t("edit.windowHelp")}
      </p>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 16,
          paddingTop: 18,
          borderTop: "1px solid var(--border-subtle)",
          flexWrap: "wrap",
        }}
      >
        <div style={{ display: "grid", gap: 12 }}>
          <label className="switch">
            <input
              type="checkbox"
              checked={isPublic}
              onChange={(e) => {
                setIsPublic(e.target.checked);
                if (!e.target.checked) setConfirmPublic(false);
              }}
            />
            <span className="switch-track">
              <span className="switch-knob" />
            </span>
            {t("edit.makePublic")}
          </label>
          <label className="switch">
            <input
              type="checkbox"
              checked={resultsHidden}
              onChange={(e) => setResultsHidden(e.target.checked)}
            />
            <span className="switch-track">
              <span className="switch-knob" />
            </span>
            {t("edit.hideResults")}
          </label>
        </div>
        <button
          type="submit"
          className="btn btn-primary"
          disabled={!dirty || saving || (goingPublic && !confirmPublic)}
        >
          {saving ? t("edit.saving") : t("edit.save")}
        </button>
      </div>

      {goingPublic && (
        <div className="error-banner" role="alert" style={{ marginTop: 16 }}>
          <strong>{t("edit.public.warningLead")}</strong>{" "}
          {t("edit.public.warningBody")}
          <label
            className="switch"
            style={{ marginTop: 12, fontSize: 13, fontWeight: 600 }}
          >
            <input
              type="checkbox"
              checked={confirmPublic}
              onChange={(e) => setConfirmPublic(e.target.checked)}
            />
            <span className="switch-track">
              <span className="switch-knob" />
            </span>
            {t("edit.public.confirm")}
          </label>
        </div>
      )}
    </form>
  );
}
