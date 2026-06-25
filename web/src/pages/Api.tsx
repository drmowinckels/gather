import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Shell } from "../components/Shell";
import { Mark } from "../components/Logo";
import { ApiReference, type OpenApiDoc } from "../components/ApiReference";
import { apiDocsUrl } from "../lib/api";
import { GITHUB_URL } from "../lib/links";

// The web app serves its own copy of the spec (generated from the API at build
// via `npm run gen:openapi`), so the reference renders on localhost and Pages
// without the Worker. import.meta.env.BASE_URL is the deploy base ("/").
const SPEC_URL = `${import.meta.env.BASE_URL}openapi.json`;

function CreateExample() {
  return (
    <div className="card" style={{ overflow: "hidden", padding: 0 }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 7,
          padding: "12px 16px",
          borderBottom: "1px solid var(--border-subtle)",
        }}
      >
        {["#e0827d", "#e3bf95", "#8a9c7e"].map((c) => (
          <span
            key={c}
            style={{
              width: 11,
              height: 11,
              borderRadius: "50%",
              background: c,
            }}
          />
        ))}
        <span
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 11,
            color: "var(--fg-subtle)",
            marginLeft: 8,
          }}
        >
          create a poll
        </span>
      </div>
      <pre
        style={{
          margin: 0,
          padding: "18px 16px",
          fontFamily: "var(--font-mono)",
          fontSize: 13,
          lineHeight: 1.7,
          color: "var(--fg-muted)",
          whiteSpace: "pre-wrap",
          wordBreak: "break-word",
        }}
      >
        <span style={{ color: "var(--brand)" }}>$</span> curl -X POST
        https://api.samkoma.org/v1/polls \{"\n"}
        {"  "}-H{" "}
        <span style={{ color: "var(--brand-2)" }}>
          'content-type: application/json'
        </span>{" "}
        \{"\n"}
        {"  "}-d <span style={{ color: "var(--brand-2)" }}>'{"{"}</span>
        {"\n"}
        {"    "}
        <span style={{ color: "var(--brand-2)" }}>
          "title": "Team offsite", "kind": "dates",
        </span>
        {"\n"}
        {"    "}
        <span style={{ color: "var(--brand-2)" }}>
          "days": ["2026-07-15","2026-07-16"],
        </span>
        {"\n"}
        {"    "}
        <span style={{ color: "var(--brand-2)" }}>
          "from": "09:00", "to": "15:00", "slot": 30,
        </span>
        {"\n"}
        {"    "}
        <span style={{ color: "var(--brand-2)" }}>
          "tz": "Europe/Oslo"{"}"}'
        </span>
        {"\n\n"}
        {"{ "}"id": "9fK2qd",{"\n"}
        {"  "}"url": "https://samkoma.org/#/e/9fK2qd",{"\n"}
        {"  "}"editToken": "…" {"}"}
      </pre>
    </div>
  );
}

function Reference() {
  const [spec, setSpec] = useState<OpenApiDoc | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let live = true;
    fetch(SPEC_URL)
      .then((r) => {
        if (!r.ok) throw new Error(`spec ${r.status}`);
        return r.json();
      })
      .then((doc: OpenApiDoc) => live && setSpec(doc))
      .catch(() => live && setFailed(true));
    return () => {
      live = false;
    };
  }, []);

  if (failed) {
    return (
      <p className="section-lead">
        The reference couldn't load.{" "}
        <a href={apiDocsUrl()} target="_blank" rel="noreferrer">
          Open the interactive docs ↗
        </a>{" "}
        or{" "}
        <a href={SPEC_URL} target="_blank" rel="noreferrer">
          view the raw spec ↗
        </a>{" "}
        instead.
      </p>
    );
  }
  if (!spec) return <p className="section-lead">Loading the reference…</p>;
  return <ApiReference spec={spec} />;
}

export function Api() {
  return (
    <Shell>
      <div className="content">
        <section className="page-hero">
          <div>
            <p className="eyebrow">API</p>
            <h1 className="h1">One poll, two front doors.</h1>
            <p className="lede">
              Everything you can do by clicking, you can do with a request. The
              web app, the CLI, and bots like Jinx all speak to the same public
              REST API. No SDK to learn — it's just HTTP and JSON.
            </p>
            <div className="api-actions">
              <a
                className="btn btn-primary"
                href={apiDocsUrl()}
                target="_blank"
                rel="noreferrer"
              >
                Open interactive console ↗
              </a>
              <a
                className="btn btn-outline"
                href={SPEC_URL}
                target="_blank"
                rel="noreferrer"
              >
                View raw spec ↗
              </a>
            </div>
          </div>
          <CreateExample />
        </section>

        <section className="section">
          <h2 className="h2">Reference</h2>
          <p className="section-lead">
            No accounts: creating a poll returns an edit token, sent as{" "}
            <code style={{ fontFamily: "var(--font-mono)", fontSize: ".9em" }}>
              Authorization: Bearer …
            </code>{" "}
            for host-only actions. Expand any endpoint for its parameters, body,
            and responses. The interactive console adds a “try it” runner.
          </p>
          <Reference />
        </section>

        <section className="section">
          <h2 className="h2">Built for bots</h2>
          <p className="section-lead">
            Because the API is the product, automation isn't a bolt-on. Jinx,
            the RLadies+ bot, turns a comment on a GitHub issue into a poll —
            then edits its own reply with the winning slot once everyone's in.
          </p>
          <div className="bot-reply">
            <div className="bot-head">
              <span className="bot-badge">
                <Mark size={20} />
              </span>
              samkoma-bot
              <span className="bot-handle">replied just now</span>
            </div>
            <p className="bot-body">
              📋 Poll's up! <strong>Team offsite — September</strong>
              <br />
              Tue–Thu, 9–15 (Europe/Oslo) ·{" "}
              <span style={{ color: "var(--brand)" }}>
                samkoma.org/#/e/9fK2qd
              </span>
              <br />
              I'll edit this comment with the winning slot once everyone's
              responded.
            </p>
            <div className="bot-chips">
              <span className="bot-chip">0 responses</span>
              <span className="bot-chip">closes in 5 days</span>
            </div>
          </div>
        </section>

        <section className="section">
          <h2 className="h2">Start building</h2>
          <div className="cta-row">
            <a
              className="btn btn-primary"
              href={apiDocsUrl()}
              target="_blank"
              rel="noreferrer"
            >
              Open interactive console ↗
            </a>
            <a
              className="btn btn-outline"
              href={GITHUB_URL}
              target="_blank"
              rel="noreferrer"
            >
              Source on GitHub ↗
            </a>
            <Link to="/new" className="btn btn-outline">
              Create a poll →
            </Link>
          </div>
        </section>
      </div>
    </Shell>
  );
}
