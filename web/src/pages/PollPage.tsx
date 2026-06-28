import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import { Shell } from "../components/Shell";
import { RespondPanel } from "../components/RespondPanel";
import { GroupHeatmap } from "../components/GroupHeatmap";
import { EditPollPanel } from "../components/EditPollPanel";
import {
  getPoll,
  editPoll,
  icsUrl,
  ApiError,
  type Poll,
  type PollResponse,
  type EditPollInput,
} from "../lib/api";
import { getEditToken, saveEditToken } from "../lib/storage";
import {
  formatDayRange,
  formatTime,
  tzOffsetLabel,
  browserTimezone,
  listTimezones,
  localizedDateFormat,
} from "../lib/datetime";
import { formatSlotLabelInTz } from "../lib/tz";
import { parseHostToken, buildHostLink } from "../lib/hostlink";
import { pollToTemplate } from "../lib/duplicate";
import { QrCode } from "../components/QrCode";
import { useT } from "../i18n";

type State =
  | { kind: "loading" }
  | { kind: "notfound" }
  | { kind: "expired" }
  | { kind: "error" }
  | { kind: "ready"; poll: Poll };

export function PollPage() {
  const t = useT();
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const [state, setState] = useState<State>({ kind: "loading" });
  const [viewerTz, setViewerTz] = useState(browserTimezone());
  const tzOptions = useMemo(
    () =>
      listTimezones().map((z) => {
        const o = tzOffsetLabel(z);
        return { value: z, label: o ? `${z} (${o})` : z };
      }),
    [],
  );
  const [copied, setCopied] = useState(false);
  const [showQr, setShowQr] = useState(false);
  const [hostCopied, setHostCopied] = useState(false);
  const [editing, setEditing] = useState(false);
  const [revealError, setRevealError] = useState(false);
  const [closeError, setCloseError] = useState(false);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );
  useEffect(() => () => clearTimeout(toastTimer.current), []);

  useEffect(() => {
    let active = true;
    setState({ kind: "loading" });
    // A host link carries the edit token in the hash — claim it for this device,
    // then strip it from the URL so it isn't left visible or bookmarked by accident.
    const hostToken = parseHostToken(window.location.hash);
    if (hostToken) {
      saveEditToken(id, hostToken);
      navigate(`/e/${id}`, { replace: true });
    }
    getPoll(id, getEditToken(id) ?? undefined)
      .then((poll) => active && setState({ kind: "ready", poll }))
      .catch((err) => {
        if (!active) return;
        if (err instanceof ApiError && err.status === 404) {
          setState({ kind: "notfound" });
        } else if (err instanceof ApiError && err.status === 410) {
          setState({ kind: "expired" });
        } else {
          setState({ kind: "error" });
        }
      });
    return () => {
      active = false;
    };
  }, [id]);

  // Shared host PATCH: apply the change and re-render, or signal failure so the
  // host can retry.
  async function patchPoll(
    token: string,
    patch: EditPollInput,
    onError: () => void,
  ) {
    try {
      setState({ kind: "ready", poll: await editPoll(id, patch, token) });
    } catch {
      onError();
    }
  }

  function revealResults(token: string) {
    setRevealError(false);
    return patchPoll(token, { resultsHidden: false }, () =>
      setRevealError(true),
    );
  }

  function setClosed(token: string, closed: boolean) {
    setCloseError(false);
    return patchPoll(token, { closed }, () => setCloseError(true));
  }

  function mergeResponse(r: PollResponse) {
    setState((s) => {
      if (s.kind !== "ready") return s;
      const others = s.poll.responses.filter((x) => x.name !== r.name);
      return { kind: "ready", poll: { ...s.poll, responses: [...others, r] } };
    });
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      clearTimeout(toastTimer.current);
      toastTimer.current = setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  }

  async function copyHostLink(link: string) {
    try {
      await navigator.clipboard.writeText(link);
      setHostCopied(true);
      clearTimeout(toastTimer.current);
      toastTimer.current = setTimeout(() => setHostCopied(false), 1800);
    } catch {
      setHostCopied(false);
    }
  }

  if (state.kind === "loading") {
    return (
      <Shell>
        <p className="helper" style={{ padding: "64px 0" }}>
          {t("poll.loading")}
        </p>
      </Shell>
    );
  }

  if (state.kind === "notfound") {
    return (
      <Shell>
        <div style={{ padding: "64px 0", maxWidth: 460 }}>
          <h1 className="h2">{t("poll.notFound.title")}</h1>
          <p className="helper" style={{ margin: "10px 0 20px" }}>
            {t("poll.notFound.body")}
          </p>
          <Link to="/new" className="btn btn-primary">
            {t("poll.notFound.cta")} →
          </Link>
        </div>
      </Shell>
    );
  }

  if (state.kind === "expired") {
    return (
      <Shell>
        <div style={{ padding: "64px 0", maxWidth: 460 }}>
          <h1 className="h2">{t("poll.expired.title")}</h1>
          <p className="helper" style={{ margin: "10px 0 20px" }}>
            {t("poll.expired.body")}
          </p>
          <Link to="/new" className="btn btn-primary">
            {t("poll.expired.cta")} →
          </Link>
        </div>
      </Shell>
    );
  }

  if (state.kind === "error") {
    return (
      <Shell>
        <div style={{ padding: "64px 0", maxWidth: 460 }}>
          <h1 className="h2">{t("poll.error.title")}</h1>
          <p className="helper" style={{ margin: "10px 0 20px" }}>
            {t("poll.error.body")}
          </p>
          <button
            type="button"
            className="btn btn-outline"
            onClick={() => window.location.reload()}
          >
            {t("poll.error.refresh")}
          </button>
        </div>
      </Shell>
    );
  }

  const { poll } = state;
  const hostToken = getEditToken(poll.id);
  const isHost = hostToken !== null;
  // The curtain only has meaning on a public poll — hiding a private poll's
  // results changes nothing a respondent can see.
  const curtained = poll.public && poll.resultsHidden;
  const offset = tzOffsetLabel(poll.tz);

  // The viewer's display-timezone control lives in the sidebar's details card
  // (passed into RespondPanel); for weekday polls it's just an info note.
  const tzControl =
    poll.kind === "dates" ? (
      <label
        className="tz-control"
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          margin: "0 0 16px",
          fontSize: 13,
          color: "var(--fg-muted)",
          flexWrap: "wrap",
        }}
      >
        <span>{t("poll.tz.showingIn")}</span>
        <select
          className="input"
          style={{ width: "auto", maxWidth: "100%" }}
          value={viewerTz}
          onChange={(e) => setViewerTz(e.target.value)}
          aria-label={t("poll.tz.selectLabel")}
        >
          {tzOptions.map((z) => (
            <option key={z.value} value={z.value}>
              {z.label}
            </option>
          ))}
        </select>
        {viewerTz !== poll.tz && (
          <span className="subtle" style={{ fontSize: 12 }}>
            {t("poll.tz.convertedFrom", { tz: poll.tz })}
          </span>
        )}
      </label>
    ) : (
      <p
        className="helper"
        style={{ margin: "0 0 16px", fontSize: 13 }}
        aria-label={t("poll.tz.noteLabel")}
      >
        {t("poll.tz.weekdayNote", { tz: poll.tz })}
      </p>
    );

  return (
    <Shell>
      <div className="poll-page" style={{ padding: "40px 0" }}>
        <div className="poll-body">
          <div className="poll-header">
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                marginBottom: 6,
              }}
            >
              <h1 className="h2">{poll.title}</h1>
              {isHost && <span className="tag">{t("poll.youHost")}</span>}
              <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
                {isHost && !editing && (
                  <button
                    type="button"
                    className="btn btn-outline btn-sm"
                    onClick={() => setEditing(true)}
                  >
                    {t("poll.editPoll")}
                  </button>
                )}
                <button
                  type="button"
                  className="btn btn-outline btn-sm"
                  onClick={() =>
                    navigate("/new", {
                      state: { template: pollToTemplate(poll) },
                    })
                  }
                >
                  {t("poll.duplicate")}
                </button>
              </div>
            </div>
            <p className="helper">
              {formatDayRange(poll.days, {
                empty: t("poll.noDays"),
                days: (count) => t("poll.dayCount", { count }),
              })}{" "}
              · {formatTime(poll.from)}–{formatTime(poll.to)} ·{" "}
              {t("poll.meta", { slot: poll.slot, tz: poll.tz })}
              {offset ? ` (${offset})` : ""}
            </p>

            {isHost && editing && hostToken && (
              <EditPollPanel
                poll={poll}
                editToken={hostToken}
                onSaved={(updated) =>
                  setState({ kind: "ready", poll: updated })
                }
                onClose={() => setEditing(false)}
              />
            )}

            {(poll.closed || poll.deadline || isHost) && (
              <div
                className="helper"
                style={{
                  marginTop: 12,
                  fontSize: 13,
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  flexWrap: "wrap",
                }}
              >
                <span>
                  {poll.closed
                    ? t("poll.responding.closed")
                    : poll.deadline
                      ? t("poll.responding.closesAt", {
                          date: localizedDateFormat({
                            dateStyle: "medium",
                            timeStyle: "short",
                          }).format(new Date(poll.deadline)),
                        })
                      : t("poll.responding.open")}
                </span>
                {isHost && hostToken && (
                  <button
                    type="button"
                    className="btn btn-outline btn-sm"
                    onClick={() => setClosed(hostToken, !poll.closed)}
                  >
                    {poll.closed ? t("poll.reopen") : t("poll.closeNow")}
                  </button>
                )}
                {closeError && (
                  <span role="alert" style={{ color: "var(--danger)" }}>
                    {t("poll.closeError")}
                  </span>
                )}
              </div>
            )}

            {poll.lockedSlot && (
              <div
                className="card"
                style={{
                  padding: "16px 20px",
                  marginTop: 18,
                  background: "var(--bg-tinted)",
                  fontSize: 15,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    flexWrap: "wrap",
                  }}
                >
                  <span>
                    {t("poll.lockedIn")}{" "}
                    <strong>
                      {formatSlotLabelInTz(
                        poll.lockedSlot,
                        poll.kind,
                        poll.tz,
                        viewerTz,
                      )}
                    </strong>
                  </span>
                  <a
                    className="btn btn-outline btn-sm"
                    style={{ marginLeft: "auto" }}
                    href={icsUrl(poll.id)}
                    download
                  >
                    {t("poll.addToCalendar")}
                  </a>
                </div>
              </div>
            )}
          </div>

          <RespondPanel
            poll={poll}
            viewerTz={viewerTz}
            onSaved={mergeResponse}
            tzControl={tzControl}
          />

          <div className="poll-results">
            {isHost || (poll.public && !poll.resultsHidden) ? (
              <>
                {hostToken && curtained && (
                  <div
                    className="card"
                    style={{
                      padding: "16px 20px",
                      margin: "26px 0 0",
                      background: "var(--bg-tinted)",
                      display: "flex",
                      alignItems: "center",
                      gap: 12,
                      flexWrap: "wrap",
                      fontSize: 14,
                    }}
                  >
                    <span>
                      {t("poll.curtain.hostHidden")}
                      {revealError && (
                        <span role="alert" style={{ color: "var(--danger)" }}>
                          {" "}
                          {t("poll.curtain.revealError")}
                        </span>
                      )}
                    </span>
                    <button
                      type="button"
                      className="btn btn-primary btn-sm"
                      style={{ marginLeft: "auto" }}
                      onClick={() => revealResults(hostToken)}
                    >
                      {t("poll.curtain.reveal")}
                    </button>
                  </div>
                )}
                <GroupHeatmap
                  poll={poll}
                  viewerTz={viewerTz}
                  isHost={isHost}
                  editToken={getEditToken(poll.id)}
                  onLockChange={(updated) =>
                    setState({ kind: "ready", poll: updated })
                  }
                />
              </>
            ) : (
              <div
                className="card"
                style={{
                  padding: "28px",
                  textAlign: "center",
                  margin: "26px 0",
                }}
              >
                <p style={{ fontWeight: 700, fontSize: 15, margin: 0 }}>
                  {curtained
                    ? t("poll.private.curtainedTitle")
                    : t("poll.private.privateTitle")}
                </p>
                <p
                  className="helper"
                  style={{ margin: "8px auto 0", maxWidth: 360 }}
                >
                  {curtained
                    ? t("poll.private.curtainedBody")
                    : t("poll.private.privateBody")}
                </p>
              </div>
            )}
          </div>

          <aside className="poll-aside">
            <div className="card" style={{ padding: 22 }}>
              <span className="fieldlbl">{t("poll.share.label")}</span>
              <div className="copy-row">
                <input
                  className="input"
                  readOnly
                  value={window.location.href}
                  aria-label={t("poll.share.inputLabel")}
                  onFocus={(e) => e.currentTarget.select()}
                />
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  onClick={copyLink}
                >
                  {copied ? t("poll.copied") : t("poll.copy")}
                </button>
                <button
                  type="button"
                  className="btn btn-outline btn-sm"
                  aria-expanded={showQr}
                  onClick={() => setShowQr((v) => !v)}
                >
                  {showQr ? t("poll.qr.hide") : t("poll.qr.show")}
                </button>
              </div>
              <span className="sr-only" role="status" aria-live="polite">
                {copied ? t("poll.share.copiedStatus") : ""}
              </span>
              {showQr && (
                <QrCode
                  value={window.location.href}
                  label={t("poll.qr.label")}
                />
              )}
              <p
                className="subtle"
                style={{ fontSize: 13, margin: "12px 0 0" }}
              >
                {t("poll.share.anyone")}
                {poll.expiresAt && (
                  <>
                    {" "}
                    {t("poll.share.activeUntil", {
                      date: localizedDateFormat({
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      }).format(new Date(`${poll.expiresAt}T00:00:00`)),
                    })}
                  </>
                )}
              </p>
            </div>

            {isHost &&
              (() => {
                const token = getEditToken(poll.id);
                if (!token) return null;
                const hostLink = buildHostLink(window.location.href, token);
                return (
                  <div
                    className="card"
                    style={{
                      padding: 22,
                      background: "var(--bg-tinted)",
                    }}
                  >
                    <span className="fieldlbl">{t("poll.host.label")}</span>
                    <div className="copy-row">
                      <input
                        className="input"
                        readOnly
                        value={hostLink}
                        aria-label={t("poll.host.inputLabel")}
                        onFocus={(e) => e.currentTarget.select()}
                      />
                      <button
                        type="button"
                        className="btn btn-primary btn-sm"
                        onClick={() => copyHostLink(hostLink)}
                      >
                        {hostCopied ? t("poll.copied") : t("poll.copy")}
                      </button>
                    </div>
                    <p
                      className="subtle"
                      style={{ fontSize: 13, margin: "12px 0 0" }}
                    >
                      {t("poll.host.hint")}
                    </p>
                  </div>
                );
              })()}
          </aside>
        </div>
      </div>
    </Shell>
  );
}
