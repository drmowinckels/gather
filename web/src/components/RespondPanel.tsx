import { useEffect, useMemo, useRef, useState } from "react";
import { AvailabilityGrid } from "./AvailabilityGrid";
import { submitSlots, ApiError, type Poll } from "../lib/api";
import { browserTimezone, timeSlots, tzOffsetLabel } from "../lib/datetime";

const NAME_KEY = "gather:name";

type SaveState =
  | { kind: "idle" }
  | { kind: "saving" }
  | { kind: "saved" }
  | { kind: "error"; message: string };

export function RespondPanel({ poll }: { poll: Poll }) {
  const times = useMemo(
    () => timeSlots(poll.from, poll.to, poll.slot),
    [poll.from, poll.to, poll.slot],
  );

  const initialName = useMemo(() => {
    try {
      return localStorage.getItem(NAME_KEY) ?? "";
    } catch {
      return "";
    }
  }, []);

  const [name, setName] = useState(initialName);
  const [slots, setSlots] = useState<Set<string>>(new Set());
  const [save, setSave] = useState<SaveState>({ kind: "idle" });

  // Load this person's existing availability once, if their saved name matches.
  useEffect(() => {
    if (!initialName) return;
    const mine = poll.responses.find((r) => r.name === initialName);
    if (mine) setSlots(new Set(mine.slots));
  }, [initialName, poll.responses]);

  const nameRef = useRef(name);
  nameRef.current = name;
  const slotsRef = useRef(slots);
  slotsRef.current = slots;
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  async function doSave() {
    const trimmed = nameRef.current.trim();
    if (!trimmed) return;
    setSave({ kind: "saving" });
    try {
      await submitSlots(poll.id, {
        name: trimmed,
        tz: browserTimezone(),
        slots: [...slotsRef.current],
      });
      setSave({ kind: "saved" });
    } catch (err) {
      setSave({
        kind: "error",
        message:
          err instanceof ApiError
            ? "Couldn't save — please try again."
            : "Can't reach gather. Check your connection.",
      });
    }
  }

  function scheduleSave() {
    if (!nameRef.current.trim()) return;
    clearTimeout(timer.current);
    timer.current = setTimeout(doSave, 500);
  }

  useEffect(() => () => clearTimeout(timer.current), []);

  function onName(v: string) {
    setName(v);
    try {
      localStorage.setItem(NAME_KEY, v);
    } catch {
      // ignore
    }
  }

  const offset = tzOffsetLabel(poll.tz);
  const hasName = name.trim().length > 0;

  return (
    <div className="card" style={{ padding: 24, margin: "26px 0" }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "baseline",
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <h2 style={{ fontWeight: 700, fontSize: 18, margin: 0 }}>
          Your availability
        </h2>
        <span className="subtle" style={{ fontSize: 12 }}>
          All times in {poll.tz}
          {offset ? ` (${offset})` : ""}
        </span>
      </div>
      <p className="helper" style={{ margin: "6px 0 18px", fontSize: 14 }}>
        Click and drag to paint when you're free. Drag again to erase.
      </p>

      <div className="field" style={{ maxWidth: 320 }}>
        <label className="fieldlbl" htmlFor="resp-name">
          Your name
        </label>
        <input
          id="resp-name"
          className="input"
          placeholder="e.g. Ada"
          value={name}
          onChange={(e) => onName(e.target.value)}
          maxLength={80}
        />
      </div>

      <AvailabilityGrid
        days={poll.days}
        times={times}
        value={slots}
        onChange={setSlots}
        onCommit={scheduleSave}
      />

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 14,
          marginTop: 18,
          flexWrap: "wrap",
        }}
      >
        <button
          type="button"
          className="btn btn-primary"
          onClick={doSave}
          disabled={!hasName || save.kind === "saving"}
        >
          {save.kind === "saving" ? "Saving…" : "Save availability"}
        </button>
        {!hasName && (
          <span className="subtle" style={{ fontSize: 13 }}>
            Add your name to save.
          </span>
        )}
        {hasName && save.kind === "saved" && (
          <span style={{ fontSize: 13, color: "var(--botanical)" }}>
            Saved ✓
          </span>
        )}
        {save.kind === "error" && (
          <span style={{ fontSize: 13, color: "#c0533f" }}>{save.message}</span>
        )}
      </div>
    </div>
  );
}
