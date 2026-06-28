import { Link } from "react-router-dom";
import { Shell } from "../components/Shell";
import { Mark } from "../components/Logo";
import { useT } from "../i18n";
import type { TKey } from "../i18n";
import { GITHUB_URL, SUPPORT_URL } from "../lib/links";

const PRINCIPLES: { title: TKey; body: TKey }[] = [
  { title: "about.principle1.title", body: "about.principle1.body" },
  { title: "about.principle2.title", body: "about.principle2.body" },
  { title: "about.principle3.title", body: "about.principle3.body" },
  { title: "about.principle4.title", body: "about.principle4.body" },
];

export function About() {
  const t = useT();

  return (
    <Shell>
      <div className="content">
        <section className="page-hero">
          <div>
            <p className="eyebrow">{t("about.eyebrow")}</p>
            <h1 className="h1">{t("about.heroTitle")}</h1>
            <p className="lede">{t("about.heroLede")}</p>
          </div>
          <div className="hero-emblem" aria-hidden="true">
            <Mark size={148} />
          </div>
        </section>

        <section className="section">
          <h2 className="h2">{t("about.whyTitle")}</h2>
          <p className="section-lead">{t("about.whyLead")}</p>
          <div className="principles">
            {PRINCIPLES.map((p) => (
              <div className="principle" key={p.title}>
                <h3>{t(p.title)}</h3>
                <p>{t(p.body)}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="section">
          <h2 className="h2">{t("about.originTitle")}</h2>
          <div className="prose" style={{ marginTop: 14 }}>
            <p>
              {t("about.originPara1a")} <strong>Jinx</strong>
              {t("about.originPara1b")}{" "}
              <strong>{t("about.independent")}</strong>
              {t("about.originPara1c")}
            </p>
            <p>
              {t("about.originPara2")}{" "}
              <a href={GITHUB_URL} target="_blank" rel="noreferrer">
                GitHub
              </a>
              .
            </p>
          </div>
        </section>

        <section className="section">
          <h2 className="h2">{t("about.freeTitle")}</h2>
          <div className="support-card">
            <span className="support-mark">
              <Mark size={44} />
            </span>
            <div className="support-copy">
              <p>{t("about.freeBody")}</p>
            </div>
            <a
              className="btn btn-primary"
              href={SUPPORT_URL}
              target="_blank"
              rel="noreferrer"
            >
              {t("about.supportCta")} ☕
            </a>
          </div>
        </section>

        <section className="section">
          <h2 className="h2">{t("about.ctaTitle")}</h2>
          <div className="cta-row">
            <Link to="/new" className="btn btn-primary">
              {t("about.ctaCreate")} →
            </Link>
            <Link to="/api" className="btn btn-outline">
              {t("about.ctaApi")}
            </Link>
          </div>
        </section>
      </div>
    </Shell>
  );
}
