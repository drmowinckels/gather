import { Fragment } from "react";
import { Link } from "react-router-dom";
import { Shell } from "../components/Shell";
import { MiniHeat } from "../components/MiniHeat";
import { useT } from "../i18n";
import type { TKey } from "../i18n";

const STEPS: { n: string; title: TKey; body: TKey }[] = [
  { n: "01", title: "landing.step1.title", body: "landing.step1.body" },
  { n: "02", title: "landing.step2.title", body: "landing.step2.body" },
  { n: "03", title: "landing.step3.title", body: "landing.step3.body" },
];

export function Landing() {
  const t = useT();
  const titleLines = t("landing.title").split("\n");

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
          <p className="eyebrow">{t("landing.eyebrow")}</p>
          <h1 className="h1">
            {titleLines.map((line, i) => (
              <Fragment key={i}>
                {i > 0 && <br />}
                {line}
              </Fragment>
            ))}
          </h1>
          <p className="subcopy">{t("landing.subcopy")}</p>
          <div
            style={{
              display: "flex",
              gap: 14,
              marginTop: 30,
              flexWrap: "wrap",
            }}
          >
            <Link to="/new" className="btn btn-primary">
              {t("landing.ctaCreate")} →
            </Link>
            <Link to="/api" className="btn btn-outline">
              {t("landing.ctaApi")}
            </Link>
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
          <div
            key={s.n}
            style={{ background: "var(--bg)", padding: "34px 28px" }}
          >
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
              {t(s.title)}
            </div>
            <p
              style={{
                fontSize: 16,
                lineHeight: 1.5,
                color: "var(--fg-muted)",
                margin: "8px 0 0",
              }}
            >
              {t(s.body)}
            </p>
          </div>
        ))}
      </section>
    </Shell>
  );
}
