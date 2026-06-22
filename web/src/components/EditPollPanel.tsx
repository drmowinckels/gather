import { useMemo, useState } from "react";
import { editPoll, ApiError, type Poll, type EditPollInput } from "../lib/api";

const ERROR_TEXT: Record<string, string> = {
  not_additive:
    "Editing is additive — you can add days or widen the window, but not drop a day or time people may already have answered for.",
  from_after_to: "The end time needs to be after the start time.",
  slot_change_unsupported: "The slot size can't be changed after a poll is created.",
  invalid_body: "Check the fields and try again.",
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
  const [title, setTitle] = useState(poll.title);
  const [added, setAdded] = useState<string[]>([]);
  const [newDate, setNewDate] = useState("");
  const [from, setFrom] = useState(poll.from);
  const [to, setTo] = useState(poll.to);
  const [isPublic, setIsPublic] = useState(poll.public);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const currentDays = useMemo(() => [...poll.days].sort(), [poll.days]);
  const minNewDate = currentDays[currentDays.length - 1] ?? "";

  function addDate() {
    if (!newDate) return;
    if (currentDays.includes(newDate) || added.includes(newDate)) {
      setNewDate("");
      return;
    }
    setAdded((prev) => [...prev, newDate].sort());
    setNewDate("");
  }

  function removeAdded(iso: string) {
    setAdded((prev) => prev.filter((d) => d !== iso));
  }

  // Only send fields the host actually changed; the server is the source of
  // truth for the additive-only and from < to rules.
  const patch: EditPollInput = {};
  if (title.trim() && title.trim() !== poll.title) patch.title = title.trim();
  if (added.length > 0) patch.days = [...currentDays, ...added].sort();
  if (from !== poll.from) patch.from = from;
  if (to !== poll.to) patch.to = to;
  if (isPublic !== poll.public) patch.public = isPublic;
  const dirty = Object.keys(patch).length > 0;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!dirty || saving) return;
    setSaving(true);
    setError(null);
    try {
      const updated = await editPoll(poll.id, patch, editToken);
      onSaved(updated);
      onClose();
    } catch (err) {
      setError(
        err instanceof ApiError
          ? (ERROR_TEXT[err.code] ?? "We couldn't save those changes.")
          : "Can't reach the samkoma service. Check your connection and try again.",
      );
      setSaving(false);
    }
  }

  return (
    <form
      className="card"
      style={{ padding: 22, margin: "26px 0", borderLeft: "3px solid var(--brand)" }}
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
        <span className="fieldlbl">✏️ Edit poll</span>
        <button type="button" className="btn btn-outline btn-sm" onClick={onClose}>
          Close
        </button>
      </div>

      {error && (
        <div className="error-banner" style={{ margin: "14px 0" }} role="alert">
          {error}
        </div>
      )}

      <div className="field" style={{ marginTop: 14 }}>
        <label className="fieldlbl" htmlFor="edit-title">
          Event name
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
        <span className="fieldlbl">Days</span>
        <div className="chips">
          {currentDays.map((iso) => (
            <span
              key={iso}
              className="chip on"
              aria-disabled="true"
              title="Existing day — can't be removed"
              style={{ cursor: "default", opacity: 0.85 }}
            >
              {iso}
            </span>
          ))}
          {added.map((iso) => (
            <button
              key={iso}
              type="button"
              className="chip on"
              aria-pressed="true"
              onClick={() => removeAdded(iso)}
              title="Click to remove this added day"
            >
              {iso} ✕
            </button>
          ))}
        </div>
        <div className="copy-row" style={{ marginTop: 10, maxWidth: 320 }}>
          <input
            type="date"
            className="input"
            aria-label="Add a day"
            min={minNewDate}
            value={newDate}
            onChange={(e) => setNewDate(e.target.value)}
          />
          <button
            type="button"
            className="btn btn-outline btn-sm"
            onClick={addDate}
            disabled={!newDate}
          >
            Add
          </button>
        </div>
        <p className="subtle" style={{ margin: "7px 0 0", fontSize: 12 }}>
          You can add days, but existing ones stay — people may have answered for them.
        </p>
      </div>

      <div className="field-row field">
        <div>
          <label className="fieldlbl" htmlFor="edit-from">
            No earlier than
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
            No later than
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
          <span className="fieldlbl">Slot size</span>
          <p className="input" style={{ display: "flex", alignItems: "center", color: "var(--fg-muted)" }}>
            {poll.slot} min
          </p>
        </div>
      </div>
      <p className="subtle" style={{ margin: "-8px 0 16px", fontSize: 12 }}>
        You can only widen the window (earlier start, later end), and the slot size is fixed.
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
        <label className="switch">
          <input
            type="checkbox"
            checked={isPublic}
            onChange={(e) => setIsPublic(e.target.checked)}
          />
          <span className="switch-track">
            <span className="switch-knob" />
          </span>
          Make results public
        </label>
        <button type="submit" className="btn btn-primary" disabled={!dirty || saving}>
          {saving ? "Saving…" : "Save changes"}
        </button>
      </div>
    </form>
  );
}
