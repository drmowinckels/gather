import { useEffect, useMemo, useState } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import { Shell } from "../components/Shell";
import { RespondPanel } from "../components/RespondPanel";
import { GroupHeatmap } from "../components/GroupHeatmap";
import { getPoll, ApiError, type Poll, type PollResponse } from "../lib/api";
import { getEditToken, saveEditToken } from "../lib/storage";
import {
  formatDayRange,
  tzOffsetLabel,
  browserTimezone,
  listTimezones,
} from "../lib/datetime";
import { formatSlotLabelInTz } from "../lib/tz";
import { parseHostToken, buildHostLink } from "../lib/hostlink";

type State =
  | { kind: "loading" }
  | { kind: "notfound" }
  | { kind: "expired" }
  | { kind: "error" }
  | { kind: "ready"; poll: Poll };

export function PollPage() {
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
  const [hostCopied, setHostCopied] = useState(false);

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
      setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  }

  async function copyHostLink(link: string) {
    try {
      await navigator.clipboard.writeText(link);
      setHostCopied(true);
      setTimeout(() => setHostCopied(false), 1800);
    } catch {
      setHostCopied(false);
    }
  }

  if (state.kind === "loading") {
    return (
      <Shell>
        <p className="helper" style={{ padding: "64px 0" }}>
          Loading poll…
        </p>
      </Shell>
    );
  }

  if (state.kind === "notfound") {
    return (
      <Shell>
        <div style={{ padding: "64px 0", maxWidth: 460 }}>
          <h1 className="h2">That poll isn't here</h1>
          <p className="helper" style={{ margin: "10px 0 20px" }}>
            The link may be mistyped, or the poll was never created. Start a
            fresh one and share the new link.
          </p>
          <Link to="/new" className="btn btn-primary">
            Create a poll →
          </Link>
        </div>
      </Shell>
    );
  }

  if (state.kind === "expired") {
    return (
      <Shell>
        <div style={{ padding: "64px 0", maxWidth: 460 }}>
          <h1 className="h2">This poll has expired</h1>
          <p className="helper" style={{ margin: "10px 0 20px" }}>
            Polls stay live for 14 days after their last day, then they're
            cleared. Start a fresh one for your next get-together.
          </p>
          <Link to="/new" className="btn btn-primary">
            Create a poll →
          </Link>
        </div>
      </Shell>
    );
  }

  if (state.kind === "error") {
    return (
      <Shell>
        <div style={{ padding: "64px 0", maxWidth: 460 }}>
          <h1 className="h2">Can't load this poll right now</h1>
          <p className="helper" style={{ margin: "10px 0 20px" }}>
            The samkoma service didn't respond. Refresh to try again.
          </p>
          <button
            type="button"
            className="btn btn-outline"
            onClick={() => window.location.reload()}
          >
            Refresh
          </button>
        </div>
      </Shell>
    );
  }

  const { poll } = state;
  const isHost = getEditToken(poll.id) !== null;
  const offset = tzOffsetLabel(poll.tz);

  return (
    <Shell>
      <div style={{ padding: "40px 0", maxWidth: 720 }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            marginBottom: 6,
          }}
        >
          <h1 className="h2">{poll.title}</h1>
          {isHost && <span className="tag">You host this</span>}
        </div>
        <p className="helper">
          {formatDayRange(poll.days)} · {poll.from}–{poll.to} · {poll.slot}-min
          slots · home tz {poll.tz}
          {offset ? ` (${offset})` : ""}
        </p>

        <label
          className="tz-control"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            marginTop: 16,
            fontSize: 13,
            color: "var(--fg-muted)",
            flexWrap: "wrap",
          }}
        >
          <span>Showing times in</span>
          <select
            className="input"
            style={{ width: "auto", maxWidth: "100%" }}
            value={viewerTz}
            onChange={(e) => setViewerTz(e.target.value)}
            aria-label="Show times in timezone"
          >
            {tzOptions.map((z) => (
              <option key={z.value} value={z.value}>
                {z.label}
              </option>
            ))}
          </select>
          {viewerTz !== poll.tz && (
            <span className="subtle" style={{ fontSize: 12 }}>
              converted from {poll.tz}
            </span>
          )}
        </label>

        {poll.lockedSlot && (
          <div
            className="card"
            style={{
              padding: "16px 20px",
              marginTop: 18,
              background: "var(--bg-tinted)",
              borderLeft: "3px solid var(--brand)",
              fontSize: 15,
            }}
          >
            📌 Locked in:{" "}
            <strong>
              {formatSlotLabelInTz(poll.lockedSlot, poll.tz, viewerTz)}
            </strong>
          </div>
        )}

        <div className="card" style={{ padding: 22, margin: "26px 0" }}>
          <span className="fieldlbl">Share this link</span>
          <div className="copy-row">
            <input
              className="input"
              readOnly
              value={window.location.href}
              aria-label="Shareable poll link"
              onFocus={(e) => e.currentTarget.select()}
            />
            <button type="button" className="btn btn-primary btn-sm" onClick={copyLink}>
              {copied ? "Copied" : "Copy"}
            </button>
          </div>
          <p className="subtle" style={{ fontSize: 13, margin: "12px 0 0" }}>
            Anyone with this link can add their availability — no account needed.
            {poll.expiresAt && (
              <>
                {" "}
                Link active until{" "}
                {new Intl.DateTimeFormat(undefined, {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                }).format(new Date(`${poll.expiresAt}T00:00:00`))}
                .
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
                  margin: "26px 0",
                  borderLeft: "3px solid var(--border-strong)",
                }}
              >
                <span className="fieldlbl">🔑 Your host link</span>
                <div className="copy-row">
                  <input
                    className="input"
                    readOnly
                    value={hostLink}
                    aria-label="Private host link"
                    onFocus={(e) => e.currentTarget.select()}
                  />
                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    onClick={() => copyHostLink(hostLink)}
                  >
                    {hostCopied ? "Copied" : "Copy"}
                  </button>
                </div>
                <p className="subtle" style={{ fontSize: 13, margin: "12px 0 0" }}>
                  Keep this private — anyone with it can lock the poll and see
                  private results. Open it on another device to manage from there.
                </p>
              </div>
            );
          })()}

        <RespondPanel poll={poll} viewerTz={viewerTz} onSaved={mergeResponse} />

        {poll.public || isHost ? (
          <GroupHeatmap
            poll={poll}
            viewerTz={viewerTz}
            isHost={isHost}
            editToken={getEditToken(poll.id)}
            onLockChange={(updated) =>
              setState({ kind: "ready", poll: updated })
            }
          />
        ) : (
          <div
            className="card"
            style={{ padding: "28px", textAlign: "center", margin: "26px 0" }}
          >
            <p style={{ fontWeight: 700, fontSize: 15, margin: 0 }}>
              Results are private
            </p>
            <p className="helper" style={{ margin: "8px auto 0", maxWidth: 360 }}>
              The host kept the group results private. Your availability is saved.
            </p>
          </div>
        )}
      </div>
    </Shell>
  );
}
