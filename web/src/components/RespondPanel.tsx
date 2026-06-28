import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
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
import { useT } from "../i18n";
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
  tzControl,
}: {
  poll: Poll;
  viewerTz: string;
  onSaved?: (response: PollResponse) => void;
  tzControl?: ReactNode;
}) {
  const t = useT();
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

  // Distinct groups already used on this poll, for the input's autocomplete.
  const knownGroups = useMemo(
    () => [
      ...new Set(
        poll.responses
          .map((r) => r.group)
          .filter((g): g is string => Boolean(g)),
      ),
    ],
    [poll.responses],
  );

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
  const [group, setGroup] = useState("");
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
    // No prior response and the host inverted the default → start all-available
    // so the respondent paints their busy times instead.
    else if (poll.defaultAvailable) setMarks(fillAll(allKeys, "yes"));
    if (mine?.group) setGroup(mine.group);
  }, [initialName, poll.id, poll.responses, poll.defaultAvailable, allKeys]);

  const nameRef = useRef(name);
  nameRef.current = name;
  const marksRef = useRef(marks);
  marksRef.current = marks;
  const passwordRef = useRef(password);
  passwordRef.current = password;
  const groupRef = useRef(group);
  groupRef.current = group;
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
        group: groupRef.current.trim() || undefined,
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
            ? t("respond.error.nameProtected")
            : err instanceof ApiError
              ? t("respond.error.saveFailed")
              : t("respond.error.network"),
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
      setOverlayNote(t("respond.overlay.tooLarge"));
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
          ? t("respond.overlay.noEvents")
          : t("respond.overlay.marked", { count: keys.size }) +
              (skipped
                ? t("respond.overlay.recurring", { count: skipped })
                : ""),
      );
    } catch {
      setOverlayNote(t("respond.overlay.readFailed"));
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
    setBulkNote(t("respond.bulk.allAvailable"));
    scheduleSave();
  }

  function clearAll() {
    setMarks(new Map());
    setBulkNote(t("respond.bulk.allCleared"));
    scheduleSave();
  }

  const hasName = name.trim().length > 0;

  if (poll.closed) {
    return (
      <div
        className="card respond-main"
        style={{ padding: 24, margin: "26px 0", textAlign: "center" }}
      >
        <p style={{ fontWeight: 700, fontSize: 16, margin: 0 }}>
          {t("respond.closed.title")}
        </p>
        <p className="helper" style={{ margin: "8px auto 0", maxWidth: 380 }}>
          {t("respond.closed.body")}
        </p>
      </div>
    );
  }

  return (
    <>
      <div
        className="card respond-controls"
        style={{ padding: 22, margin: "26px 0" }}
      >
        {tzControl}
        <h2 style={{ fontWeight: 700, fontSize: 18, margin: "0 0 16px" }}>
          {t("respond.details.heading")}
        </h2>

        <div className="field" style={{ maxWidth: 320 }}>
          <label className="fieldlbl" htmlFor="resp-name">
            {t("respond.name.label")}
          </label>
          <input
            id="resp-name"
            className="input"
            placeholder={t("respond.name.placeholder")}
            value={name}
            onChange={(e) => onName(e.target.value)}
            maxLength={80}
          />
        </div>

        <div className="field" style={{ maxWidth: 320, marginTop: 12 }}>
          <label className="fieldlbl" htmlFor="resp-group">
            {t("respond.group.label")}{" "}
            <span className="subtle">{t("respond.optional")}</span>
          </label>
          <input
            id="resp-group"
            className="input"
            list="resp-group-options"
            placeholder={t("respond.group.placeholder")}
            value={group}
            onChange={(e) => {
              setGroup(e.target.value);
              scheduleSave();
            }}
            maxLength={60}
          />
          {knownGroups.length > 0 && (
            <datalist id="resp-group-options">
              {knownGroups.map((g) => (
                <option key={g} value={g} />
              ))}
            </datalist>
          )}
          <p className="subtle" style={{ fontSize: 12, margin: "6px 0 0" }}>
            {t("respond.group.helper")}
          </p>
        </div>

        <div className="field" style={{ maxWidth: 320, marginTop: 12 }}>
          <label className="fieldlbl" htmlFor="resp-pw">
            {t("respond.password.label")}{" "}
            <span className="subtle">{t("respond.optional")}</span>
          </label>
          <input
            id="resp-pw"
            className="input"
            type="password"
            placeholder={t("respond.password.placeholder")}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            maxLength={200}
            autoComplete="off"
          />
          <p className="subtle" style={{ fontSize: 12, margin: "6px 0 0" }}>
            {t("respond.password.helper")}
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
            {t("respond.calendar.overlay")}
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
              {t("respond.calendar.blockOut")}
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
            {t("respond.bulk.selectAll")}
          </button>
          <button
            type="button"
            className="btn btn-outline btn-sm"
            onClick={clearAll}
          >
            {t("respond.bulk.clearAll")}
          </button>
          <span className="subtle" style={{ fontSize: 12 }}>
            {t("respond.bulk.helper")}
          </span>
          <span className="sr-only" role="status" aria-live="polite">
            {bulkNote}
          </span>
        </div>
      </div>

      <div
        className="card respond-main"
        style={{ padding: 24, margin: "26px 0" }}
      >
        <h2 style={{ fontWeight: 700, fontSize: 18, margin: 0 }}>
          {t("respond.availability.heading")}
        </h2>
        <p className="helper" style={{ margin: "6px 0 18px", fontSize: 14 }}>
          {poll.defaultAvailable
            ? t("respond.availability.helperDefaultAvailable")
            : t("respond.availability.helper")}
        </p>

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
            {save.kind === "saving"
              ? t("respond.save.saving")
              : t("respond.save.button")}
          </button>
          {!hasName && (
            <span className="subtle" style={{ fontSize: 13 }}>
              {t("respond.save.addName")}
            </span>
          )}
          {hasName && save.kind === "saved" && (
            <span style={{ fontSize: 13, color: "var(--botanical)" }}>
              {t("respond.save.saved")} ✓
            </span>
          )}
          {save.kind === "error" && (
            <span role="alert" style={{ fontSize: 13, color: "var(--danger)" }}>
              {save.message}
            </span>
          )}
          <span className="sr-only" role="status" aria-live="polite">
            {save.kind === "saving"
              ? t("respond.save.liveSaving")
              : save.kind === "saved"
                ? t("respond.save.liveSaved")
                : ""}
          </span>
        </div>
      </div>
    </>
  );
}
