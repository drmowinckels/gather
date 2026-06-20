import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Shell } from "../components/Shell";
import { RespondPanel } from "../components/RespondPanel";
import { getPoll, ApiError, type Poll } from "../lib/api";
import { getEditToken } from "../lib/storage";
import { formatDayRange, tzOffsetLabel } from "../lib/datetime";

type State =
  | { kind: "loading" }
  | { kind: "notfound" }
  | { kind: "error" }
  | { kind: "ready"; poll: Poll };

export function PollPage() {
  const { id = "" } = useParams();
  const [state, setState] = useState<State>({ kind: "loading" });
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let active = true;
    setState({ kind: "loading" });
    getPoll(id, getEditToken(id) ?? undefined)
      .then((poll) => active && setState({ kind: "ready", poll }))
      .catch((err) => {
        if (!active) return;
        if (err instanceof ApiError && err.status === 404) {
          setState({ kind: "notfound" });
        } else {
          setState({ kind: "error" });
        }
      });
    return () => {
      active = false;
    };
  }, [id]);

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
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

  if (state.kind === "error") {
    return (
      <Shell>
        <div style={{ padding: "64px 0", maxWidth: 460 }}>
          <h1 className="h2">Can't load this poll right now</h1>
          <p className="helper" style={{ margin: "10px 0 20px" }}>
            The gather service didn't respond. Refresh to try again.
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
          slots · {poll.tz}
          {offset ? ` (${offset})` : ""}
        </p>

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
          </p>
        </div>

        <RespondPanel poll={poll} />
      </div>
    </Shell>
  );
}
