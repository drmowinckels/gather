import { Link } from "react-router-dom";
import { Shell } from "../components/Shell";
import { MiniHeat } from "../components/MiniHeat";

const STEPS = [
  {
    n: "01",
    title: "Paint your hours",
    body: "Click and drag across the grid to mark when you're free. No account, no calendar sync.",
  },
  {
    n: "02",
    title: "See it converge",
    body: "A live heatmap surfaces the slot that works for the most people, runner-ups close behind.",
  },
  {
    n: "03",
    title: "Automate it",
    body: "Every poll is a REST resource, so a CLI or a bot can open one and read the winning slot back.",
  },
];

export function Landing() {
  return (
    <Shell showNewPoll={false}>
      <section
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(0, 1.05fr) minmax(0, 0.95fr)",
          gap: 44,
          alignItems: "center",
          padding: "64px 0 56px",
        }}
        className="hero"
      >
        <div>
          <p className="eyebrow">Group scheduling, one shared link</p>
          <h1 className="h1">
            Find a time,
            <br />
            together.
          </h1>
          <p className="subcopy">
            Paint when you're free, share one link, and watch the group's best
            slot light up. No accounts required — and every poll is reachable
            from the API.
          </p>
          <div style={{ display: "flex", gap: 14, marginTop: 30, flexWrap: "wrap" }}>
            <Link to="/new" className="btn btn-primary">
              Create a poll →
            </Link>
            <a
              href="https://github.com/drmowinckels/samkoma#readme"
              className="btn btn-outline"
              target="_blank"
              rel="noreferrer"
            >
              Browse the API
            </a>
          </div>
          <div className="term" style={{ marginTop: 26, maxWidth: 460 }}>
            <span className="prompt">$</span> samkoma new{" "}
            <span className="str">"Team offsite"</span> --days mon-fri --9to17
            --tz Europe/Oslo
          </div>
        </div>
        <MiniHeat />
      </section>

      <section
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gap: 1,
          background: "var(--border-subtle)",
          borderTop: "1px solid var(--border-subtle)",
          borderBottom: "1px solid var(--border-subtle)",
        }}
        className="steps"
      >
        {STEPS.map((s) => (
          <div key={s.n} style={{ background: "var(--bg)", padding: "34px 28px" }}>
            <div
              style={{
                fontWeight: 800,
                fontSize: 13,
                letterSpacing: ".08em",
                color: "var(--brand)",
              }}
            >
              {s.n}
            </div>
            <div style={{ fontWeight: 700, fontSize: 17, marginTop: 10 }}>
              {s.title}
            </div>
            <p
              style={{
                fontSize: 16,
                lineHeight: 1.5,
                color: "var(--fg-muted)",
                margin: "8px 0 0",
              }}
            >
              {s.body}
            </p>
          </div>
        ))}
      </section>
    </Shell>
  );
}
