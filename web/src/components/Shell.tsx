import { Link, NavLink } from "react-router-dom";
import type { ReactNode } from "react";
import { useTheme } from "../lib/useTheme";
import { Logo, Mark } from "./Logo";
import { GITHUB_URL, SUPPORT_URL } from "../lib/links";
import { apiDocsUrl } from "../lib/api";

interface ShellProps {
  children: ReactNode;
  showNewPoll?: boolean;
}

export function Shell({ children, showNewPoll = true }: ShellProps) {
  const [theme, toggle] = useTheme();

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
        Skip to content
      </a>
      <header className="shell">
        <nav className="nav" aria-label="Primary">
          <Logo />
          <div className="nav-right">
            <div className="nav-links">
              <NavLink to="/api" className="navlink">
                API
              </NavLink>
              <NavLink to="/about" className="navlink">
                About
              </NavLink>
              <a
                className="navlink"
                href={GITHUB_URL}
                target="_blank"
                rel="noreferrer"
              >
                GitHub <span aria-hidden="true">↗</span>
              </a>
            </div>
            <button
              type="button"
              className="theme-toggle"
              onClick={toggle}
              aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} theme`}
            >
              {theme === "dark" ? "☀" : "☾"}
            </button>
            {showNewPoll && (
              <Link to="/new" className="btn btn-primary btn-sm">
                New poll
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
              <strong>samkoma</strong> — find a time, together.
            </span>
          </div>
          <nav className="footer-links" aria-label="Footer">
            <Link to="/about">About</Link>
            <Link to="/api">API</Link>
            <a href={apiDocsUrl()} target="_blank" rel="noreferrer">
              Docs ↗
            </a>
            <a href={GITHUB_URL} target="_blank" rel="noreferrer">
              GitHub ↗
            </a>
            <a href={SUPPORT_URL} target="_blank" rel="noreferrer">
              Buy me a coffee ↗
            </a>
          </nav>
        </div>
      </footer>
    </div>
  );
}
