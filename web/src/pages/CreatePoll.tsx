import { useMemo, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Shell } from "../components/Shell";
import { CliEquivalent } from "../components/CliEquivalent";
import { MonthCalendar } from "../components/MonthCalendar";
import { createPoll, ApiError, type PollKind } from "../lib/api";
import { saveEditToken } from "../lib/storage";
import { browserTimezone, listTimezones, tzOffsetLabel } from "../lib/datetime";
import { weekdayLabel } from "../lib/tz";
import type { PollTemplate } from "../lib/duplicate";

const SLOT_SIZES = [15, 30, 60];
const WEEKDAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];

export function CreatePoll() {
  const navigate = useNavigate();
  const location = useLocation();
  // A "Duplicate" navigation carries a template to prefill the form from.
  const template = (location.state as { template?: PollTemplate } | null)
    ?.template;
  const tzOptions = useMemo(
    () =>
      listTimezones().map((z) => {
        const offset = tzOffsetLabel(z);
        return { value: z, label: offset ? `${z} (${offset})` : z };
      }),
    [],
  );

  const [title, setTitle] = useState(template?.title ?? "");
  const [kind, setKind] = useState<PollKind>(template?.kind ?? "dates");
  const [selected, setSelected] = useState<Set<string>>(
    new Set(template?.days ?? []),
  );
  const [from, setFrom] = useState(template?.from ?? "09:00");
  const [to, setTo] = useState(template?.to ?? "17:00");
  const [slot, setSlot] = useState(template?.slot ?? 30);
  const [tz, setTz] = useState(template?.tz ?? browserTimezone());
  const [isPublic, setIsPublic] = useState(template?.public ?? true);
  const [resultsHidden, setResultsHidden] = useState(
    template?.resultsHidden ?? false,
  );
  const [deadline, setDeadline] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Dates and weekdays use different day namespaces, so reset on switch.
  function switchKind(next: PollKind) {
    setKind(next);
    setSelected(new Set());
  }

  const selectedDays =
    kind === "weekdays"
      ? [...selected].sort((a, b) => WEEKDAYS.indexOf(a) - WEEKDAYS.indexOf(b))
      : [...selected].sort();
  const timeValid = from < to;
  const canSubmit =
    title.trim().length > 0 && selectedDays.length > 0 && timeValid;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const created = await createPoll({
        title: title.trim(),
        kind,
        days: selectedDays,
        from,
        to,
        slot,
        tz,
        public: isPublic,
        resultsHidden,
        ...(deadline ? { deadline: new Date(deadline).toISOString() } : {}),
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
        <form
          className="card"
          style={{ padding: "32px 36px" }}
          onSubmit={onSubmit}
        >
          <h1 className="h2">{template ? "Duplicate poll" : "New poll"}</h1>
          <p className="helper" style={{ margin: "6px 0 28px" }}>
            {template
              ? template.kind === "dates"
                ? "Copied the settings from your poll — now pick the new dates."
                : "Copied the settings from your poll — tweak anything below."
              : "Two minutes, no account. You'll get a link to share and an edit link to keep."}
          </p>

          {error && (
            <div
              className="error-banner"
              style={{ marginBottom: 22 }}
              role="alert"
            >
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
            <div
              className="chips"
              role="radiogroup"
              aria-label="Poll type"
              style={{ margin: "0 0 14px" }}
            >
              <button
                type="button"
                className={`chip${kind === "dates" ? " on" : ""}`}
                role="radio"
                aria-checked={kind === "dates"}
                onClick={() => switchKind("dates")}
              >
                Specific dates
              </button>
              <button
                type="button"
                className={`chip${kind === "weekdays" ? " on" : ""}`}
                role="radio"
                aria-checked={kind === "weekdays"}
                onClick={() => switchKind("weekdays")}
              >
                Days of the week
              </button>
            </div>

            {kind === "dates" ? (
              <>
                <p
                  className="subtle"
                  style={{ margin: "0 0 12px", fontSize: 12 }}
                >
                  Tap a day, or drag across several. Use ‹ › to reach another
                  month.
                </p>
                <MonthCalendar value={selected} onChange={setSelected} />
              </>
            ) : (
              <>
                <p
                  className="subtle"
                  style={{ margin: "0 0 12px", fontSize: 12 }}
                >
                  Pick the weekdays that recur — times stay in the poll's home
                  timezone.
                </p>
                <div className="chips">
                  {WEEKDAYS.map((wd) => (
                    <button
                      key={wd}
                      type="button"
                      className={`chip${selected.has(wd) ? " on" : ""}`}
                      aria-pressed={selected.has(wd)}
                      onClick={() =>
                        setSelected((prev) => {
                          const next = new Set(prev);
                          if (next.has(wd)) next.delete(wd);
                          else next.add(wd);
                          return next;
                        })
                      }
                    >
                      {weekdayLabel(wd)}
                    </button>
                  ))}
                </div>
              </>
            )}
            <p className="subtle" style={{ margin: "10px 0 0", fontSize: 12 }}>
              {selectedDays.length === 0
                ? "No days selected yet."
                : `${selectedDays.length} day${selectedDays.length === 1 ? "" : "s"} selected.`}
            </p>
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

          <div className="field">
            <label className="fieldlbl" htmlFor="deadline">
              Respond-by deadline <span className="subtle">(optional)</span>
            </label>
            <input
              id="deadline"
              type="datetime-local"
              className="input"
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
            />
            <p className="subtle" style={{ margin: "6px 0 0", fontSize: 12 }}>
              After this, the poll stops accepting availability. You can also
              close it by hand any time.
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
            <div style={{ display: "grid", gap: 12 }}>
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
              <label className="switch">
                <input
                  type="checkbox"
                  checked={resultsHidden}
                  onChange={(e) => setResultsHidden(e.target.checked)}
                />
                <span className="switch-track">
                  <span className="switch-knob" />
                </span>
                Hide results until I reveal them
              </label>
            </div>
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
            kind={kind}
            days={selectedDays}
            from={from}
            to={to}
            slot={slot}
            tz={tz}
            isPublic={isPublic}
            resultsHidden={resultsHidden}
          />
          <p className="subtle" style={{ fontSize: 13, margin: "14px 2px 0" }}>
            The form and the CLI hit the same endpoint. Anything you can click,
            a script can do.
          </p>
        </div>
      </div>
    </Shell>
  );
}
