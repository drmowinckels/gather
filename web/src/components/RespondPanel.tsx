import { useEffect, useMemo, useRef, useState } from "react";
import { AvailabilityGrid } from "./AvailabilityGrid";
import {
  submitSlots,
  ApiError,
  type Poll,
  type PollResponse,
} from "../lib/api";
import { buildGridView } from "../lib/tz";
import { marksFrom, splitMarks, fillAll, type Marks } from "../lib/paint";
import { parseIcsBusy, busySlotKeys, overlayWindow } from "../lib/icsImport";
import {
  getName,
  saveName,
  getOwnMarks,
  saveOwnMarks,
  getResponseSecret,
  saveResponseSecret,
} from "../lib/storage";

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

  const initialName = useMemo(() => getName(), []);

  // Every paintable slot key — backs "select all" / "clear all".
  const allKeys = useMemo(() => {
    const keys: string[] = [];
    for (const t of view.times)
      for (const d of view.days) {
        const k = view.keyAt(d, t);
        if (k !== null) keys.push(k);
      }
    return keys;
  }, [view]);

  const [name, setName] = useState(initialName);
  const [marks, setMarks] = useState<Marks>(new Map());
  const [save, setSave] = useState<SaveState>({ kind: "idle" });
  const [password, setPassword] = useState("");
  const [busyKeys, setBusyKeys] = useState<Set<string>>(new Set());
  const [overlayNote, setOverlayNote] = useState<string | null>(null);
  const [bulkNote, setBulkNote] = useState("");

  // Restore this person's availability once per poll: from the server (their
  // saved name matches a response), else from the local cache (private polls
  // hide others). Guarded by poll id so a later response merge — which changes
  // poll.responses — doesn't re-run this and clobber in-progress painting.
  const restoredFor = useRef<string | null>(null);
  useEffect(() => {
    if (restoredFor.current === poll.id) return;
    restoredFor.current = poll.id;
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
  const passwordRef = useRef(password);
  passwordRef.current = password;
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  // Serialise saves so a slow first write (which mints the ownership token)
  // finishes before the next autosave runs — otherwise the follow-up would race
  // without the token and be rejected as a name collision.
  const saving = useRef(false);
  const queued = useRef(false);

  async function doSave() {
    const trimmed = nameRef.current.trim();
    if (!trimmed) return;
    if (saving.current) {
      queued.current = true;
      return;
    }
    saving.current = true;
    setSave({ kind: "saving" });
    const pw = passwordRef.current.trim();
    const secret = pw || getResponseSecret(poll.id, trimmed) || undefined;
    try {
      const painted = splitMarks(marksRef.current);
      const saved = await submitSlots(poll.id, {
        name: trimmed,
        tz: viewerTz,
        slots: painted.slots,
        maybe: painted.maybe,
        secret,
      });
      // Persist whatever lets this browser keep editing: the freshly minted
      // token, or the password the visitor just used.
      if (saved.responseToken) {
        saveResponseSecret(poll.id, trimmed, saved.responseToken);
      } else if (pw) {
        saveResponseSecret(poll.id, trimmed, pw);
      }
      saveOwnMarks(poll.id, painted);
      onSaved?.(saved);
      setSave({ kind: "saved" });
    } catch (err) {
      setSave({
        kind: "error",
        message:
          err instanceof ApiError && err.code === "name_protected"
            ? "That name is protected. Enter its password to edit, or pick another name."
            : err instanceof ApiError
              ? "Couldn't save — please try again."
              : "Can't reach samkoma. Check your connection.",
      });
    } finally {
      saving.current = false;
      if (queued.current) {
        queued.current = false;
        void doSave();
      }
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

  // Parse an uploaded .ics entirely in the browser — nothing is sent anywhere —
  // and overlay the busy slots so the viewer paints around their commitments.
  async function loadCalendar(file: File) {
    if (file.size > 5_000_000) {
      setOverlayNote("That calendar file is too large (over 5 MB).");
      return;
    }
    try {
      const text = await file.text();
      const { busy, skipped } = parseIcsBusy(
        text,
        viewerTz,
        overlayWindow(poll),
      );
      const keys = busySlotKeys(poll, busy);
      setBusyKeys(keys);
      setOverlayNote(
        busy.length === 0
          ? "No events found in this poll's range."
          : `Marked ${keys.size} busy slot(s) from your calendar — nothing was uploaded.` +
              (skipped
                ? ` (${skipped} recurring event${skipped > 1 ? "s" : ""} couldn't be expanded.)`
                : ""),
      );
    } catch {
      setOverlayNote("Couldn't read that file — is it a .ics calendar?");
    }
  }

  function blockOutBusy() {
    if (busyKeys.size === 0) return;
    setMarks((prev) => {
      const next = new Map(prev);
      for (const k of busyKeys) next.delete(k);
      return next;
    });
    scheduleSave();
  }

  // Start from "all available" (then paint busy), or wipe the grid. Handy for
  // "tell me when you're *not* free" style polls.
  function selectAll() {
    setMarks(fillAll(allKeys, "yes"));
    setBulkNote("All slots marked available.");
    scheduleSave();
  }

  function clearAll() {
    setMarks(new Map());
    setBulkNote("All slots cleared.");
    scheduleSave();
  }

  const hasName = name.trim().length > 0;

  if (poll.closed) {
    return (
      <div
        className="card"
        style={{ padding: 24, margin: "26px 0", textAlign: "center" }}
      >
        <p style={{ fontWeight: 700, fontSize: 16, margin: 0 }}>
          Responding is closed
        </p>
        <p className="helper" style={{ margin: "8px auto 0", maxWidth: 380 }}>
          This poll is no longer accepting availability.
        </p>
      </div>
    );
  }

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

      <div className="field" style={{ maxWidth: 320, marginTop: 12 }}>
        <label className="fieldlbl" htmlFor="resp-pw">
          Edit password <span className="subtle">(optional)</span>
        </label>
        <input
          id="resp-pw"
          className="input"
          type="password"
          placeholder="to edit from another device"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          maxLength={200}
          autoComplete="off"
        />
        <p className="subtle" style={{ fontSize: 12, margin: "6px 0 0" }}>
          Leave blank to keep this response to this browser. Set one to claim
          your name and edit it elsewhere.
        </p>
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          margin: "4px 0 14px",
          flexWrap: "wrap",
        }}
      >
        <label
          className="btn btn-outline btn-sm file-label"
          style={{ cursor: "pointer" }}
        >
          Overlay my calendar (.ics)
          <input
            type="file"
            accept=".ics,text/calendar"
            className="sr-only"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) loadCalendar(f);
              e.target.value = "";
            }}
          />
        </label>
        {busyKeys.size > 0 && (
          <button
            type="button"
            className="btn btn-outline btn-sm"
            onClick={blockOutBusy}
          >
            Block out busy times
          </button>
        )}
        <span
          className="subtle"
          role="status"
          aria-live="polite"
          style={{ fontSize: 12 }}
        >
          {overlayNote}
        </span>
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          marginBottom: 10,
          flexWrap: "wrap",
        }}
      >
        <button
          type="button"
          className="btn btn-outline btn-sm"
          onClick={selectAll}
        >
          Select all
        </button>
        <button
          type="button"
          className="btn btn-outline btn-sm"
          onClick={clearAll}
        >
          Clear all
        </button>
        <span className="subtle" style={{ fontSize: 12 }}>
          Mark everything free, then paint when you're busy.
        </span>
        <span className="sr-only" role="status" aria-live="polite">
          {bulkNote}
        </span>
      </div>

      <AvailabilityGrid
        view={view}
        value={marks}
        onChange={setMarks}
        onCommit={scheduleSave}
        busyKeys={busyKeys}
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
          <span role="alert" style={{ fontSize: 13, color: "var(--danger)" }}>
            {save.message}
          </span>
        )}
        <span className="sr-only" role="status" aria-live="polite">
          {save.kind === "saving"
            ? "Saving your availability"
            : save.kind === "saved"
              ? "Availability saved"
              : ""}
        </span>
      </div>
    </div>
  );
}
