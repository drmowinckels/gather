import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Shell } from "../components/Shell";
import { CliEquivalent } from "../components/CliEquivalent";
import { createPoll, ApiError } from "../lib/api";
import { saveEditToken } from "../lib/storage";
import {
  browserTimezone,
  listTimezones,
  tzOffsetLabel,
  upcomingDays,
} from "../lib/datetime";

const SLOT_SIZES = [15, 30, 60];

export function CreatePoll() {
  const navigate = useNavigate();
  const baseDays = useMemo(() => upcomingDays(14), []);
  const tzOptions = useMemo(
    () =>
      listTimezones().map((z) => {
        const offset = tzOffsetLabel(z);
        return { value: z, label: offset ? `${z} (${offset})` : z };
      }),
    [],
  );

  const [title, setTitle] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [extraDays, setExtraDays] = useState<string[]>([]);
  const [newDate, setNewDate] = useState("");
  const [from, setFrom] = useState("09:00");
  const [to, setTo] = useState("17:00");
  const [slot, setSlot] = useState(30);
  const [tz, setTz] = useState(browserTimezone());
  const [isPublic, setIsPublic] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const dayChips = useMemo(() => {
    const all = [...baseDays];
    const seen = new Set(baseDays.map((d) => d.iso));
    for (const iso of extraDays) {
      if (!seen.has(iso)) {
        all.push({ iso, label: iso });
        seen.add(iso);
      }
    }
    return all.sort((a, b) => a.iso.localeCompare(b.iso));
  }, [baseDays, extraDays]);

  const selectedDays = [...selected].sort();
  const timeValid = from < to;
  const canSubmit =
    title.trim().length > 0 && selectedDays.length > 0 && timeValid;

  function toggleDay(iso: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(iso)) next.delete(iso);
      else next.add(iso);
      return next;
    });
  }

  function addDate() {
    if (!newDate) return;
    setExtraDays((prev) => (prev.includes(newDate) ? prev : [...prev, newDate]));
    setSelected((prev) => new Set(prev).add(newDate));
    setNewDate("");
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const created = await createPoll({
        title: title.trim(),
        days: selectedDays,
        from,
        to,
        slot,
        tz,
        public: isPublic,
      });
      saveEditToken(created.id, created.editToken);
      navigate(`/e/${created.id}`);
    } catch (err) {
      const msg =
        err instanceof ApiError
          ? "We couldn't create the poll. Check the fields and try again."
          : "Can't reach the samkoma service. Check your connection and try again.";
      setError(msg);
      setSubmitting(false);
    }
  }

  return (
    <Shell showNewPoll={false}>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(0, 1.6fr) minmax(0, 1fr)",
          gap: 32,
          alignItems: "start",
          padding: "40px 0",
        }}
        className="hero"
      >
        <form className="card" style={{ padding: "32px 36px" }} onSubmit={onSubmit}>
          <h1 className="h2">New poll</h1>
          <p className="helper" style={{ margin: "6px 0 28px" }}>
            Two minutes, no account. You'll get a link to share and an edit link
            to keep.
          </p>

          {error && (
            <div className="error-banner" style={{ marginBottom: 22 }} role="alert">
              {error}
            </div>
          )}

          <div className="field">
            <label className="fieldlbl" htmlFor="title">
              Event name
            </label>
            <input
              id="title"
              className="input"
              placeholder="Team offsite — September"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={200}
            />
          </div>

          <div className="field">
            <span className="fieldlbl">Which days?</span>
            <div className="chips">
              {dayChips.map((d) => (
                <button
                  key={d.iso}
                  type="button"
                  className={`chip${selected.has(d.iso) ? " on" : ""}`}
                  aria-pressed={selected.has(d.iso)}
                  onClick={() => toggleDay(d.iso)}
                >
                  {d.label}
                </button>
              ))}
            </div>
            <div className="copy-row" style={{ marginTop: 10, maxWidth: 320 }}>
              <input
                type="date"
                className="input"
                aria-label="Add a specific date"
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
          </div>

          <div className="field-row field">
            <div>
              <label className="fieldlbl" htmlFor="from">
                No earlier than
              </label>
              <input
                id="from"
                type="time"
                className="input"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
              />
            </div>
            <div>
              <label className="fieldlbl" htmlFor="to">
                No later than
              </label>
              <input
                id="to"
                type="time"
                className="input"
                value={to}
                onChange={(e) => setTo(e.target.value)}
              />
            </div>
            <div>
              <label className="fieldlbl" htmlFor="slot">
                Slot size
              </label>
              <select
                id="slot"
                className="input"
                value={slot}
                onChange={(e) => setSlot(Number(e.target.value))}
              >
                {SLOT_SIZES.map((s) => (
                  <option key={s} value={s}>
                    {s} min
                  </option>
                ))}
              </select>
            </div>
          </div>
          {!timeValid && (
            <p
              className="subtle"
              style={{ margin: "-12px 0 22px", fontSize: 13 }}
            >
              The end time needs to be after the start time.
            </p>
          )}

          <div className="field">
            <label className="fieldlbl" htmlFor="tz">
              Timezone
            </label>
            <select
              id="tz"
              className="input"
              value={tz}
              onChange={(e) => setTz(e.target.value)}
            >
              {tzOptions.map((z) => (
                <option key={z.value} value={z.value}>
                  {z.label}
                </option>
              ))}
            </select>
            <p className="subtle" style={{ margin: "7px 0 0", fontSize: 12 }}>
              This is the poll's home timezone. Respondents paint in their own.
            </p>
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 16,
              paddingTop: 22,
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
            <button
              type="submit"
              className="btn btn-primary"
              disabled={!canSubmit || submitting}
            >
              {submitting ? "Creating…" : "Create poll"}
            </button>
          </div>
        </form>

        <div>
          <p className="fieldlbl" style={{ marginBottom: 12 }}>
            CLI equivalent
          </p>
          <CliEquivalent
            title={title.trim()}
            days={selectedDays}
            from={from}
            to={to}
            slot={slot}
            tz={tz}
            isPublic={isPublic}
          />
          <p className="subtle" style={{ fontSize: 13, margin: "14px 2px 0" }}>
            The form and the CLI hit the same endpoint. Anything you can click, a
            script can do.
          </p>
        </div>
      </div>
    </Shell>
  );
}
