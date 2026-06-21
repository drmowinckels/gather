import { useEffect, useMemo, useRef, useState } from "react";
import { AvailabilityGrid } from "./AvailabilityGrid";
import { submitSlots, ApiError, type Poll, type PollResponse } from "../lib/api";
import { buildGridView } from "../lib/tz";
import { marksFrom, splitMarks, type Marks } from "../lib/paint";
import { getName, saveName, getOwnMarks, saveOwnMarks } from "../lib/storage";

type SaveState =
  | { kind: "idle" }
  | { kind: "saving" }
  | { kind: "saved" }
  | { kind: "error"; message: string };

export function RespondPanel({
  poll,
  viewerTz,
  onSaved,
}: {
  poll: Poll;
  viewerTz: string;
  onSaved?: (response: PollResponse) => void;
}) {
  const view = useMemo(
    () =>
      buildGridView(poll.days, poll.from, poll.to, poll.slot, poll.tz, viewerTz),
    [poll.days, poll.from, poll.to, poll.slot, poll.tz, viewerTz],
  );

  const initialName = useMemo(() => getName(), []);

  const [name, setName] = useState(initialName);
  const [marks, setMarks] = useState<Marks>(new Map());
  const [save, setSave] = useState<SaveState>({ kind: "idle" });

  // Restore this person's availability once: from the server (their saved name
  // matches a response), else from the local cache (private polls hide others).
  useEffect(() => {
    const mine = initialName
      ? poll.responses.find((r) => r.name === initialName)
      : undefined;
    const restored = mine
      ? { slots: mine.slots, maybe: mine.maybe }
      : getOwnMarks(poll.id);
    if (restored) setMarks(marksFrom(restored.slots, restored.maybe));
  }, [initialName, poll.id, poll.responses]);

  const nameRef = useRef(name);
  nameRef.current = name;
  const marksRef = useRef(marks);
  marksRef.current = marks;
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  async function doSave() {
    const trimmed = nameRef.current.trim();
    if (!trimmed) return;
    setSave({ kind: "saving" });
    try {
      const painted = splitMarks(marksRef.current);
      const saved = await submitSlots(poll.id, {
        name: trimmed,
        tz: viewerTz,
        slots: painted.slots,
        maybe: painted.maybe,
      });
      saveOwnMarks(poll.id, painted);
      onSaved?.(saved);
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
    saveName(v);
  }

  const hasName = name.trim().length > 0;

  return (
    <div className="card" style={{ padding: 24, margin: "26px 0" }}>
      <h2 style={{ fontWeight: 700, fontSize: 18, margin: 0 }}>
        Your availability
      </h2>
      <p className="helper" style={{ margin: "6px 0 18px", fontSize: 14 }}>
        Click or drag to mark when you're free. Each tap cycles a slot:
        available → maybe → clear.
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
        view={view}
        value={marks}
        onChange={setMarks}
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
