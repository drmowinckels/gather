import { Link, NavLink } from "react-router-dom";
import type { ReactNode } from "react";
import { useTheme } from "../lib/useTheme";
import { useT } from "../i18n";
import { Logo, Mark } from "./Logo";
import { LanguageToggle } from "./LanguageToggle";
import { FormatMenu } from "./FormatMenu";
import { GITHUB_URL, SUPPORT_URL } from "../lib/links";
import { apiDocsUrl } from "../lib/api";

interface ShellProps {
  children: ReactNode;
  showNewPoll?: boolean;
}

export function Shell({ children, showNewPoll = true }: ShellProps) {
  const [theme, toggle] = useTheme();
  const t = useT();

  return (
    <div className="page">
      <a
        className="skip-link"
        href="#main"
        onClick={(e) => {
          e.preventDefault();
          const main = document.getElementById("main");
          main?.focus();
          main?.scrollIntoView();
        }}
      >
        {t("nav.skipToContent")}
      </a>
      <header className="shell">
        <nav className="nav" aria-label={t("nav.primary")}>
          <Logo />
          <div className="nav-right">
            <div className="nav-links">
              <NavLink to="/api" className="navlink">
                {t("nav.api")}
              </NavLink>
              <NavLink to="/about" className="navlink">
                {t("nav.about")}
              </NavLink>
              <a
                className="navlink"
                href={GITHUB_URL}
                target="_blank"
                rel="noreferrer"
              >
                {t("nav.github")} <span aria-hidden="true">↗</span>
              </a>
            </div>
            <LanguageToggle />
            <FormatMenu />
            <button
              type="button"
              className="theme-toggle"
              onClick={toggle}
              aria-label={
                theme === "dark" ? t("theme.toLight") : t("theme.toDark")
              }
            >
              {theme === "dark" ? "☀" : "☾"}
            </button>
            {showNewPoll && (
              <Link to="/new" className="btn btn-primary btn-sm">
                {t("nav.newPoll")}
              </Link>
            )}
          </div>
        </nav>
      </header>

      <main
        id="main"
        tabIndex={-1}
        className="shell"
        style={{ flex: 1, width: "100%", outline: "none" }}
      >
        {children}
      </main>

      <footer className="footer">
        <div className="shell footer-inner">
          <div className="footer-brand">
            <span className="footer-mark">
              <Mark size={20} />
            </span>
            <span>
              <strong>samkoma</strong> — {t("footer.tagline")}
            </span>
          </div>
          <nav className="footer-links" aria-label={t("footer.label")}>
            <Link to="/about">{t("nav.about")}</Link>
            <Link to="/api">{t("nav.api")}</Link>
            <a href={apiDocsUrl()} target="_blank" rel="noreferrer">
              {t("footer.docs")} ↗
            </a>
            <a href={GITHUB_URL} target="_blank" rel="noreferrer">
              {t("nav.github")} ↗
            </a>
            <a href={SUPPORT_URL} target="_blank" rel="noreferrer">
              {t("footer.support")} ↗
            </a>
          </nav>
        </div>
      </footer>
    </div>
  );
}
